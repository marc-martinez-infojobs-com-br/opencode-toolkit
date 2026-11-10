import fs from "node:fs"
import path from "node:path"
import { Plugin } from "@opencode/plugin"
import {
  discoverPlanFiles,
  extractCandidatePlanPathFromToolCall,
  isPlanFilePathCandidate,
  loadParsedPlanFromFile,
  resolveLedgerPathForPlan,
} from "./detector.js"
import type { ParsedPlan } from "./parser.js"
import { PlanRpc } from "./rpc.js"

function storageKeyForSession(sessionID: string): string {
  return `session-plan/${sessionID}`
}

export const PlanSidebarServerPlugin = Plugin.define({
  id: "opencode.plan-sidebar.server",
  async setup(ctx) {
    const projectDir = ctx.location.directory
    const sessionPlanPaths = new Map<string, string>()
    const sessionWatchers = new Map<string, () => void>()

    let emitUpdate: ((sessionID: string, plan: ParsedPlan | null) => Promise<void>) | undefined

    function stopWatchingSession(sessionID: string): void {
      const dispose = sessionWatchers.get(sessionID)
      if (dispose) {
        dispose()
        sessionWatchers.delete(sessionID)
      }
    }

    function watchSessionPlan(sessionID: string, planFilePath: string): void {
      stopWatchingSession(sessionID)

      const watchers: fs.FSWatcher[] = []
      let debounceTimer: ReturnType<typeof setTimeout> | null = null

      const triggerRefresh = () => {
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          const parsed = loadParsedPlanFromFile(planFilePath, projectDir)
          if (parsed && emitUpdate) {
            void emitUpdate(sessionID, parsed)
          }
        }, 80)
      }

      try {
        if (fs.existsSync(planFilePath)) {
          watchers.push(fs.watch(planFilePath, triggerRefresh))
        }
        const ledgerPath = resolveLedgerPathForPlan(planFilePath, projectDir)
        if (ledgerPath && fs.existsSync(ledgerPath)) {
          watchers.push(fs.watch(ledgerPath, triggerRefresh))
        }
      } catch {
        // Ignore fs.watch errors on unsupported filesystems
      }

      sessionWatchers.set(sessionID, () => {
        if (debounceTimer) clearTimeout(debounceTimer)
        for (const w of watchers) {
          try {
            w.close()
          } catch {
            // ignore
          }
        }
      })
    }

    async function resolveSessionPlanPath(sessionID: string): Promise<string | null> {
      const mem = sessionPlanPaths.get(sessionID)
      if (mem) return mem
      try {
        const stored = await ctx.storage.get(storageKeyForSession(sessionID))
        if (
          stored &&
          typeof stored === "object" &&
          !Array.isArray(stored) &&
          typeof (stored as Record<string, unknown>).filePath === "string"
        ) {
          const filePath = (stored as { filePath: string }).filePath
          sessionPlanPaths.set(sessionID, filePath)
          watchSessionPlan(sessionID, filePath)
          return filePath
        }
      } catch {
        // ignore storage errors
      }
      return null
    }

    async function bindPlanToSession(
      sessionID: string,
      rawFilePath: string,
    ): Promise<ParsedPlan | null> {
      const resolved = path.isAbsolute(rawFilePath)
        ? rawFilePath
        : path.resolve(projectDir, rawFilePath)
      const parsed = loadParsedPlanFromFile(resolved, projectDir)
      if (!parsed || parsed.totalSteps === 0) return null

      sessionPlanPaths.set(sessionID, resolved)
      watchSessionPlan(sessionID, resolved)
      try {
        await ctx.storage.set(storageKeyForSession(sessionID), { filePath: resolved })
      } catch {
        // ignore storage errors
      }
      if (emitUpdate) {
        await emitUpdate(sessionID, parsed)
      }
      return parsed
    }

    const rpcRegistration = await ctx.rpc.register(PlanRpc, {
      get: async ({ sessionID }) => {
        const planPath = await resolveSessionPlanPath(sessionID)
        if (!planPath) return { plan: null }
        const parsed = loadParsedPlanFromFile(planPath, projectDir)
        if (!parsed) {
          sessionPlanPaths.delete(sessionID)
          stopWatchingSession(sessionID)
          try {
            await ctx.storage.remove(storageKeyForSession(sessionID))
          } catch {
            // ignore
          }
          return { plan: null }
        }
        return { plan: parsed }
      },
      discover: async ({ directory }) => {
        const targetDir = directory && directory.trim() ? directory.trim() : projectDir
        const plans = await discoverPlanFiles(targetDir)
        return { plans }
      },
      select: async ({ sessionID, filePath }) => {
        const resolved = path.isAbsolute(filePath)
          ? filePath
          : path.resolve(projectDir, filePath)
        if (!fs.existsSync(resolved)) {
          return {
            ok: false,
            plan: null,
            error: `No se encontró el archivo: ${filePath}`,
          }
        }
        const parsed = await bindPlanToSession(sessionID, resolved)
        if (!parsed) {
          return {
            ok: false,
            plan: null,
            error: `El archivo no contiene etapas o checkboxes de plan válidos: ${filePath}`,
          }
        }
        return { ok: true, plan: parsed }
      },
      clear: async ({ sessionID }) => {
        sessionPlanPaths.delete(sessionID)
        stopWatchingSession(sessionID)
        try {
          await ctx.storage.remove(storageKeyForSession(sessionID))
        } catch {
          // ignore
        }
        if (emitUpdate) {
          await emitUpdate(sessionID, null)
        }
        return { ok: true }
      },
    })

    emitUpdate = async (sessionID, plan) => {
      try {
        await rpcRegistration.events.emit("updated", { sessionID, plan })
      } catch {
        // ignore emit errors when no subscriber is connected
      }
    }

    const toolHookReg = await ctx.tool.hook("execute.after", async (event) => {
      if (event.status !== "completed") return
      const sessionID = String(event.sessionID)
      const currentPlanPath = await resolveSessionPlanPath(sessionID)

      const candidate = extractCandidatePlanPathFromToolCall(
        event.tool,
        event.input,
        projectDir,
      )

      if (candidate) {
        if (currentPlanPath && path.resolve(candidate) === path.resolve(currentPlanPath)) {
          const refreshed = loadParsedPlanFromFile(currentPlanPath, projectDir)
          if (refreshed && emitUpdate) {
            await emitUpdate(sessionID, refreshed)
          }
          return
        }

        const isWriteLike =
          event.tool === "write" || event.tool === "edit" || event.tool === "patch"
        const isReadOnUnboundSession = event.tool === "read" && !currentPlanPath
        const shouldAutoBind =
          (isWriteLike || isReadOnUnboundSession) && isPlanFilePathCandidate(candidate)

        if (shouldAutoBind || event.tool === "shell" || event.tool === "bash") {
          await bindPlanToSession(sessionID, candidate)
          return
        }
      }

      // Also refresh if any shell command ran while a plan is active (e.g. Superpowers task-done)
      if (currentPlanPath && (event.tool === "shell" || event.tool === "bash")) {
        const refreshed = loadParsedPlanFromFile(currentPlanPath, projectDir)
        if (refreshed && emitUpdate) {
          await emitUpdate(sessionID, refreshed)
        }
      }
    })

    const sessionContextReg = await ctx.session.hook("context", async (event) => {
      const sessionID = String(event.sessionID)
      const planPath = await resolveSessionPlanPath(sessionID)
      if (!planPath) return
      const parsed = loadParsedPlanFromFile(planPath, projectDir)
      if (!parsed || !parsed.activeStep) return

      const nextInfo = parsed.nextStep
        ? ` | Próximo paso: [${parsed.nextStep.taskTitle}] ${parsed.nextStep.stepText}`
        : ""
      event.system.push({
        type: "text",
        text: `[Plan Activo en Sidebar: ${parsed.filePath} (${parsed.completedSteps}/${parsed.totalSteps} - ${parsed.percentage}%)] Paso en curso: [${parsed.activeStep.taskTitle}] ${parsed.activeStep.stepText}${nextInfo}. Cuando completes un paso del plan, actualiza su checkbox de "- [ ]" a "- [x]" en ${parsed.filePath} para reflejar el progreso en el Sidebar.`,
      })
    })

    return async () => {
      for (const sessionID of sessionWatchers.keys()) {
        stopWatchingSession(sessionID)
      }
      await sessionContextReg.dispose()
      await toolHookReg.dispose()
      await rpcRegistration.dispose()
    }
  },
})

export default PlanSidebarServerPlugin
