import { Plugin } from "@opencode/plugin/tui";
type TuiContext = Plugin.Context;
export declare function runPlanSelectorFlow(context: TuiContext, sessionID: string | undefined, rawArgument?: string): Promise<void>;
export declare const PlanSidebarTuiPlugin: Plugin.Definition;
export default PlanSidebarTuiPlugin;
