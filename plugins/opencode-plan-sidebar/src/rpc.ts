import type { StandardSchemaV1 } from "@standard-schema/spec"
import type { DiscoveredPlan } from "./detector.js"
import type { ParsedPlan } from "./parser.js"

export const PLAN_RPC_ID = "opencode.plan-sidebar"

function schema<T>(check: (value: unknown) => string | null): StandardSchemaV1<T, T> {
  return {
    "~standard": {
      version: 1,
      vendor: "opencode-plan-sidebar",
      validate: (value: unknown) => {
        const issue = check(value)
        return issue ? { issues: [{ message: issue }] } : { value: value as T }
      },
    },
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export interface GetPlanInput {
  readonly sessionID: string
}

export interface GetPlanOutput {
  readonly plan: ParsedPlan | null
}

export interface DiscoverPlansInput {
  readonly directory?: string
}

export interface DiscoverPlansOutput {
  readonly plans: readonly DiscoveredPlan[]
}

export interface SelectPlanInput {
  readonly sessionID: string
  readonly filePath: string
}

export interface SelectPlanOutput {
  readonly ok: boolean
  readonly plan: ParsedPlan | null
  readonly error?: string
}

export interface ClearPlanInput {
  readonly sessionID: string
}

export interface ClearPlanOutput {
  readonly ok: boolean
}

export interface PlanUpdatedEvent extends Readonly<Record<string, unknown>> {
  readonly sessionID: string
  readonly plan: ParsedPlan | null
}

export const PlanRpc = {
  id: PLAN_RPC_ID,
  events: {
    updated: {
      schema: schema<PlanUpdatedEvent>((value) => {
        if (!isObject(value)) return "event data must be an object"
        if (typeof value.sessionID !== "string") return "sessionID must be a string"
        return null
      }),
    },
  },
  methods: {
    get: {
      input: schema<GetPlanInput>((value) => {
        if (!isObject(value)) return "input must be an object"
        if (typeof value.sessionID !== "string" || !value.sessionID) {
          return "sessionID must be a non-empty string"
        }
        return null
      }),
      output: schema<GetPlanOutput>((value) => {
        if (!isObject(value)) return "output must be an object"
        return null
      }),
    },
    discover: {
      input: schema<DiscoverPlansInput>((value) => {
        if (!isObject(value)) return "input must be an object"
        if (value.directory !== undefined && typeof value.directory !== "string") {
          return "directory must be a string"
        }
        return null
      }),
      output: schema<DiscoverPlansOutput>((value) => {
        if (!isObject(value)) return "output must be an object"
        return null
      }),
    },
    select: {
      input: schema<SelectPlanInput>((value) => {
        if (!isObject(value)) return "input must be an object"
        if (typeof value.sessionID !== "string" || !value.sessionID) {
          return "sessionID must be a non-empty string"
        }
        if (typeof value.filePath !== "string" || !value.filePath) {
          return "filePath must be a non-empty string"
        }
        return null
      }),
      output: schema<SelectPlanOutput>((value) => {
        if (!isObject(value)) return "output must be an object"
        return null
      }),
    },
    clear: {
      input: schema<ClearPlanInput>((value) => {
        if (!isObject(value)) return "input must be an object"
        if (typeof value.sessionID !== "string" || !value.sessionID) {
          return "sessionID must be a non-empty string"
        }
        return null
      }),
      output: schema<ClearPlanOutput>((value) => {
        if (!isObject(value)) return "output must be an object"
        return null
      }),
    },
  },
} as const
