import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  discoverPlanFiles,
  extractCandidatePlanPathFromToolCall,
  isPlanFilePathCandidate,
  loadParsedPlanFromFile,
} from "../src/detector.js"

const tempDirs: string[] = []

function makeTempProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-plan-test-"))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe("extractCandidatePlanPathFromToolCall", () => {
  it("extracts markdown file path from write/edit/read tool inputs", () => {
    expect(
      extractCandidatePlanPathFromToolCall(
        "write",
        { path: "docs/superpowers/plans/2026-11-05-auth.md" },
        "/workspace/app",
      ),
    ).toBe("/workspace/app/docs/superpowers/plans/2026-11-05-auth.md")

    expect(
      extractCandidatePlanPathFromToolCall(
        "edit",
        { path: "/Users/me/.opencode/plan/my-plan.md" },
        "/workspace/app",
      ),
    ).toBe("/Users/me/.opencode/plan/my-plan.md")
  })

  it("ignores non-markdown files or excluded instruction files like AGENTS.md and SKILL.md", () => {
    expect(
      extractCandidatePlanPathFromToolCall("write", { path: "src/index.ts" }, "/workspace/app"),
    ).toBeNull()
    expect(
      extractCandidatePlanPathFromToolCall("read", { path: "AGENTS.md" }, "/workspace/app"),
    ).toBeNull()
    expect(
      extractCandidatePlanPathFromToolCall(
        "read",
        { path: "/path/to/skills/brainstorming/SKILL.md" },
        "/workspace/app",
      ),
    ).toBeNull()
  })

  it("extracts plan file from Superpowers sdd-workspace / task-start / task-done shell commands", () => {
    expect(
      extractCandidatePlanPathFromToolCall(
        "shell",
        { command: "bash scripts/task-start docs/plans/2026-11-05-feature.md 2" },
        "/workspace/app",
      ),
    ).toBe("/workspace/app/docs/plans/2026-11-05-feature.md")
  })
})

describe("isPlanFilePathCandidate", () => {
  it("accepts docs/, .opencode/plan/, or *plan*.md and rejects README.md / CLAUDE.md", () => {
    expect(isPlanFilePathCandidate("/repo/docs/2026-11-05-login.md")).toBe(true)
    expect(isPlanFilePathCandidate("/Users/test/.opencode/plan/feature.md")).toBe(true)
    expect(isPlanFilePathCandidate("/repo/feature-plan.md")).toBe(true)
    expect(isPlanFilePathCandidate("/repo/README.md")).toBe(false)
    expect(isPlanFilePathCandidate("/repo/CLAUDE.md")).toBe(false)
  })
})

describe("discoverPlanFiles & loadParsedPlanFromFile", () => {
  it("discovers valid markdown plans in docs/ and merges Superpowers SDD ledger progress", async () => {
    const projectDir = makeTempProject()
    const docsPlansDir = path.join(projectDir, "docs", "plans")
    fs.mkdirSync(docsPlansDir, { recursive: true })

    const planPath = path.join(docsPlansDir, "2026-11-05-sidebar-plan.md")
    fs.writeFileSync(
      planPath,
      `# Sidebar Plugin Plan
### Task 1: Parser
- [ ] Step 1: Write test
- [ ] Step 2: Implement parser
### Task 2: TUI
- [ ] Step 1: Render sidebar
`,
      "utf8",
    )

    // Also create a README inside docs/ that has no tasks/checkboxes and should be ignored
    fs.writeFileSync(path.join(projectDir, "docs", "overview.md"), "# Overview\nJust docs.", "utf8")

    // Create Superpowers SDD ledger marking Task 1 complete
    const sddDir = path.join(projectDir, ".superpowers", "sdd", "2026-11-05-sidebar-plan")
    fs.mkdirSync(sddDir, { recursive: true })
    fs.writeFileSync(
      path.join(sddDir, "progress.md"),
      `# SDD ledger — plan: docs/plans/2026-11-05-sidebar-plan.md\nTask 1: complete (commits 111..222)\n`,
      "utf8",
    )

    const discovered = await discoverPlanFiles(projectDir, [])
    expect(discovered).toHaveLength(1)
    expect(discovered[0]?.filePath).toBe(planPath)
    expect(discovered[0]?.title).toBe("Sidebar Plugin Plan")
    expect(discovered[0]?.completedSteps).toBe(2)
    expect(discovered[0]?.totalSteps).toBe(3)

    const parsed = loadParsedPlanFromFile(planPath, projectDir)
    expect(parsed).not.toBeNull()
    expect(parsed?.completedSteps).toBe(2)
    expect(parsed?.activeStep?.taskTitle).toBe("Task 2: TUI")
    expect(parsed?.activeStep?.stepText).toBe("Step 1: Render sidebar")
  })
})
