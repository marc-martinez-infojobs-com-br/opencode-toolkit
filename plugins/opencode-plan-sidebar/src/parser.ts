import path from "node:path"

export type StepStatus = "completed" | "active" | "next" | "pending"
export type TaskStatus = "completed" | "active" | "pending"

export interface PlanStep {
  readonly text: string
  readonly checked: boolean
  readonly status: StepStatus
  readonly line: number
}

export interface PlanTask {
  readonly id: string
  readonly title: string
  readonly taskNumber?: number
  readonly status: TaskStatus
  readonly completedSteps: number
  readonly totalSteps: number
  readonly steps: readonly PlanStep[]
}

export interface PlanPointer {
  readonly taskTitle: string
  readonly stepText: string
  readonly taskIndex: number
  readonly stepIndex: number
}

export interface ParsedPlan {
  readonly title: string
  readonly filePath: string
  readonly fileName: string
  readonly totalSteps: number
  readonly completedSteps: number
  readonly percentage: number
  readonly activeStep: PlanPointer | null
  readonly nextStep: PlanPointer | null
  readonly tasks: readonly PlanTask[]
  readonly updatedAt: number
}

const HEADING_RE = /^(#{1,4})\s+(.+?)\s*$/
const CHECKBOX_RE = /^\s*[-*+]\s+\[([ xX~▶>-])\]\s+(.+?)\s*$/
const TASK_NUMBER_RE = /^(?:task|tarea|fase|phase|etapa|stage|paso|step)\s*#?(\d+)\b/i
const LEDGER_COMPLETE_RE = /^Task\s+(\d+)\s*:\s*complete\b/im

function stripMarkdownFormatting(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim()
}

function parseCompletedLedgerTasks(ledgerContent?: string): Set<number> {
  const completed = new Set<number>()
  if (!ledgerContent) return completed
  for (const line of ledgerContent.split(/\r?\n/)) {
    const match = line.match(LEDGER_COMPLETE_RE)
    if (match?.[1]) {
      completed.add(Number.parseInt(match[1], 10))
    }
  }
  return completed
}

export function isLikelyPlanContent(markdown: string): boolean {
  if (!markdown || typeof markdown !== "string") return false
  const lines = markdown.split(/\r?\n/)
  let insideCodeBlock = false
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      insideCodeBlock = !insideCodeBlock
      continue
    }
    if (insideCodeBlock) continue
    if (CHECKBOX_RE.test(line)) return true
  }
  return false
}

export function parsePlanMarkdown(
  markdown: string,
  filePath: string,
  ledgerContent?: string,
): ParsedPlan {
  const lines = markdown.split(/\r?\n/)
  const fileName = path.basename(filePath)
  let documentTitle = fileName.replace(/\.md$/i, "")
  let foundH1 = false

  interface MutableTask {
    title: string
    taskNumber?: number
    steps: { text: string; checked: boolean; line: number }[]
  }

  const rawTasks: MutableTask[] = []
  let currentTask: MutableTask | null = null
  let insideCodeBlock = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ""
    if (/^\s*```/.test(line)) {
      insideCodeBlock = !insideCodeBlock
      continue
    }
    if (insideCodeBlock) continue

    const headingMatch = line.match(HEADING_RE)
    if (headingMatch) {
      const level = headingMatch[1]?.length ?? 1
      const headingText = stripMarkdownFormatting(headingMatch[2] ?? "")
      if (level === 1 && !foundH1) {
        documentTitle = headingText
        foundH1 = true
        continue
      }
      if (level >= 2) {
        const numberMatch = headingText.match(TASK_NUMBER_RE)
        const numStr = numberMatch?.[1] ?? numberMatch?.[2]
        const taskNumber = numStr ? Number.parseInt(numStr, 10) : undefined
        currentTask = {
          title: headingText,
          taskNumber,
          steps: [],
        }
        rawTasks.push(currentTask)
      }
      continue
    }

    const checkboxMatch = line.match(CHECKBOX_RE)
    if (checkboxMatch) {
      const marker = (checkboxMatch[1] ?? " ").toLowerCase()
      const checked = marker === "x"
      const stepText = stripMarkdownFormatting(checkboxMatch[2] ?? "")
      if (!currentTask) {
        currentTask = {
          title: "Pasos del plan",
          steps: [],
        }
        rawTasks.push(currentTask)
      }
      currentTask.steps.push({
        text: stepText,
        checked,
        line: i + 1,
      })
    }
  }

  // Keep only tasks that actually contain steps. If the plan has numbered Phase/Task sections
  // (e.g., "### Fase 1...", "### Task 1..."), ignore unnumbered summary sections like
  // "## Seguimiento de Fases y Tasks en Azure DevOps".
  const tasksWithSteps = rawTasks.filter((t) => t.steps.length > 0)
  const numberedTasksWithSteps = tasksWithSteps.filter((t) => t.taskNumber !== undefined)
  const effectiveRawTasks: MutableTask[] =
    numberedTasksWithSteps.length > 0 ? numberedTasksWithSteps : tasksWithSteps

  const ledgerCompletedTasks = parseCompletedLedgerTasks(ledgerContent)

  for (const task of effectiveRawTasks) {
    if (task.taskNumber !== undefined && ledgerCompletedTasks.has(task.taskNumber)) {
      for (const step of task.steps) {
        step.checked = true
      }
    }
  }

  let activeStep: PlanPointer | null = null
  let nextStep: PlanPointer | null = null
  let totalSteps = 0
  let completedSteps = 0

  const tasks: PlanTask[] = effectiveRawTasks.map((rawTask, taskIndex) => {
    let taskCompleted = 0
    const steps: PlanStep[] = rawTask.steps.map((rawStep, stepIndex) => {
      totalSteps++
      if (rawStep.checked) {
        completedSteps++
        taskCompleted++
        return {
          text: rawStep.text,
          checked: true,
          status: "completed",
          line: rawStep.line,
        }
      }

      if (!activeStep) {
        activeStep = {
          taskTitle: rawTask.title,
          stepText: rawStep.text,
          taskIndex,
          stepIndex,
        }
        return {
          text: rawStep.text,
          checked: false,
          status: "active",
          line: rawStep.line,
        }
      }

      if (!nextStep) {
        nextStep = {
          taskTitle: rawTask.title,
          stepText: rawStep.text,
          taskIndex,
          stepIndex,
        }
        return {
          text: rawStep.text,
          checked: false,
          status: "next",
          line: rawStep.line,
        }
      }

      return {
        text: rawStep.text,
        checked: false,
        status: "pending",
        line: rawStep.line,
      }
    })

    const hasActive = steps.some((s) => s.status === "active")
    const status: TaskStatus =
      taskCompleted === steps.length && steps.length > 0
        ? "completed"
        : hasActive || taskCompleted > 0
          ? "active"
          : "pending"

    return {
      id: `task-${taskIndex + 1}`,
      title: rawTask.title,
      taskNumber: rawTask.taskNumber,
      status,
      completedSteps: taskCompleted,
      totalSteps: steps.length,
      steps,
    }
  })

  const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

  return {
    title: documentTitle,
    filePath,
    fileName,
    totalSteps,
    completedSteps,
    percentage,
    activeStep,
    nextStep,
    tasks,
    updatedAt: Date.now(),
  }
}
