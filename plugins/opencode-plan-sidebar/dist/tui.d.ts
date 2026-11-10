import { Plugin } from "@opencode/plugin/tui";
import type { StepStatus, TaskStatus } from "./parser.js";
type TuiContext = Plugin.Context;
export declare function runPlanSelectorFlow(context: TuiContext, sessionID: string | undefined, rawArgument?: string): Promise<void>;
export declare function percentageColor(context: TuiContext, percentage: number): any;
export declare function stepColor(context: TuiContext, status: StepStatus): any;
export declare function taskColor(context: TuiContext, status: TaskStatus): any;
export declare const PlanSidebarTuiPlugin: Plugin.Definition;
export default PlanSidebarTuiPlugin;
