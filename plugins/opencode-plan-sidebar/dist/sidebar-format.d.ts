import type { ParsedPlan, StepStatus, TaskStatus } from "./parser.js";
export interface SidebarStepViewModel {
    readonly prefix: "[x]" | "[▶]" | "[ ]";
    readonly text: string;
    readonly line: string;
    readonly status: StepStatus;
}
export interface SidebarTaskViewModel {
    readonly id: string;
    readonly icon: "✓" | "▶" | "";
    readonly title: string;
    readonly header: string;
    readonly status: TaskStatus;
    readonly steps: readonly SidebarStepViewModel[];
}
export interface SidebarViewModel {
    readonly headerTitle: string;
    readonly fileName: string;
    readonly filePath: string;
    readonly progressBar: string;
    readonly progressLabel: string;
    readonly percentage: number;
    readonly tasks: readonly SidebarTaskViewModel[];
}
export declare function renderProgressBar(percentage: number, width?: number): string;
export declare function computeFullWidthBarSize(containerWidth: number, progressLabel: string): number;
export declare function buildSidebarViewModel(plan: ParsedPlan, containerWidth?: number): SidebarViewModel;
