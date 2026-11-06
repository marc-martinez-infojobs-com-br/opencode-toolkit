import { type ParsedPlan } from "./parser.js";
export interface DiscoveredPlan {
    readonly filePath: string;
    readonly displayPath: string;
    readonly title: string;
    readonly completedSteps: number;
    readonly totalSteps: number;
    readonly percentage: number;
    readonly updatedAt: number;
}
export declare function isPlanFilePathCandidate(filePath: string): boolean;
export declare function extractCandidatePlanPathFromToolCall(tool: string, input: unknown, cwd: string): string | null;
export declare function resolveLedgerPathForPlan(planFilePath: string, projectDir: string): string | null;
export declare function loadParsedPlanFromFile(planFilePath: string, projectDir: string): ParsedPlan | null;
export declare function discoverPlanFiles(projectDir: string, extraDirs?: string[]): Promise<DiscoveredPlan[]>;
