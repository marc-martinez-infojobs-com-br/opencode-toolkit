import { Plugin } from "@opencode/plugin/tui"
import { type BoxRenderable, TextAttributes } from "@opentui/core"
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js"
import type { ParsedPlan, StepStatus, TaskStatus } from "./parser.js"
import { PlanRpc } from "./rpc.js"
import { buildSidebarViewModel } from "./sidebar-format.js"

type TuiContext = Plugin.Context

const RPC_TIMEOUT_MS = 15_000
const DEFAULT_SIDEBAR_WIDTH = 36
const ACTION_CUSTOM_PATH = "__custom_path__"
const ACTION_CLEAR_PLAN = "__clear_plan__"

function planRpc(context: TuiContext) {
  return context.client.rpc(PlanRpc)
}

function planRpcOptions(context: TuiContext) {
  return {
    location: context.location ?? context.data.location.default(),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  }
}

function getRouteSessionID(context: TuiContext): string | undefined {
  const route = context.ui.router.current()
  return route.type === "session" ? route.sessionID : undefined
}

function rpcErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message
  }
  return String(error)
}

async function ensureSessionForPlan(
  context: TuiContext,
  existingSessionID: string | undefined,
  planTitle?: string,
): Promise<{ sessionID: string; created: boolean }> {
  if (existingSessionID) {
    return { sessionID: existingSessionID, created: false }
  }
  const location = context.location ?? context.data.location.default()
  const createdSession = await context.client.session.create(
    {
      ...(planTitle ? { title: planTitle } : {}),
      location: { directory: location.directory },
    },
    { signal: AbortSignal.timeout(RPC_TIMEOUT_MS) },
  )
  return { sessionID: createdSession.id, created: true }
}

export async function runPlanSelectorFlow(
  context: TuiContext,
  sessionID: string | undefined,
  rawArgument?: string,
): Promise<void> {
  const trimmedArg = rawArgument?.trim()
  if (trimmedArg) {
    if (trimmedArg === "clear" || trimmedArg === "off" || trimmedArg === "none") {
      if (!sessionID) {
        context.ui.toast.show({
          title: "Plan Sidebar",
          message: "No hay una sesión activa con plan para desvincular.",
          variant: "info",
        })
        return
      }
      await planRpc(context).clear({ sessionID }, planRpcOptions(context))
      context.ui.toast.show({
        title: "Plan Sidebar",
        message: "Plan desvinculado de la sesión.",
        variant: "info",
      })
      return
    }

    try {
      const { sessionID: targetSessionID, created } = await ensureSessionForPlan(
        context,
        sessionID,
      )
      const res = await planRpc(context).select(
        { sessionID: targetSessionID, filePath: trimmedArg },
        planRpcOptions(context),
      )
      if (!res.ok) {
        context.ui.toast.show({
          title: "Plan Sidebar",
          message: res.error ?? `No se pudo cargar el plan: ${trimmedArg}`,
          variant: "error",
        })
        return
      }
      if (created) {
        context.ui.router.navigate({ type: "session", sessionID: targetSessionID })
      }
      context.ui.toast.show({
        title: "Plan Sidebar",
        message: `Plan cargado: ${res.plan?.title ?? trimmedArg}`,
        variant: "success",
      })
    } catch (error) {
      context.ui.toast.show({
        title: "Plan Sidebar",
        message: rpcErrorMessage(error),
        variant: "error",
      })
    }
    return
  }

  try {
    const location = context.location ?? context.data.location.default()
    const discovered = await planRpc(context).discover(
      { directory: location.directory },
      planRpcOptions(context),
    )

    const options = [
      ...discovered.plans.map((item) => ({
        title: item.title,
        value: item.filePath,
        description: `${item.displayPath} — ${item.percentage}% (${item.completedSteps}/${item.totalSteps})`,
        category: "Planes detectados",
      })),
      {
        title: "Introducir ruta del plan manualmente...",
        value: ACTION_CUSTOM_PATH,
        description: "Especificar ruta relativa o absoluta a un archivo .md",
        category: "Acciones",
      },
      ...(sessionID
        ? [
            {
              title: "Quitar plan activo del Sidebar",
              value: ACTION_CLEAR_PLAN,
              description: "Ocultar el progreso del plan en esta sesión",
              category: "Acciones",
            },
          ]
        : []),
    ]

    const choice = await context.ui.dialog.select({
      title: "Seleccionar Plan para el Sidebar",
      placeholder: "Buscar plan por título o ruta...",
      options,
    })

    if (!choice) return

    if (choice === ACTION_CLEAR_PLAN) {
      if (!sessionID) return
      await planRpc(context).clear({ sessionID }, planRpcOptions(context))
      context.ui.toast.show({
        title: "Plan Sidebar",
        message: "Plan ocultado del Sidebar.",
        variant: "info",
      })
      return
    }

    let targetPath = choice
    if (choice === ACTION_CUSTOM_PATH) {
      const manualPath = await context.ui.dialog.prompt({
        title: "Ruta del archivo de plan (.md)",
        description: "Introduce la ruta (ej. docs/plans/mi-plan.md)",
        placeholder: "docs/plans/plan.md",
      })
      if (!manualPath?.trim()) return
      targetPath = manualPath.trim()
    }

    const matchedPlan = discovered.plans.find((item) => item.filePath === targetPath)
    const { sessionID: targetSessionID, created } = await ensureSessionForPlan(
      context,
      sessionID,
      matchedPlan?.title,
    )

    const res = await planRpc(context).select(
      { sessionID: targetSessionID, filePath: targetPath },
      planRpcOptions(context),
    )
    if (!res.ok) {
      context.ui.toast.show({
        title: "Plan Sidebar",
        message: res.error ?? `No se pudo cargar el plan: ${targetPath}`,
        variant: "error",
      })
      return
    }

    if (created) {
      context.ui.router.navigate({ type: "session", sessionID: targetSessionID })
    }

    context.ui.toast.show({
      title: "Plan Sidebar",
      message: `Plan activo: ${res.plan?.title ?? targetPath}`,
      variant: "success",
    })
  } catch (error) {
    context.ui.toast.show({
      title: "Plan Sidebar",
      message: rpcErrorMessage(error),
      variant: "error",
    })
  }
}

