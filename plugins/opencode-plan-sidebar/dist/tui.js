import { effect as _$effect } from "@opentui/solid";
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
export async function runPlanSelectorFlow(context, sessionID, rawArgument) {
  if (!sessionID) {
    context.ui.toast.show({
      title: "Plan Sidebar",
      message: "Abre primero una sesión para asociar un plan.",
      variant: "warning"
    });
    return;
  }
  const trimmedArg = rawArgument?.trim();
  if (trimmedArg) {
    if (trimmedArg === "clear" || trimmedArg === "off" || trimmedArg === "none") {
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
    const res = await planRpc(context).select({
      sessionID,
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
    context.ui.toast.show({
      title: "Plan Sidebar",
      message: `Plan cargado: ${res.plan?.title ?? trimmedArg}`,
      variant: "success"
    });
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
    }, {
      title: "Quitar plan activo del Sidebar",
      value: ACTION_CLEAR_PLAN,
      description: "Ocultar el progreso del plan en esta sesión",
      category: "Acciones"
    }];
    const choice = await context.ui.dialog.select({
      title: "Seleccionar Plan para el Sidebar",
      placeholder: "Buscar plan por título o ruta...",
      options
    });
    if (!choice) return;
    if (choice === ACTION_CLEAR_PLAN) {
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
    const res = await planRpc(context).select({
      sessionID,
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
function stepColor(context, status) {
  switch (status) {
    case "active":
      return context.theme.text.base;
    case "completed":
    case "next":
    case "pending":
      return context.theme.text.muted;
  }
}
function taskColor(context, status) {
  switch (status) {
    case "active":
      return context.theme.text.base;
    case "completed":
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
        _el$3 = _$createElement("text"),
        _el$4 = _$createElement("text");
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
      _$insertNode(_el$2, _el$4);
      _$setProp(_el$2, "flexDirection", "row");
      _$setProp(_el$2, "gap", 1);
      _$setProp(_el$2, "onMouseDown", () => setOpen(prev => !prev));
      _$insert(_el$3, () => open() ? "▼" : "▶");
      _$insert(_el$4, (() => {
        var _c$ = _$memo(() => !!open());
        return () => _c$() ? "Plan" : `Plan ${model().progressLabel}`;
      })());
      _$insert(_el$, _$createComponent(Show, {
        get when() {
          return open();
        },
        get children() {
          var _el$5 = _$createElement("box"),
            _el$6 = _$createElement("box"),
            _el$7 = _$createElement("text"),
            _el$8 = _$createElement("text"),
            _el$9 = _$createElement("box"),
            _el$0 = _$createElement("text"),
            _el$1 = _$createElement("text"),
            _el$10 = _$createElement("box");
          _$insertNode(_el$5, _el$6);
          _$insertNode(_el$5, _el$10);
          _$setProp(_el$5, "width", "100%");
          _$setProp(_el$5, "flexDirection", "column");
          _$setProp(_el$5, "gap", 1);
          _$insertNode(_el$6, _el$7);
          _$insertNode(_el$6, _el$8);
          _$insertNode(_el$6, _el$9);
          _$setProp(_el$6, "width", "100%");
          _$setProp(_el$6, "flexDirection", "column");
          _$insert(_el$7, () => model().headerTitle);
          _$insert(_el$8, () => model().fileName);
          _$insertNode(_el$9, _el$0);
          _$insertNode(_el$9, _el$1);
          _$setProp(_el$9, "width", "100%");
          _$setProp(_el$9, "flexDirection", "row");
          _$setProp(_el$9, "justifyContent", "space-between");
          _$setProp(_el$9, "gap", 1);
          _$setProp(_el$0, "wrapMode", "none");
          _$insert(_el$0, () => model().progressBar);
          _$setProp(_el$1, "wrapMode", "none");
          _$insert(_el$1, () => model().progressLabel);
          _$setProp(_el$10, "width", "100%");
          _$setProp(_el$10, "flexDirection", "column");
          _$setProp(_el$10, "gap", 1);
          _$insert(_el$10, _$createComponent(For, {
            get each() {
              return model().tasks;
            },
            children: task => (() => {
              var _el$11 = _$createElement("box"),
                _el$12 = _$createElement("text"),
                _el$13 = _$createElement("box");
              _$insertNode(_el$11, _el$12);
              _$insertNode(_el$11, _el$13);
              _$setProp(_el$11, "flexDirection", "column");
              _$insert(_el$12, () => task.header);
              _$setProp(_el$13, "flexDirection", "column");
              _$setProp(_el$13, "paddingLeft", 2);
              _$insert(_el$13, _$createComponent(For, {
                get each() {
                  return task.steps;
                },
                children: step => (() => {
                  var _el$14 = _$createElement("text");
                  _$insert(_el$14, () => step.line);
                  _$effect(_p$ => {
                    var _v$1 = stepColor(props.context, step.status),
                      _v$10 = step.status === "active" ? TextAttributes.BOLD : TextAttributes.NONE;
                    _v$1 !== _p$.e && (_p$.e = _$setProp(_el$14, "fg", _v$1, _p$.e));
                    _v$10 !== _p$.t && (_p$.t = _$setProp(_el$14, "attributes", _v$10, _p$.t));
                    return _p$;
                  }, {
                    e: undefined,
                    t: undefined
                  });
                  return _el$14;
                })()
              }));
              _$effect(_p$ => {
                var _v$9 = taskColor(props.context, task.status),
                  _v$0 = task.status === "active" ? TextAttributes.BOLD : TextAttributes.NONE;
                _v$9 !== _p$.e && (_p$.e = _$setProp(_el$12, "fg", _v$9, _p$.e));
                _v$0 !== _p$.t && (_p$.t = _$setProp(_el$12, "attributes", _v$0, _p$.t));
                return _p$;
              }, {
                e: undefined,
                t: undefined
              });
              return _el$11;
            })()
          }));
          _$effect(_p$ => {
            var _v$ = props.context.theme.text.base,
              _v$2 = TextAttributes.BOLD,
              _v$3 = props.context.theme.text.muted,
              _v$4 = props.context.theme.text.muted,
              _v$5 = props.context.theme.text.muted;
            _v$ !== _p$.e && (_p$.e = _$setProp(_el$7, "fg", _v$, _p$.e));
            _v$2 !== _p$.t && (_p$.t = _$setProp(_el$7, "attributes", _v$2, _p$.t));
            _v$3 !== _p$.a && (_p$.a = _$setProp(_el$8, "fg", _v$3, _p$.a));
            _v$4 !== _p$.o && (_p$.o = _$setProp(_el$0, "fg", _v$4, _p$.o));
            _v$5 !== _p$.i && (_p$.i = _$setProp(_el$1, "fg", _v$5, _p$.i));
            return _p$;
          }, {
            e: undefined,
            t: undefined,
            a: undefined,
            o: undefined,
            i: undefined
          });
          return _el$5;
        }
      }), null);
      _$effect(_p$ => {
        var _v$6 = props.context.theme.text.base,
          _v$7 = props.context.theme.text.base,
          _v$8 = TextAttributes.BOLD;
        _v$6 !== _p$.e && (_p$.e = _$setProp(_el$3, "fg", _v$6, _p$.e));
        _v$7 !== _p$.t && (_p$.t = _$setProp(_el$4, "fg", _v$7, _p$.t));
        _v$8 !== _p$.a && (_p$.a = _$setProp(_el$4, "attributes", _v$8, _p$.a));
        return _p$;
      }, {
        e: undefined,
        t: undefined,
        a: undefined
      });
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
