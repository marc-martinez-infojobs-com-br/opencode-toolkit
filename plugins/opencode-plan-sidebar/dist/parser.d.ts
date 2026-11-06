export type StepStatus = "completed" | "active" | "next" | "pending";
export type TaskStatus = "completed" | "active" | "pending";
export interface PlanStep {
    readonly text: string;
    readonly checked: boolean;
    readonly status: StepStatus;
    readonly line: number;
}
export interface PlanTask {
    readonly id: string;
    readonly title: string;
    readonly taskNumber?: number;
    readonly status: TaskStatus;
    readonly completedSteps: number;
    readonly totalSteps: number;
    readonly steps: readonly PlanStep[];
}
export interface PlanPointer {
    readonly taskTitle: string;
    readonly stepText: string;
    readonly taskIndex: number;
    readonly stepIndex: number;
}
export interface ParsedPlan {
    readonly title: string;
    readonly filePath: string;
    readonly fileName: string;
    readonly totalSteps: number;
    readonly completedSteps: number;
    readonly percentage: number;
    readonly activeStep: PlanPointer | null;
    readonly nextStep: PlanPointer | null;
    readonly tasks: readonly PlanTask[];
    readonly updatedAt: number;
}
export declare function isLikelyPlanContent(markdown: string): boolean;
export declare function parsePlanMarkdown(markdown: string, filePath: string, ledgerContent?: string): ParsedPlan;
