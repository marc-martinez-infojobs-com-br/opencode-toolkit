import { describe, expect, it } from "vitest"
import { isLikelyPlanContent, parsePlanMarkdown } from "../src/parser.js"

const SAMPLE_SUPERPOWERS_PLAN = `# PBI #67913 Dictionary Configuration Implementation Plan

**Goal:** Expose GET /api/v1/Dictionaries/Configuration

## Global Constraints
- Platform ids: 40, 43

### Task 1: Microservices.Client (#67937)

- [x] **Step 1: Write the failing test**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Implement the model and fake**

### Task 2: Apps BFF Endpoint (#67938)

- [x] **Step 1: Write controller unit test**
- [ ] **Step 2: Implement controller action**
- [ ] **Step 3: Run unit tests**

### Task 3: Functional Tests

- [ ] **Step 1: Add functional test**
`

describe("parsePlanMarkdown", () => {
  it("parses tasks, steps, progress, activeStep, and nextStep from a Superpowers plan", () => {
    const plan = parsePlanMarkdown(SAMPLE_SUPERPOWERS_PLAN, "/repo/docs/plans/2026-11-03-p67913.md")

    expect(plan.title).toBe("PBI #67913 Dictionary Configuration Implementation Plan")
    expect(plan.filePath).toBe("/repo/docs/plans/2026-11-03-p67913.md")
    expect(plan.fileName).toBe("2026-11-03-p67913.md")
    expect(plan.totalSteps).toBe(7)
    expect(plan.completedSteps).toBe(4)
    expect(plan.percentage).toBe(57)
    expect(plan.tasks).toHaveLength(3)

    expect(plan.tasks[0]?.title).toBe("Task 1: Microservices.Client (#67937)")
    expect(plan.tasks[0]?.status).toBe("completed")
    expect(plan.tasks[0]?.completedSteps).toBe(3)
    expect(plan.tasks[0]?.totalSteps).toBe(3)

    expect(plan.tasks[1]?.title).toBe("Task 2: Apps BFF Endpoint (#67938)")
    expect(plan.tasks[1]?.status).toBe("active")
    expect(plan.tasks[1]?.steps[0]?.status).toBe("completed")
    expect(plan.tasks[1]?.steps[1]?.status).toBe("active")
    expect(plan.tasks[1]?.steps[1]?.text).toBe("Step 2: Implement controller action")
    expect(plan.tasks[1]?.steps[2]?.status).toBe("next")
    expect(plan.tasks[1]?.steps[2]?.text).toBe("Step 3: Run unit tests")

    expect(plan.tasks[2]?.status).toBe("pending")
    expect(plan.tasks[2]?.steps[0]?.status).toBe("pending")

    expect(plan.activeStep).toEqual({
      taskTitle: "Task 2: Apps BFF Endpoint (#67938)",
      stepText: "Step 2: Implement controller action",
      taskIndex: 1,
      stepIndex: 1,
    })
    expect(plan.nextStep).toEqual({
      taskTitle: "Task 2: Apps BFF Endpoint (#67938)",
      stepText: "Step 3: Run unit tests",
      taskIndex: 1,
      stepIndex: 2,
    })
  })

  it("finds nextStep in the subsequent task when activeStep is the last step of its task", () => {
    const md = `# Plan
### Task 1: Setup
- [x] Step 1: Init
- [ ] Step 2: Config
### Task 2: Build
- [ ] Step 1: Compile
`
    const plan = parsePlanMarkdown(md, "/repo/docs/plan.md")
    expect(plan.activeStep?.stepText).toBe("Step 2: Config")
    expect(plan.nextStep?.taskTitle).toBe("Task 2: Build")
    expect(plan.nextStep?.stepText).toBe("Step 1: Compile")
  })

  it("applies Superpowers SDD ledger progress when tasks are marked complete in progress.md", () => {
    const md = `# Plan
### Task 1: First
- [ ] Step 1: A
- [ ] Step 2: B
### Task 2: Second
- [ ] Step 1: C
`
    const ledger = `# SDD ledger — plan: docs/plan.md
Task 1: complete (commits abc..def, tests: npm test → PASS)
`
    const plan = parsePlanMarkdown(md, "/repo/docs/plan.md", ledger)
    expect(plan.tasks[0]?.status).toBe("completed")
    expect(plan.completedSteps).toBe(2)
    expect(plan.totalSteps).toBe(3)
    expect(plan.activeStep?.taskTitle).toBe("Task 2: Second")
    expect(plan.activeStep?.stepText).toBe("Step 1: C")
  })

  it("groups orphan checkboxes into a general phase when no task headings exist", () => {
    const md = `# Simple Plan
- [x] First check
- [ ] Second check
- [ ] Third check
`
    const plan = parsePlanMarkdown(md, "/repo/docs/simple.md")
    expect(plan.tasks).toHaveLength(1)
    expect(plan.completedSteps).toBe(1)
    expect(plan.totalSteps).toBe(3)
    expect(plan.activeStep?.stepText).toBe("Second check")
    expect(plan.nextStep?.stepText).toBe("Third check")
  })

  it("ignores summary/tracking sections like 'Seguimiento de Fases y Tasks' when numbered Fase/Task sections exist", () => {
    const md = `# SaveDeviceSearch in MF Apps Implementation Plan (PBI 58395)

## Seguimiento de Fases y Tasks en Azure DevOps (PBI #58395)

- [ ] **Fase 1 — Task #68004** (\`0.5h\`): \`Microservices.Client\`
- [ ] **Fase 2 — Task #68005** (\`0.5h\`): \`Apps - SaveDeviceSearch Endpoint\`
- [ ] **Fase 3 — Task #68006** (\`0.5h\`): \`Apps.FunctionalTest\`

---

### Fase 1 (Task #68004): Microservices.Client - IUserDeviceSearchService, Fake & Model

- [ ] **Step 1: Write the failing client integration test**
- [ ] **Step 2: Run test to verify it fails**

### Fase 2 (Task #68005): Apps - SaveDeviceSearch Endpoint, ViewModel & AutoMapper

- [ ] **Step 1: Create ViewModel**
`
    const plan = parsePlanMarkdown(md, "/repo/docs/2026-10-30-user-device-search-apps-plan.md")
    expect(plan.tasks.map((t) => t.title)).toEqual([
      "Fase 1 (Task #68004): Microservices.Client - IUserDeviceSearchService, Fake & Model",
      "Fase 2 (Task #68005): Apps - SaveDeviceSearch Endpoint, ViewModel & AutoMapper",
    ])
    expect(plan.totalSteps).toBe(3)
    expect(plan.completedSteps).toBe(0)
    expect(plan.activeStep?.taskTitle).toBe(
      "Fase 1 (Task #68004): Microservices.Client - IUserDeviceSearchService, Fake & Model",
    )
    expect(plan.activeStep?.stepText).toBe("Step 1: Write the failing client integration test")
  })
})

