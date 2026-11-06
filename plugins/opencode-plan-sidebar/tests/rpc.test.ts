import { describe, expect, it } from "vitest"
import { PlanRpc, PLAN_RPC_ID } from "../src/rpc.js"

describe("PlanRpc contract", () => {
  it("defines the RPC id, methods (get, discover, select, clear), and updated event", () => {
    expect(PlanRpc.id).toBe(PLAN_RPC_ID)
    expect(Object.keys(PlanRpc.methods)).toEqual(["get", "discover", "select", "clear"])
    expect(Object.keys(PlanRpc.events)).toEqual(["updated"])
  })

  it("validates get and select inputs using StandardSchemaV1", () => {
    const validGet = PlanRpc.methods.get.input["~standard"].validate({ sessionID: "ses_123" })
    expect("value" in validGet && validGet.value).toEqual({ sessionID: "ses_123" })

    const invalidGet = PlanRpc.methods.get.input["~standard"].validate({})
    expect("issues" in invalidGet && invalidGet.issues?.[0]?.message).toContain("sessionID")

    const validSelect = PlanRpc.methods.select.input["~standard"].validate({
      sessionID: "ses_123",
      filePath: "docs/plan.md",
    })
    expect("value" in validSelect && validSelect.value).toEqual({
      sessionID: "ses_123",
      filePath: "docs/plan.md",
    })
  })
})
