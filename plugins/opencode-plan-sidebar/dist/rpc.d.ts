import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { DiscoveredPlan } from "./detector.js";
import type { ParsedPlan } from "./parser.js";
export declare const PLAN_RPC_ID = "opencode.plan-sidebar";
export interface GetPlanInput {
    readonly sessionID: string;
}
export interface GetPlanOutput {
    readonly plan: ParsedPlan | null;
}
export interface DiscoverPlansInput {
    readonly directory?: string;
}
export interface DiscoverPlansOutput {
    readonly plans: readonly DiscoveredPlan[];
}
export interface SelectPlanInput {
    readonly sessionID: string;
    readonly filePath: string;
}
export interface SelectPlanOutput {
    readonly ok: boolean;
    readonly plan: ParsedPlan | null;
    readonly error?: string;
}
export interface ClearPlanInput {
    readonly sessionID: string;
}
export interface ClearPlanOutput {
    readonly ok: boolean;
}
export interface PlanUpdatedEvent extends Readonly<Record<string, unknown>> {
    readonly sessionID: string;
    readonly plan: ParsedPlan | null;
}
export declare const PlanRpc: {
    readonly id: "opencode.plan-sidebar";
    readonly events: {
        readonly updated: {
            readonly schema: StandardSchemaV1<PlanUpdatedEvent, PlanUpdatedEvent>;
        };
    };
    readonly methods: {
        readonly get: {
            readonly input: StandardSchemaV1<GetPlanInput, GetPlanInput>;
            readonly output: StandardSchemaV1<GetPlanOutput, GetPlanOutput>;
        };
        readonly discover: {
            readonly input: StandardSchemaV1<DiscoverPlansInput, DiscoverPlansInput>;
            readonly output: StandardSchemaV1<DiscoverPlansOutput, DiscoverPlansOutput>;
        };
        readonly select: {
            readonly input: StandardSchemaV1<SelectPlanInput, SelectPlanInput>;
            readonly output: StandardSchemaV1<SelectPlanOutput, SelectPlanOutput>;
        };
        readonly clear: {
            readonly input: StandardSchemaV1<ClearPlanInput, ClearPlanInput>;
            readonly output: StandardSchemaV1<ClearPlanOutput, ClearPlanOutput>;
        };
    };
};
