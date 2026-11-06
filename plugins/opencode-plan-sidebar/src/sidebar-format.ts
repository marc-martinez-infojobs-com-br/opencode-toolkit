import type { ParsedPlan, StepStatus, TaskStatus } from "./parser.js"

export interface SidebarStepViewModel {
  readonly prefix: "[x]" | "[▶]" | "[ ]"
  readonly text: string
  readonly line: string
  readonly status: StepStatus
}

export interface SidebarTaskViewModel {
  readonly id: string
  readonly icon: "✓" | "▶" | ""
  readonly title: string
  readonly header: string
  readonly status: TaskStatus
  readonly steps: readonly SidebarStepViewModel[]
}

export interface SidebarViewModel {
  readonly headerTitle: string
  readonly fileName: string
  readonly filePath: string
  readonly progressBar: string
  readonly progressLabel: string
  readonly percentage: number
  readonly tasks: readonly SidebarTaskViewModel[]
}

export function renderProgressBar(percentage: number, width = 14): string {
  const clamped = Math.max(0, Math.min(100, percentage))
  const filled = Math.round((clamped / 100) * width)
  const empty = Math.max(0, width - filled)
  return "█".repeat(filled) + "░".repeat(empty)
}

export function computeFullWidthBarSize(containerWidth: number, progressLabel: string): number {
  return Math.max(4, containerWidth - progressLabel.length - 1)
}

function stepPrefix(status: StepStatus): "[x]" | "[▶]" | "[ ]" {
  switch (status) {
    case "completed":
      return "[x]"
    case "active":
      return "[▶]"
    case "next":
    case "pending":
      return "[ ]"
  }
}

function taskIcon(status: TaskStatus): "✓" | "▶" | "" {
  switch (status) {
    case "completed":
      return "✓"
    case "active":
      return "▶"
    case "pending":
      return ""
  }
}

export function buildSidebarViewModel(plan: ParsedPlan, containerWidth = 36): SidebarViewModel {
  const progressLabel = `${plan.percentage}% (${plan.completedSteps}/${plan.totalSteps})`
  const barWidth = computeFullWidthBarSize(containerWidth, progressLabel)
  const progressBar = renderProgressBar(plan.percentage, barWidth)

  const tasks: SidebarTaskViewModel[] = plan.tasks.map((task) => {
    const icon = taskIcon(task.status)
    const prefix = icon ? `${icon} ` : ""
    const header = `${prefix}${task.title} (${task.completedSteps}/${task.totalSteps})`
    const steps: SidebarStepViewModel[] = task.steps.map((step) => {
      const stepMarker = stepPrefix(step.status)
      return {
        prefix: stepMarker,
        text: step.text,
        line: `${stepMarker} ${step.text}`,
        status: step.status,
      }
    })
    return {
      id: task.id,
      icon,
      title: task.title,
      header,
      status: task.status,
      steps,
    }
  })

  return {
    headerTitle: plan.title,
    fileName: plan.fileName,
    filePath: plan.filePath,
    progressBar,
    progressLabel,
    percentage: plan.percentage,
    tasks,
  }
}
