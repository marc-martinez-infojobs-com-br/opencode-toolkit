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
  readonly progressBarFilled: string
  readonly progressBarEmpty: string
  readonly progressLabel: string
  readonly percentageText: string
  readonly stepsCountText: string
  readonly percentage: number
  readonly tasks: readonly SidebarTaskViewModel[]
}

export function renderProgressBarParts(
  percentage: number,
  width = 14,
): { filled: string; empty: string } {
  const clamped = Math.max(0, Math.min(100, percentage))
  const filled = Math.round((clamped / 100) * width)
  const empty = Math.max(0, width - filled)
  return {
    filled: "█".repeat(filled),
    empty: "░".repeat(empty),
  }
}

export function renderProgressBar(percentage: number, width = 14): string {
  const parts = renderProgressBarParts(percentage, width)
  return parts.filled + parts.empty
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
  const percentageText = `${plan.percentage}%`
  const stepsCountText = `(${plan.completedSteps}/${plan.totalSteps})`
  const progressLabel = `${percentageText} ${stepsCountText}`
  const barWidth = computeFullWidthBarSize(containerWidth, progressLabel)
  const barParts = renderProgressBarParts(plan.percentage, barWidth)
  const progressBar = barParts.filled + barParts.empty

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
    progressBarFilled: barParts.filled,
    progressBarEmpty: barParts.empty,
    progressLabel,
    percentageText,
    stepsCountText,
    percentage: plan.percentage,
    tasks,
  }
}