describe("isLikelyPlanContent", () => {
  it("returns true for markdown with checkboxes and false for plain prose", () => {
    expect(isLikelyPlanContent(SAMPLE_SUPERPOWERS_PLAN)).toBe(true)
    expect(isLikelyPlanContent("# Just a README\n\nSome text without tasks or checks.")).toBe(false)
  })

  it("returns false for specification markdown with numbered sections and no checkboxes", () => {
    const specMarkdown = `# Especificación de Diseño — Configuración de ttl, priority y collapse_key en Push Android

## 1. Objetivo y Contexto
Calibrar los parámetros de entrega en Firebase Cloud Messaging.

## 2. Alcance
Modificación de las clases de payload de FCM.

## 3. Enfoques Considerados
1. Enfoque 1
2. Enfoque 2

## 4. Reglas de Negocio y Agrupación FCM
Tabla de reglas.

## 5. Diseño Técnico
\`\`\`csharp
// - [ ] checkbox inside code block should not count
\`\`\`
`
    expect(isLikelyPlanContent(specMarkdown)).toBe(false)
    const parsed = parsePlanMarkdown(
      specMarkdown,
      "/Users/mmartinez/Projects/InfoJobs/Docs/PB68062/specs/2026-11-09-fcm-ttl-priority-collapse-key-spec.md",
    )
    expect(parsed.totalSteps).toBe(0)
    expect(parsed.tasks).toHaveLength(0)
  })
})
