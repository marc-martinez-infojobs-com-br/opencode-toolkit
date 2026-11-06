import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { isLikelyPlanContent, type ParsedPlan, parsePlanMarkdown } from "./parser.js"

export interface DiscoveredPlan {
  readonly filePath: string
  readonly displayPath: string
  readonly title: string
  readonly completedSteps: number
  readonly totalSteps: number
  readonly percentage: number
  readonly updatedAt: number
}

const EXCLUDED_FILENAMES = new Set([
  "readme.md",
  "agents.md",
  "claude.md",
  "gemini.md",
  "skill.md",
  "changelog.md",
  "contributing.md",
  "license.md",
  "security.md",
  "code_of_conduct.md",
  "progress.md",
  "visual-companion.md",
  "builder-check-prompt.md",
  "implementer-prompt.md",
  "task-reviewer-prompt.md",
  "re-review-prompt.md",
])

const SDD_SHELL_RE = /\b(?:sdd-workspace|task-start|task-done)\s+["']?([^\s"']+\.md)["']?/i

export function isPlanFilePathCandidate(filePath: string): boolean {
  if (!filePath || !filePath.toLowerCase().endsWith(".md")) return false
  const base = path.basename(filePath).toLowerCase()
  if (EXCLUDED_FILENAMES.has(base)) return false
  if (/^task-\d+-brief\.md$/i.test(base)) return false

  const normalized = filePath.replace(/\\/g, "/").toLowerCase()
  if (normalized.includes("/node_modules/") || normalized.includes("/.cache/opencode/")) {
    return false
  }
  if (
    normalized.includes("/docs/") ||
    normalized.includes("/.opencode/plan/") ||
    normalized.includes("/plans/") ||
    normalized.includes("plan")
  ) {
    return true
  }
  return false
}

export function extractCandidatePlanPathFromToolCall(
  tool: string,
  input: unknown,
  cwd: string,
): string | null {
  if (!input || typeof input !== "object") return null
  const record = input as Record<string, unknown>

  const normalizedTool = tool.toLowerCase()
  if (
    normalizedTool === "write" ||
    normalizedTool === "edit" ||
    normalizedTool === "patch" ||
    normalizedTool === "read"
  ) {
    const rawPath =
      typeof record.path === "string"
        ? record.path
        : typeof record.filePath === "string"
          ? record.filePath
          : null
    if (!rawPath || !rawPath.toLowerCase().endsWith(".md")) return null
    const resolved = path.isAbsolute(rawPath) ? rawPath : path.resolve(cwd, rawPath)
    const base = path.basename(resolved).toLowerCase()
    if (EXCLUDED_FILENAMES.has(base)) return null
    const normalized = resolved.replace(/\\/g, "/").toLowerCase()
    if (normalized.includes("/node_modules/") || normalized.includes("/.cache/opencode/")) {
      return null
    }
    return resolved
  }

  if (normalizedTool === "shell" || normalizedTool === "bash") {
    const cmd = typeof record.command === "string" ? record.command : ""
    const match = cmd.match(SDD_SHELL_RE)
    if (match?.[1]) {
      const workdir = typeof record.workdir === "string" && record.workdir ? record.workdir : cwd
      return path.isAbsolute(match[1]) ? match[1] : path.resolve(workdir, match[1])
    }
  }

  return null
}

export function resolveLedgerPathForPlan(planFilePath: string, projectDir: string): string | null {
  const planBase = path.basename(planFilePath, path.extname(planFilePath))
  const candidates = [
    path.join(projectDir, ".superpowers", "sdd", planBase, "progress.md"),
    path.join(path.dirname(planFilePath), "..", ".superpowers", "sdd", planBase, "progress.md"),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }
  return null
}

export function loadParsedPlanFromFile(
  planFilePath: string,
  projectDir: string,
): ParsedPlan | null {
  try {
    const resolvedPath = path.isAbsolute(planFilePath)
      ? planFilePath
      : path.resolve(projectDir, planFilePath)
    if (!fs.existsSync(resolvedPath)) return null
    const stat = fs.statSync(resolvedPath)
    if (!stat.isFile()) return null
    const content = fs.readFileSync(resolvedPath, "utf8")
    if (!isLikelyPlanContent(content)) return null

    const ledgerPath = resolveLedgerPathForPlan(resolvedPath, projectDir)
    const ledgerContent = ledgerPath ? fs.readFileSync(ledgerPath, "utf8") : undefined

    const parsed = parsePlanMarkdown(content, resolvedPath, ledgerContent)
    return {
      ...parsed,
      updatedAt: stat.mtimeMs,
    }
  } catch {
    return null
  }
}

function collectMarkdownFiles(dir: string, maxDepth = 4, currentDepth = 0): string[] {
  if (currentDepth > maxDepth || !fs.existsSync(dir)) return []
  const results: string[] = []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".opencode") continue
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        results.push(...collectMarkdownFiles(fullPath, maxDepth, currentDepth + 1))
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        results.push(fullPath)
      }
    }
  } catch {
    // ignore unreadable directories
  }
  return results
}

function formatDisplayPath(filePath: string, projectDir: string): string {
  const rel = path.relative(projectDir, filePath)
  if (!rel.startsWith("..") && !path.isAbsolute(rel)) {
    return rel
  }
  const home = os.homedir()
  if (filePath.startsWith(home)) {
    return `~${filePath.slice(home.length)}`
  }
  return filePath
}

export async function discoverPlanFiles(
  projectDir: string,
  extraDirs: string[] = [path.join(os.homedir(), ".opencode", "plan")],
): Promise<DiscoveredPlan[]> {
  const searchRoots = [
    path.join(projectDir, "docs"),
    path.join(projectDir, ".opencode", "plan"),
    path.join(projectDir, "plans"),
    ...extraDirs,
  ]

  const seen = new Set<string>()
  const discovered: DiscoveredPlan[] = []

  // Also check top-level *-plan.md in projectDir
  const candidateFiles = new Set<string>()
  for (const root of searchRoots) {
    for (const file of collectMarkdownFiles(root, 4)) {
      candidateFiles.add(file)
    }
  }
  for (const file of collectMarkdownFiles(projectDir, 1)) {
    if (isPlanFilePathCandidate(file)) {
      candidateFiles.add(file)
    }
  }

  for (const filePath of candidateFiles) {
    const resolved = path.resolve(filePath)
    if (seen.has(resolved)) continue
    seen.add(resolved)

    const base = path.basename(resolved).toLowerCase()
    if (EXCLUDED_FILENAMES.has(base)) continue

    const parsed = loadParsedPlanFromFile(resolved, projectDir)
    if (!parsed || parsed.totalSteps === 0) continue

    discovered.push({
      filePath: resolved,
      displayPath: formatDisplayPath(resolved, projectDir),
      title: parsed.title,
      completedSteps: parsed.completedSteps,
      totalSteps: parsed.totalSteps,
      percentage: parsed.percentage,
      updatedAt: parsed.updatedAt,
    })
  }

  discovered.sort((a, b) => b.updatedAt - a.updatedAt)
  return discovered
}