export function percentageColor(context: TuiContext, percentage: number) {
  return percentage > 0
    ? context.theme.text.feedback.success.base
    : context.theme.text.muted
}

export function stepColor(context: TuiContext, status: StepStatus) {
  switch (status) {
    case "completed":
      return context.theme.text.feedback.success.base
    case "active":
      return context.theme.text.base
    case "next":
    case "pending":
      return context.theme.text.muted
  }
}

export function taskColor(context: TuiContext, status: TaskStatus) {
  switch (status) {
    case "completed":
      return context.theme.text.feedback.success.base
    case "active":
      return context.theme.text.base
    case "pending":
      return context.theme.text.muted
  }
}

function SidebarPlanView(props: { context: TuiContext; sessionID: string }) {
  const [open, setOpen] = createSignal(true)
  const [plan, setPlan] = createSignal<ParsedPlan | null>(null)
  const [containerWidth, setContainerWidth] = createSignal(DEFAULT_SIDEBAR_WIDTH)
  let rootBox: BoxRenderable | undefined

  const updateMeasuredWidth = () => {
    const w = rootBox?.width
    if (typeof w === "number" && w > 10) {
      setContainerWidth(w)
    }
  }

  let disposed = false
  let requestVersion = 0

  const refreshForSession = (targetSessionID: string | undefined) => {
    const currentReq = ++requestVersion
    if (disposed || !targetSessionID) {
      setPlan(null)
      return
    }
    void planRpc(props.context)
      .get({ sessionID: targetSessionID }, planRpcOptions(props.context))
      .then((res) => {
        if (!disposed && currentReq === requestVersion && props.sessionID === targetSessionID) {
          setPlan(res.plan)
        }
      })
      .catch(() => {
        // Ignore transient RPC startup errors
      })
  }

  createEffect(() => {
    const currentSessionID = props.sessionID
    setPlan(null)
    refreshForSession(currentSessionID)
  })

  const unsubRpc = planRpc(props.context).events.on("updated", (event) => {
    if (event.data.sessionID === props.sessionID) {
      setPlan(event.data.plan)
    }
  })

  const unsubStep = props.context.data.on("session.step.ended", (event) => {
    const sid = (event.data as { sessionID?: string } | undefined)?.sessionID
    if (sid && sid === props.sessionID) refreshForSession(sid)
  })

  const unsubTool = props.context.data.on("session.tool.success", (event) => {
    const sid = (event.data as { sessionID?: string } | undefined)?.sessionID
    if (sid && sid === props.sessionID) refreshForSession(sid)
  })

  onCleanup(() => {
    disposed = true
    unsubRpc()
    unsubStep()
    unsubTool()
  })

  const vm = () => {
    const current = plan()
    return current ? buildSidebarViewModel(current, containerWidth()) : null
  }

  return (
    <Show when={vm()}>
      {(model) => (
        <box
          ref={(el) => {
            rootBox = el
            updateMeasuredWidth()
          }}
          onSizeChange={updateMeasuredWidth}
          width="100%"
          flexDirection="column"
          gap={1}
        >
          {/* Cabecera plegable del Plan */}
          <box
            flexDirection="row"
            gap={1}
            onMouseDown={() => setOpen((prev) => !prev)}
          >
            <text fg={props.context.theme.text.base}>{open() ? "▼" : "▶"}</text>
            <Show
              when={!open()}
              fallback={
                <text fg={props.context.theme.text.base} attributes={TextAttributes.BOLD}>
                  Plan
                </text>
              }
            >
              <text wrapMode="none">
                <span style={{ fg: props.context.theme.text.base, bold: true }}>Plan </span>
                <span
                  style={{
                    fg: percentageColor(props.context, model().percentage),
                    bold: true,
                  }}
                >
                  {model().percentageText}
                </span>
                <span style={{ fg: props.context.theme.text.muted }}>
                  {` ${model().stepsCountText}`}
                </span>
              </text>
            </Show>
          </box>

          <Show when={open()}>
            <box width="100%" flexDirection="column" gap={1}>
              {/* Título, archivo y barra de progreso a ancho completo */}
              <box width="100%" flexDirection="column">
                <text fg={props.context.theme.text.base} attributes={TextAttributes.BOLD}>
                  {model().headerTitle}
                </text>
                <text fg={props.context.theme.text.muted}>{model().fileName}</text>
                <box
                  width="100%"
                  flexDirection="row"
                  justifyContent="space-between"
                  gap={1}
                >
                  <text wrapMode="none">
                    <span style={{ fg: props.context.theme.text.feedback.success.base }}>
                      {model().progressBarFilled}
                    </span>
                    <span style={{ fg: props.context.theme.text.muted }}>
                      {model().progressBarEmpty}
                    </span>
                  </text>
                  <text wrapMode="none">
                    <span style={{ fg: percentageColor(props.context, model().percentage) }}>
                      {model().percentageText}
                    </span>
                    <span style={{ fg: props.context.theme.text.muted }}>
                      {` ${model().stepsCountText}`}
                    </span>
                  </text>
                </box>
              </box>

              {/* Lista vertical de etapas / tareas y todos sus checks */}
              <box width="100%" flexDirection="column" gap={1}>
                <For each={model().tasks}>
                  {(task) => (
                    <box flexDirection="column">
                      <text
                        fg={taskColor(props.context, task.status)}
                        attributes={
                          task.status === "active" ? TextAttributes.BOLD : TextAttributes.NONE
                        }
                      >
                        {task.header}
                      </text>
                      <box flexDirection="column" paddingLeft={2}>
                        <For each={task.steps}>
                          {(step) => (
                            <text
                              fg={stepColor(props.context, step.status)}
                              attributes={
                                step.status === "active"
                                  ? TextAttributes.BOLD
                                  : TextAttributes.NONE
                              }
                            >
                              {step.line}
                            </text>
                          )}
                        </For>
                      </box>
                    </box>
                  )}
                </For>
              </box>
            </box>
          </Show>
        </box>
      )}
    </Show>
  )
}

