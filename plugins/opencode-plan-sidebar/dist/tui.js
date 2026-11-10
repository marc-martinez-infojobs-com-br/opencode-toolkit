import { effect as _$effect } from "@opentui/solid";
import { createTextNode as _$createTextNode } from "@opentui/solid";
import { insertNode as _$insertNode } from "@opentui/solid";
import { insert as _$insert } from "@opentui/solid";
import { memo as _$memo } from "@opentui/solid";
import { setProp as _$setProp } from "@opentui/solid";
import { use as _$use } from "@opentui/solid";
import { createElement as _$createElement } from "@opentui/solid";
import { createComponent as _$createComponent } from "@opentui/solid";
import { Plugin } from "@opencode/plugin/tui";
import { TextAttributes } from "@opentui/core";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { PlanRpc } from "./rpc.js";
import { buildSidebarViewModel } from "./sidebar-format.js";
const RPC_TIMEOUT_MS = 15_000;
const DEFAULT_SIDEBAR_WIDTH = 36;
const ACTION_CUSTOM_PATH = "__custom_path__";
const ACTION_CLEAR_PLAN = "__clear_plan__";
function planRpc(context) {
  return context.client.rpc(PlanRpc);
}
function planRpcOptions(context) {
  return {
    location: context.location ?? context.data.location.default(),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS)
  };
}
function getRouteSessionID(context) {
  const route = context.ui.router.current();
  return route.type === "session" ? route.sessionID : undefined;
}
function rpcErrorMessage(error) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return String(error);
}
async function ensureSessionForPlan(context, existingSessionID, planTitle) {
  if (existingSessionID) {
    return {
      sessionID: existingSessionID,
      created: false
    };
  }
  const location = context.location ?? context.data.location.default();
  const createdSession = await context.client.session.create({
    ...(planTitle ? {
      title: planTitle
    } : {}),
    location: {
      directory: location.directory
    }
  }, {
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS)
  });
  return {
    sessionID: createdSession.id,
    created: true
  };
}
export async function runPlanSelectorFlow(context, sessionID, rawArgument) {
  const trimmedArg = rawArgument?.trim();
  if (trimmedArg) {
    if (trimmedArg === "clear" || trimmedArg === "off" || trimmedArg === "none") {
      if (!sessionID) {
        context.ui.toast.show({
          title: "Plan Sidebar",
          message: "No hay una sesión activa con plan para desvincular.",
          variant: "info"
        });
        return;
      }
      await planRpc(context).clear({
        sessionID
      }, planRpcOptions(context));
      context.ui.toast.show({
        title: "Plan Sidebar",
        message: "Plan desvinculado de la sesión.",
        variant: "info"
      });
      return;
    }
    try {
      const {
        sessionID: targetSessionID,
        created
      } = await ensureSessionForPlan(context, sessionID);
      const res = await planRpc(context).select({
        sessionID: targetSessionID,
        filePath: trimmedArg
      }, planRpcOptions(context));
      if (!res.ok) {
        context.ui.toast.show({
          title: "Plan Sidebar",
          message: res.error ?? `No se pudo cargar el plan: ${trimmedArg}`,
          variant: "error"
        });
        return;
      }
      if (created) {
        context.ui.router.navigate({
          type: "session",
          sessionID: targetSessionID
        });
      }
      context.ui.toast.show({
        title: "Plan Sidebar",
        message: `Plan cargado: ${res.plan?.title ?? trimmedArg}`,
        variant: "success"
      });
    } catch (error) {
      context.ui.toast.show({
        title: "Plan Sidebar",
        message: rpcErrorMessage(error),
        variant: "error"
      });
    }
    return;
  }
  try {
    const location = context.location ?? context.data.location.default();
    const discovered = await planRpc(context).discover({
      directory: location.directory
    }, planRpcOptions(context));
    const options = [...discovered.plans.map(item => ({
      title: item.title,
      value: item.filePath,
      description: `${item.displayPath} — ${item.percentage}% (${item.completedSteps}/${item.totalSteps})`,
      category: "Planes detectados"
    })), {
      title: "Introducir ruta del plan manualmente...",
      value: ACTION_CUSTOM_PATH,
      description: "Especificar ruta relativa o absoluta a un archivo .md",
      category: "Acciones"
    }, ...(sessionID ? [{
      title: "Quitar plan activo del Sidebar",
      value: ACTION_CLEAR_PLAN,
      description: "Ocultar el progreso del plan en esta sesión",
      category: "Acciones"
    }] : [])];
    const choice = await context.ui.dialog.select({
      title: "Seleccionar Plan para el Sidebar",
      placeholder: "Buscar plan por título o ruta...",
      options
    });
    if (!choice) return;
    if (choice === ACTION_CLEAR_PLAN) {
      if (!sessionID) return;
      await planRpc(context).clear({
        sessionID
      }, planRpcOptions(context));
      context.ui.toast.show({
        title: "Plan Sidebar",
        message: "Plan ocultado del Sidebar.",
        variant: "info"
      });
      return;
    }
    let targetPath = choice;
    if (choice === ACTION_CUSTOM_PATH) {
      const manualPath = await context.ui.dialog.prompt({
        title: "Ruta del archivo de plan (.md)",
        description: "Introduce la ruta (ej. docs/plans/mi-plan.md)",
        placeholder: "docs/plans/plan.md"
      });
      if (!manualPath?.trim()) return;
      targetPath = manualPath.trim();
    }
    const matchedPlan = discovered.plans.find(item => item.filePath === targetPath);
    const {
      sessionID: targetSessionID,
      created
    } = await ensureSessionForPlan(context, sessionID, matchedPlan?.title);
    const res = await planRpc(context).select({
      sessionID: targetSessionID,
      filePath: targetPath
    }, planRpcOptions(context));
    if (!res.ok) {
      context.ui.toast.show({
        title: "Plan Sidebar",
        message: res.error ?? `No se pudo cargar el plan: ${targetPath}`,
        variant: "error"
      });
      return;
    }
    if (created) {
      context.ui.router.navigate({
        type: "session",
        sessionID: targetSessionID
      });
    }
    context.ui.toast.show({
      title: "Plan Sidebar",
      message: `Plan activo: ${res.plan?.title ?? targetPath}`,
      variant: "success"
    });
  } catch (error) {
    context.ui.toast.show({
      title: "Plan Sidebar",
      message: rpcErrorMessage(error),
      variant: "error"
    });
  }
}
export function percentageColor(context, percentage) {
  return percentage > 0 ? context.theme.text.feedback.success.base : context.theme.text.muted;
}
export function stepColor(context, status) {
  switch (status) {
    case "completed":
      return context.theme.text.feedback.success.base;
    case "active":
      return context.theme.text.base;
    case "next":
    case "pending":
      return context.theme.text.muted;
  }
}
export function taskColor(context, status) {
  switch (status) {
    case "completed":
      return context.theme.text.feedback.success.base;
    case "active":
      return context.theme.text.base;
    case "pending":
      return context.theme.text.muted;
  }
}
function SidebarPlanView(props) {
  const [open, setOpen] = createSignal(true);
  const [plan, setPlan] = createSignal(null);
  const [containerWidth, setContainerWidth] = createSignal(DEFAULT_SIDEBAR_WIDTH);
  let rootBox;
  const updateMeasuredWidth = () => {
    const w = rootBox?.width;
    if (typeof w === "number" && w > 10) {
      setContainerWidth(w);
    }
  };
  let disposed = false;
  let requestVersion = 0;
  const refreshForSession = targetSessionID => {
    const currentReq = ++requestVersion;
    if (disposed || !targetSessionID) {
      setPlan(null);
      return;
    }
    void planRpc(props.context).get({
      sessionID: targetSessionID
    }, planRpcOptions(props.context)).then(res => {
      if (!disposed && currentReq === requestVersion && props.sessionID === targetSessionID) {
        setPlan(res.plan);
      }
    }).catch(() => {
      // Ignore transient RPC startup errors
    });
  };
  createEffect(() => {
    const currentSessionID = props.sessionID;
    setPlan(null);
    refreshForSession(currentSessionID);
  });
  const unsubRpc = planRpc(props.context).events.on("updated", event => {
    if (event.data.sessionID === props.sessionID) {
      setPlan(event.data.plan);
    }
  });
  const unsubStep = props.context.data.on("session.step.ended", event => {
    const sid = event.data?.sessionID;
    if (sid && sid === props.sessionID) refreshForSession(sid);
  });
  const unsubTool = props.context.data.on("session.tool.success", event => {
    const sid = event.data?.sessionID;
    if (sid && sid === props.sessionID) refreshForSession(sid);
  });
  onCleanup(() => {
    disposed = true;
    unsubRpc();
    unsubStep();
    unsubTool();
  });
  const vm = () => {
    const current = plan();
    return current ? buildSidebarViewModel(current, containerWidth()) : null;
  };
  return _$createComponent(Show, {
    get when() {
      return vm();
    },
    children: model => (() => {
      var _el$ = _$createElement("box"),
        _el$2 = _$createElement("box"),
        _el$3 = _$createElement("text");
      _$insertNode(_el$, _el$2);
      _$use(el => {
        rootBox = el;
        updateMeasuredWidth();
      }, _el$);
      _$setProp(_el$, "onSizeChange", updateMeasuredWidth);
      _$setProp(_el$, "width", "100%");
      _$setProp(_el$, "flexDirection", "column");
      _$setProp(_el$, "gap", 1);
      _$insertNode(_el$2, _el$3);
      _$setProp(_el$2, "flexDirection", "row");
      _$setProp(_el$2, "gap", 1);
      _$setProp(_el$2, "onMouseDown", () => setOpen(prev => !prev));
      _$insert(_el$3, () => open() ? "▼" : "▶");
      _$insert(_el$2, _$createComponent(Show, {
        get when() {
          return !open();
        },
        get fallback() {
          return (() => {
            var _el$19 = _$createElement("text");
            _$insertNode(_el$19, _$createTextNode(`Plan`));
            _$effect(_p$ => {
              var _v$1 = props.context.theme.text.base,
                _v$10 = TextAttributes.BOLD;
              _v$1 !== _p$.e && (_p$.e = _$setProp(_el$19, "fg", _v$1, _p$.e));
              _v$10 !== _p$.t && (_p$.t = _$setProp(_el$19, "attributes", _v$10, _p$.t));
              return _p$;
            }, {
              e: undefined,
              t: undefined
            });
            return _el$19;
          })();
        },
        get children() {
          var _el$4 = _$createElement("text"),
            _el$5 = _$createElement("span"),
            _el$7 = _$createElement("span"),
            _el$8 = _$createElement("span");
          _$insertNode(_el$4, _el$5);
          _$insertNode(_el$4, _el$7);
          _$insertNode(_el$4, _el$8);
          _$setProp(_el$4, "wrapMode", "none");
          _$insertNode(_el$5, _$createTextNode(`Plan `));
          _$insert(_el$7, () => model().percentageText);
          _$insert(_el$8, () => ` ${model().stepsCountText}`);
          _$effect(_p$ => {
            var _v$ = {
                fg: props.context.theme.text.base,
                bold: true
              },
              _v$2 = {
                fg: percentageColor(props.context, model().percentage),
                bold: true
              },
              _v$3 = {
                fg: props.context.theme.text.muted
              };
            _v$ !== _p$.e && (_p$.e = _$setProp(_el$5, "style", _v$, _p$.e));
            _v$2 !== _p$.t && (_p$.t = _$setProp(_el$7, "style", _v$2, _p$.t));
            _v$3 !== _p$.a && (_p$.a = _$setProp(_el$8, "style", _v$3, _p$.a));
            return _p$;
          }, {
            e: undefined,
            t: undefined,
            a: undefined
          });
          return _el$4;
        }
      }), null);
      _$insert(_el$, _$createComponent(Show, {
        get when() {
          return open();
        },
        get children() {
          var _el$9 = _$createElement("box"),
            _el$0 = _$createElement("box"),
            _el$1 = _$createElement("text"),
            _el$10 = _$createElement("text"),
            _el$11 = _$createElement("box"),
            _el$12 = _$createElement("text"),
            _el$13 = _$createElement("span"),
            _el$14 = _$createElement("span"),
            _el$15 = _$createElement("text"),
            _el$16 = _$createElement("span"),
            _el$17 = _$createElement("span"),
            _el$18 = _$createElement("box");
          _$insertNode(_el$9, _el$0);
          _$insertNode(_el$9, _el$18);
          _$setProp(_el$9, "width", "100%");
          _$setProp(_el$9, "flexDirection", "column");
          _$setProp(_el$9, "gap", 1);
          _$insertNode(_el$0, _el$1);
          _$insertNode(_el$0, _el$10);
          _$insertNode(_el$0, _el$11);
          _$setProp(_el$0, "width", "100%");
          _$setProp(_el$0, "flexDirection", "column");
          _$insert(_el$1, () => model().headerTitle);
          _$insert(_el$10, () => model().fileName);
          _$insertNode(_el$11, _el$12);
          _$insertNode(_el$11, _el$15);
          _$setProp(_el$11, "width", "100%");
          _$setProp(_el$11, "flexDirection", "row");
          _$setProp(_el$11, "justifyContent", "space-between");
          _$setProp(_el$11, "gap", 1);
          _$insertNode(_el$12, _el$13);
          _$insertNode(_el$12, _el$14);
          _$setProp(_el$12, "wrapMode", "none");
          _$insert(_el$13, () => model().progressBarFilled);
          _$insert(_el$14, () => model().progressBarEmpty);
          _$insertNode(_el$15, _el$16);
          _$insertNode(_el$15, _el$17);
          _$setProp(_el$15, "wrapMode", "none");
          _$insert(_el$16, () => model().percentageText);
          _$insert(_el$17, () => ` ${model().stepsCountText}`);
          _$setProp(_el$18, "width", "100%");
          _$setProp(_el$18, "flexDirection", "column");
          _$setProp(_el$18, "gap", 1);
          _$insert(_el$18, _$createComponent(For, {
            get each() {
              return model().tasks;
            },
            children: task => (() => {
              var _el$21 = _$createElement("box"),
                _el$22 = _$createElement("text"),
                _el$23 = _$createElement("box");
              _$insertNode(_el$21, _el$22);
              _$insertNode(_el$21, _el$23);
              _$setProp(_el$21, "flexDirection", "column");
              _$insert(_el$22, () => task.header);
              _$setProp(_el$23, "flexDirection", "column");
              _$setProp(_el$23, "paddingLeft", 2);
              _$insert(_el$23, _$createComponent(For, {
                get each() {
                  return task.steps;
                },
                children: step => (() => {
                  var _el$24 = _$createElement("text");
                  _$insert(_el$24, () => step.line);
                  _$effect(_p$ => {
                    var _v$13 = stepColor(props.context, step.status),
                      _v$14 = step.status === "active" ? TextAttributes.BOLD : TextAttributes.NONE;
                    _v$13 !== _p$.e && (_p$.e = _$setProp(_el$24, "fg", _v$13, _p$.e));
                    _v$14 !== _p$.t && (_p$.t = _$setProp(_el$24, "attributes", _v$14, _p$.t));
                    return _p$;
                  }, {
                    e: undefined,
                    t: undefined
                  });
                  return _el$24;
                })()
              }));
              _$effect(_p$ => {
                var _v$11 = taskColor(props.context, task.status),
                  _v$12 = task.status === "active" ? TextAttributes.BOLD : TextAttributes.NONE;
                _v$11 !== _p$.e && (_p$.e = _$setProp(_el$22, "fg", _v$11, _p$.e));
                _v$12 !== _p$.t && (_p$.t = _$setProp(_el$22, "attributes", _v$12, _p$.t));
                return _p$;
              }, {
                e: undefined,
                t: undefined
              });
              return _el$21;
            })()
          }));
          _$effect(_p$ => {
            var _v$4 = props.context.theme.text.base,
              _v$5 = TextAttributes.BOLD,
              _v$6 = props.context.theme.text.muted,
              _v$7 = {
                fg: props.context.theme.text.feedback.success.base
              },
              _v$8 = {
                fg: props.context.theme.text.muted
              },
              _v$9 = {
                fg: percentageColor(props.context, model().percentage)
              },
              _v$0 = {
                fg: props.context.theme.text.muted
              };
            _v$4 !== _p$.e && (_p$.e = _$setProp(_el$1, "fg", _v$4, _p$.e));
            _v$5 !== _p$.t && (_p$.t = _$setProp(_el$1, "attributes", _v$5, _p$.t));
            _v$6 !== _p$.a && (_p$.a = _$setProp(_el$10, "fg", _v$6, _p$.a));
            _v$7 !== _p$.o && (_p$.o = _$setProp(_el$13, "style", _v$7, _p$.o));
            _v$8 !== _p$.i && (_p$.i = _$setProp(_el$14, "style", _v$8, _p$.i));
            _v$9 !== _p$.n && (_p$.n = _$setProp(_el$16, "style", _v$9, _p$.n));
            _v$0 !== _p$.s && (_p$.s = _$setProp(_el$17, "style", _v$0, _p$.s));
            return _p$;
          }, {
            e: undefined,
            t: undefined,
            a: undefined,
            o: undefined,
            i: undefined,
            n: undefined,
            s: undefined
          });
          return _el$9;
        }
      }), null);
      _$effect(_$p => _$setProp(_el$3, "fg", props.context.theme.text.base, _$p));
      return _el$;
    })()
  });
}
export const PlanSidebarTuiPlugin = Plugin.define({
  id: "opencode.plan-sidebar.tui",
  setup(context) {
    const disposeApp = context.ui.slot({
      append: "app",
      render: () => {
        context.keymap.layer(() => ({
          mode: "global",
          commands: [{
            id: "plan.select",
            title: "Seleccionar o cambiar plan en Sidebar",
            description: "Elige un plan detectado en /docs o introduce su ruta",
            group: "Plan Sidebar",
            palette: true,
            slash: {
              name: "plan",
              aliases: ["plan-select"],
              arguments: true
            },
            run: async input => {
              await runPlanSelectorFlow(context, getRouteSessionID(context), input);
            }
          }, {
            id: "plan.clear",
            title: "Quitar plan activo del Sidebar",
            group: "Plan Sidebar",
            palette: true,
            run: async () => {
              await runPlanSelectorFlow(context, getRouteSessionID(context), "clear");
            }
          }]
        }));
        return null;
      }
    });
    const disposeSidebar = context.ui.slot({
      append: "sidebar.content",
      render: props => _$createComponent(SidebarPlanView, {
        context: context,
        get sessionID() {
          return props.sessionID;
        }
      })
    });
    return () => {
      disposeApp();
      disposeSidebar();
    };
  }
});
export default PlanSidebarTuiPlugin;
