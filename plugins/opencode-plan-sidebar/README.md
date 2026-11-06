# opencode-plan-sidebar

Plugin para **OpenCode V2** que muestra en el **Sidebar vertical de la TUI** las etapas (tareas/fases), los checks (`[x]`, `[▶]`, `[→]`, `[ ]`), el paso en curso y el próximo paso de un plan en tiempo real.

## Características

- **Detección automática:**
  - Si estás creando o editando un plan en la sesión (usando `write`, `edit` o `patch` sobre un archivo `.md` con tareas/checkboxes), o si el agente lee un plan en `/docs`, `.opencode/plan` o `~/.opencode/plan`, se vincula automáticamente a la sesión.
  - Compatible con planes de **Superpowers** (detecta comandos `sdd-workspace`, `task-start`, `task-done` y fusiona el estado de `.superpowers/sdd/<plan>/progress.md`).
- **Sincronización en vivo:**
  - Vigila el archivo `.md` activo en disco (`fs.watch`) y actualiza el Sidebar al instante mediante RPC.
  - Añade una instrucción ligera al contexto del agente para que marque cada `- [ ]` como `- [x]` conforme completa cada paso.
- **Selección manual (`/plan`):**
  - Escribe `/plan` en la TUI (o búscalo en la paleta de comandos `Ctrl+P`) para abrir un selector con todos los planes detectados en el proyecto (`docs/`, `.opencode/plan/`, `~/.opencode/plan/`) o introducir cualquier ruta manualmente.
  - Escribe `/plan docs/ruta/al/plan.md` para cargar un archivo directamente.
  - Escribe `/plan clear` para ocultar el plan del Sidebar en la sesión actual.

## Cómo activarlo en `opencode.jsonc`

Añade la ruta del plugin al array `"plugins"` de tu `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "/Users/mmartinez/Code/OpenCode/Plugins/opencode-plan-sidebar"
  ]
}
```
