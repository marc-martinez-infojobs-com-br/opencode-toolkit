import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import ServerPlugin from "../src/index.js"

const tempDirs: string[] = []

function makeTempProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-plan-srv-"))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

function createMockServerContext(projectDir: string) {
  const storageMap = new Map<string, unknown>()
  let registeredRpcHandlers: Record<string, (input: any, ctx?: any) => Promise<any>> = {}
  const emittedEvents: Array<{ name: string; data: any }> = []
  const toolAfterHooks: Array<(event: any) => Promise<void> | void> = []
  const sessionContextHooks: Array<(event: any) => Promise<void> | void> = []

  const ctx = {
    location: {
      directory: projectDir,
      project: { id: "proj_1", directory: projectDir, canonical: projectDir },
    },
    options: {},
    storage: {
      get: vi.fn(async (key: string) => storageMap.get(key)),
      set: vi.fn(async (key: string, value: unknown) => {
        storageMap.set(key, value)
      }),
      remove: vi.fn(async (key: string) => {
        storageMap.delete(key)
      }),
      scan: vi.fn(async () => ({ entries: [] })),
    },
    rpc: {
      register: vi.fn(async (_def: any, handlers: any) => {
        registeredRpcHandlers = handlers
        return {
          events: {
            emit: vi.fn(async (name: string, data: any) => {
              emittedEvents.push({ name, data })
            }),
          },
          dispose: vi.fn(async () => {}),
        }
      }),
    },
    tool: {
      hook: vi.fn(async (name: string, cb: any) => {
        if (name === "execute.after") toolAfterHooks.push(cb)
        return { dispose: vi.fn(async () => {}) }
      }),
    },
    session: {
      hook: vi.fn(async (name: string, cb: any) => {
        if (name === "context") sessionContextHooks.push(cb)
        return { dispose: vi.fn(async () => {}) }
      }),
    },
  }

  return {
    ctx: ctx as any,
    getRpcHandlers: () => registeredRpcHandlers,
    emittedEvents,
    toolAfterHooks,
    sessionContextHooks,
  }
}