export const PlanSidebarTuiPlugin = Plugin.define({
  id: "opencode.plan-sidebar.tui",
  setup(context) {
    const disposeApp = context.ui.slot({
      append: "app",
      render: () => {
        context.keymap.layer(() => ({
          mode: "global",
          commands: [
            {
              id: "plan.select",
              title: "Seleccionar o cambiar plan en Sidebar",
              description: "Elige un plan detectado en /docs o introduce su ruta",
              group: "Plan Sidebar",
              palette: true,
              slash: {
                name: "plan",
                aliases: ["plan-select"],
                arguments: true,
              },
              run: async (input) => {
                await runPlanSelectorFlow(context, getRouteSessionID(context), input)
              },
            },
            {
              id: "plan.clear",
              title: "Quitar plan activo del Sidebar",
              group: "Plan Sidebar",
              palette: true,
              run: async () => {
                await runPlanSelectorFlow(context, getRouteSessionID(context), "clear")
              },
            },
          ],
        }))
        return null
      },
    })

    const disposeSidebar = context.ui.slot({
      append: "sidebar.content",
      render: (props) => <SidebarPlanView context={context} sessionID={props.sessionID} />,
    })

    return () => {
      disposeApp()
      disposeSidebar()
    }
  },
})

export default PlanSidebarTuiPlugin
