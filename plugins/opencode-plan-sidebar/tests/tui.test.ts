import { describe, expect, it, vi } from "vitest"
import { parsePlanMarkdown } from "../src/parser.js"
import {
  buildSidebarViewModel,
  computeFullWidthBarSize,
  renderProgressBar,
  renderProgressBarParts,
} from "../src/sidebar-format.js"
import PlanSidebarTuiPlugin, {
  percentageColor,
  runPlanSelectorFlow,
  stepColor,
  taskColor,
} from "../src/tui.js"

describe("sidebar-format", () => {
  it("renders a proportional ASCII progress bar", () => {
    expect(renderProgressBar(0, 10)).toBe("░░░░░░░░░░")
    expect(renderProgressBar(50, 10)).toBe("█████░░░░░")
    expect(renderProgressBar(100, 10)).toBe("██████████")
  })

  it("splits the progress bar into filled and empty segments", () => {
    expect(renderProgressBarParts(0, 10)).toEqual({ filled: "", empty: "░░░░░░░░░░" })
    expect(renderProgressBarParts(50, 10)).toEqual({ filled: "█████", empty: "░░░░░" })
    expect(renderProgressBarParts(100, 10)).toEqual({ filled: "██████████", empty: "" })
  })

  it("computes full-width progress bar size leaving exact space for the percentage and task count label", () => {
    const label = "0% (0/16)" // length 9
    const totalWidth = 36
    const barSize = computeFullWidthBarSize(totalWidth, label)
    // barSize + 1 space + label.length (9) === 36 => barSize === 26
    expect(barSize).toBe(26)
    expect(barSize + 1 + label.length).toBe(totalWidth)
  })

  it("builds the vertical view model with full-width progress bar and without active/next summary banners", () => {
    const plan = parsePlanMarkdown(
      `# PBI #67913
### Task 1: Client
- [x] Step 1: Model
- [x] Step 2: Interface
### Task 2: Controller
- [x] Step 1: Test
- [ ] Step 2: Action
- [ ] Step 3: Verify
### Task 3: Future
- [ ] Step 1: Deploy
`,
      "/workspace/docs/plans/p67913.md",
    )

    const containerWidth = 36
    const vm = buildSidebarViewModel(plan, containerWidth)
    expect(vm.headerTitle).toBe("PBI #67913")
    expect(vm.progressLabel).toBe("50% (3/6)")
    expect(vm.percentageText).toBe("50%")
    expect(vm.stepsCountText).toBe("(3/6)")
    expect(vm.progressBarFilled + vm.progressBarEmpty).toBe(vm.progressBar)
    expect(vm.progressBarFilled.length).toBeGreaterThan(0)
    expect(vm.progressBarEmpty.length).toBeGreaterThan(0)
    expect(vm.progressBar.length + 1 + vm.progressLabel.length).toBe(containerWidth)
    expect("activeBanner" in vm).toBe(false)
    expect("nextBanner" in vm).toBe(false)

    expect(vm.tasks).toHaveLength(3)
    expect(vm.tasks[0]?.icon).toBe("✓")
    expect(vm.tasks[0]?.header).toBe("✓ Task 1: Client (2/2)")
    expect(vm.tasks[0]?.steps.map((s) => s.line)).toEqual([
      "[x] Step 1: Model",
      "[x] Step 2: Interface",
    ])

    expect(vm.tasks[1]?.icon).toBe("▶")
    expect(vm.tasks[1]?.header).toBe("▶ Task 2: Controller (1/3)")
    expect(vm.tasks[1]?.steps.map((s) => `${s.prefix} ${s.text}`)).toEqual([
      "[x] Step 1: Test",
      "[▶] Step 2: Action",
      "[ ] Step 3: Verify",
    ])

    expect(vm.tasks[2]?.icon).toBe("")
    expect(vm.tasks[2]?.header).toBe("Task 3: Future (0/1)")
    expect(vm.tasks[2]?.steps.map((s) => s.line)).toEqual(["[ ] Step 1: Deploy"])
  })
})

describe("TUI color helpers (Quota theme pattern)", () => {
  const mockThemeContext = {
    theme: {
      text: {
        base: "#ffffff",
        muted: "#666666",
        feedback: {
          success: {
            base: "#7ee787",
          },
        },
      },
    },
  } as any

  it("colors percentage muted at 0% and success green when > 0%", () => {
    expect(percentageColor(mockThemeContext, 0)).toBe("#666666")
    expect(percentageColor(mockThemeContext, 8)).toBe("#7ee787")
    expect(percentageColor(mockThemeContext, 100)).toBe("#7ee787")
  })

  it("colors completed tasks in success green, active in base, and pending in muted", () => {
    expect(taskColor(mockThemeContext, "completed")).toBe("#7ee787")
    expect(taskColor(mockThemeContext, "active")).toBe("#ffffff")
    expect(taskColor(mockThemeContext, "pending")).toBe("#666666")
  })

  it("colors completed steps in success green, active in base, and next/pending in muted", () => {
    expect(stepColor(mockThemeContext, "completed")).toBe("#7ee787")
    expect(stepColor(mockThemeContext, "active")).toBe("#ffffff")
    expect(stepColor(mockThemeContext, "next")).toBe("#666666")
    expect(stepColor(mockThemeContext, "pending")).toBe("#666666")
  })
})