describe("ServerPlugin", () => {
  it("auto-detects a plan when write/edit creates a plan in docs/ and emits updated RPC event", async () => {
    const projectDir = makeTempProject()
    const docsDir = path.join(projectDir, "docs")
    fs.mkdirSync(docsDir, { recursive: true })
    const planFile = path.join(docsDir, "2026-11-05-plan.md")
    fs.writeFileSync(
      planFile,
      `# Test Plan\n### Task 1: Core\n- [x] Step 1: Done\n- [ ] Step 2: Doing\n- [ ] Step 3: Next\n`,
      "utf8",
    )

    const { ctx, getRpcHandlers, emittedEvents, toolAfterHooks, sessionContextHooks } =
      createMockServerContext(projectDir)

    const cleanup = await ServerPlugin.setup(ctx)

    expect(toolAfterHooks).toHaveLength(1)
    await toolAfterHooks[0]!({
      tool: "write",
      sessionID: "ses_abc",
      status: "completed",
      input: { path: "docs/2026-11-05-plan.md" },
      result: { content: "ok" },
    })

    expect(emittedEvents).toHaveLength(1)
    expect(emittedEvents[0]?.name).toBe("updated")
    expect(emittedEvents[0]?.data.sessionID).toBe("ses_abc")
    expect(emittedEvents[0]?.data.plan?.title).toBe("Test Plan")
    expect(emittedEvents[0]?.data.plan?.completedSteps).toBe(1)
    expect(emittedEvents[0]?.data.plan?.totalSteps).toBe(3)

    const getRes = await getRpcHandlers().get!({ sessionID: "ses_abc" })
    expect(getRes.plan?.activeStep?.stepText).toBe("Step 2: Doing")
    expect(getRes.plan?.nextStep?.stepText).toBe("Step 3: Next")

    // Verify context hook injects step tracking instruction for active session
    const contextEvent = { sessionID: "ses_abc", system: [] as Array<{ type: string; text: string }> }
    await sessionContextHooks[0]!(contextEvent)
    expect(contextEvent.system).toHaveLength(1)
    expect(contextEvent.system[0]?.text).toContain("Step 2: Doing")

    if (typeof cleanup === "function") await cleanup()
  })

  it("allows manual selection and clearing of a plan via RPC select and clear", async () => {
    const projectDir = makeTempProject()
    const planFile = path.join(projectDir, "custom-plan.md")
    fs.writeFileSync(
      planFile,
      `# Manual Plan\n### Task 1: Init\n- [ ] Step 1: First\n`,
      "utf8",
    )

    const { ctx, getRpcHandlers, emittedEvents } = createMockServerContext(projectDir)
    const cleanup = await ServerPlugin.setup(ctx)

    const selectRes = await getRpcHandlers().select!({
      sessionID: "ses_manual",
      filePath: "custom-plan.md",
    })
    expect(selectRes.ok).toBe(true)
    expect(selectRes.plan?.title).toBe("Manual Plan")

    const clearRes = await getRpcHandlers().clear!({ sessionID: "ses_manual" })
    expect(clearRes.ok).toBe(true)
    expect(emittedEvents.at(-1)?.data).toEqual({ sessionID: "ses_manual", plan: null })

    if (typeof cleanup === "function") await cleanup()
  })

  it("isolates plans per sessionID and does NOT auto-bind merely from reading a file", async () => {
    const projectDir = makeTempProject()
    const docsDir = path.join(projectDir, "docs")
    fs.mkdirSync(docsDir, { recursive: true })
    const planFile = path.join(docsDir, "2026-11-05-plan.md")
    fs.writeFileSync(
      planFile,
      `# Isolated Plan\n### Task 1: Core\n- [ ] Step 1: Work\n`,
      "utf8",
    )

    const { ctx, getRpcHandlers, toolAfterHooks } = createMockServerContext(projectDir)
    const cleanup = await ServerPlugin.setup(ctx)

    // Reading a plan file in ses_read should NOT auto-bind it
    await toolAfterHooks[0]!({
      tool: "read",
      sessionID: "ses_read",
      status: "completed",
      input: { path: "docs/2026-11-05-plan.md" },
      result: { content: "ok" },
    })
    const readSessionRes = await getRpcHandlers().get!({ sessionID: "ses_read" })
    expect(readSessionRes.plan).toBeNull()

    // Selecting or writing in ses_1 binds ONLY to ses_1, leaving ses_2 with null
    await getRpcHandlers().select!({
      sessionID: "ses_1",
      filePath: "docs/2026-11-05-plan.md",
    })
    const ses1Res = await getRpcHandlers().get!({ sessionID: "ses_1" })
    const ses2Res = await getRpcHandlers().get!({ sessionID: "ses_2" })
    expect(ses1Res.plan?.title).toBe("Isolated Plan")
    expect(ses2Res.plan).toBeNull()

    if (typeof cleanup === "function") await cleanup()
  })

  it("does NOT auto-bind a specification file without checkboxes and clears stale non-plan paths on get", async () => {
    const projectDir = makeTempProject()
    const specsDir = path.join(projectDir, "Docs", "PB68062", "specs")
    fs.mkdirSync(specsDir, { recursive: true })
    const specFile = path.join(specsDir, "2026-11-09-fcm-ttl-priority-collapse-key-spec.md")
    fs.writeFileSync(
      specFile,
      `# Especificación de Diseño — Configuración de ttl, priority y collapse_key en Push Android
## 1. Objetivo y Contexto
Calibrar parámetros.
## 2. Alcance
Incluido.
## 3. Enfoques Considerados
Enfoque 1.
`,
      "utf8",
    )

    const { ctx, getRpcHandlers, emittedEvents, toolAfterHooks } =
      createMockServerContext(projectDir)
    const cleanup = await ServerPlugin.setup(ctx)

    await toolAfterHooks[0]!({
      tool: "write",
      sessionID: "ses_spec",
      status: "completed",
      input: { path: "Docs/PB68062/specs/2026-11-09-fcm-ttl-priority-collapse-key-spec.md" },
      result: { content: "ok" },
    })

    expect(emittedEvents).toHaveLength(0)
    const getRes = await getRpcHandlers().get!({ sessionID: "ses_spec" })
    expect(getRes.plan).toBeNull()

    // Simulate a session that had the spec path stored previously
    await ctx.storage.set("session-plan/ses_stale_spec", { filePath: specFile })
    const staleRes = await getRpcHandlers().get!({ sessionID: "ses_stale_spec" })
    expect(staleRes.plan).toBeNull()
    expect(ctx.storage.remove).toHaveBeenCalledWith("session-plan/ses_stale_spec")

    if (typeof cleanup === "function") await cleanup()
  })
})
