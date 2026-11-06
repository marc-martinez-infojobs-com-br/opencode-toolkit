import { describe, expect, it, vi } from "vitest"
import { parsePlanMarkdown } from "../src/parser.js"
import {
  buildSidebarViewModel,
  computeFullWidthBarSize,
  renderProgressBar,
} from "../src/sidebar-format.js"
import PlanSidebarTuiPlugin, { runPlanSelectorFlow } from "../src/tui.js"

describe("sidebar-format", () => {
  it("renders a proportional ASCII progress bar", () => {
    expect(renderProgressBar(0, 10)).toBe("░░░░░░░░░░")
    expect(renderProgressBar(50, 10)).toBe("█████░░░░░")
    expect(renderProgressBar(100, 10)).toBe("██████████")
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
})