describe("PlanSidebarTuiPlugin", () => {
  it("registers app and sidebar.content slots on setup", () => {
    const slots: string[] = []
    const mockContext = {
      ui: {
        slot: vi.fn((claim: any) => {
          slots.push(claim.append)
          return () => {}
        }),
      },
    }

    const cleanup = PlanSidebarTuiPlugin.setup(mockContext as any)
    expect(slots).toEqual(["app", "sidebar.content"])
    if (typeof cleanup === "function") cleanup()
  })

  it("runPlanSelectorFlow selects a plan directly when arguments are provided or via dialog when empty", async () => {
    const selectMock = vi.fn(async ({ filePath }: any) => ({
      ok: true,
      plan: parsePlanMarkdown("# My Plan\n- [ ] Step 1", filePath),
    }))
    const discoverMock = vi.fn(async () => ({
      plans: [
        {
          filePath: "/repo/docs/plan-a.md",
          displayPath: "docs/plan-a.md",
          title: "Plan A",
          completedSteps: 1,
          totalSteps: 3,
          percentage: 33,
          updatedAt: 1000,
        },
      ],
    }))
    const clearMock = vi.fn(async () => ({ ok: true }))
    const toastMock = vi.fn()
    const dialogSelectMock = vi.fn(async () => "/repo/docs/plan-a.md")

    const mockContext = {
      location: { directory: "/repo" },
      data: { location: { default: () => ({ directory: "/repo" }) } },
      client: {
        rpc: () => ({
          select: selectMock,
          discover: discoverMock,
          clear: clearMock,
        }),
      },
      ui: {
        toast: { show: toastMock },
        dialog: {
          select: dialogSelectMock,
          prompt: vi.fn(),
        },
      },
    }

    // 1. Direct path argument
    await runPlanSelectorFlow(mockContext as any, "ses_1", "docs/direct.md")
    expect(selectMock).toHaveBeenCalledWith(
      { sessionID: "ses_1", filePath: "docs/direct.md" },
      expect.anything(),
    )

    // 2. Interactive dialog selection
    await runPlanSelectorFlow(mockContext as any, "ses_1", undefined)
    expect(discoverMock).toHaveBeenCalled()
    expect(dialogSelectMock).toHaveBeenCalled()
    expect(selectMock).toHaveBeenCalledWith(
      { sessionID: "ses_1", filePath: "/repo/docs/plan-a.md" },
      expect.anything(),
    )
  })

  it("creates a new session, binds the plan, and navigates to the session when run from Home (sessionID undefined)", async () => {
    const selectMock = vi.fn(async ({ filePath }: any) => ({
      ok: true,
      plan: parsePlanMarkdown("# Plan A\n- [ ] Step 1", filePath),
    }))
    const discoverMock = vi.fn(async () => ({
      plans: [
        {
          filePath: "/repo/docs/plan-a.md",
          displayPath: "docs/plan-a.md",
          title: "Plan A",
          completedSteps: 1,
          totalSteps: 3,
          percentage: 33,
          updatedAt: 1000,
        },
      ],
    }))
    const clearMock = vi.fn(async () => ({ ok: true }))
    const createSessionMock = vi.fn(async () => ({ id: "ses_created_from_home" }))
    const navigateMock = vi.fn()
    const toastMock = vi.fn()
    const dialogSelectMock = vi.fn(async () => "/repo/docs/plan-a.md")

    const mockContext = {
      location: { directory: "/repo" },
      data: { location: { default: () => ({ directory: "/repo" }) } },
      client: {
        rpc: () => ({
          select: selectMock,
          discover: discoverMock,
          clear: clearMock,
        }),
        session: {
          create: createSessionMock,
        },
      },
      ui: {
        toast: { show: toastMock },
        dialog: {
          select: dialogSelectMock,
          prompt: vi.fn(),
        },
        router: {
          navigate: navigateMock,
        },
      },
    }

    await runPlanSelectorFlow(mockContext as any, undefined, undefined)

    expect(discoverMock).toHaveBeenCalled()
    expect(dialogSelectMock).toHaveBeenCalled()
    expect(createSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Plan A",
        location: { directory: "/repo" },
      }),
      expect.anything(),
    )
    expect(selectMock).toHaveBeenCalledWith(
      { sessionID: "ses_created_from_home", filePath: "/repo/docs/plan-a.md" },
      expect.anything(),
    )
    expect(navigateMock).toHaveBeenCalledWith({
      type: "session",
      sessionID: "ses_created_from_home",
    })
  })
})

