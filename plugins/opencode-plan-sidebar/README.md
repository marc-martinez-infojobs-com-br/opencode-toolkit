# opencode-plan-sidebar

Plugin de la suite **`opencode-toolkit`** para **OpenCode V2** que muestra en el **Sidebar vertical de la TUI** las etapas (tareas/fases) y los checks (`[x]`, `[▶]`, `[ ]`) de un plan en tiempo real.

## Características

- **Aislamiento por sesión (`sessionID`):**
  - Cada sesión de OpenCode mantiene su propio plan activo sin compartirse ni interferir con otras sesiones.
- **Detección automática al crear o editar planes:**
  - Si estás creando o modificando un plan en la sesión (`write`, `edit` o `patch` sobre un archivo `.md` con fases/checkboxes), se vincula automáticamente a la sesión actual.
  - Compatible con planes de **Superpowers** (detecta comandos `sdd-workspace`, `task-start`, `task-done` y fusiona el estado de `.superpowers/sdd/<plan>/progress.md`).
- **Sincronización en vivo:**
  - Vigila el archivo `.md` activo en disco (`fs.watch`) y actualiza el Sidebar al instante mediante RPC.
  - Añade una instrucción ligera al contexto del agente para que marque cada `- [ ]` como `- [x]` conforme completa cada paso.
- **Diseño limpio e integrado con la TUI:**
  - Barra de progreso a ancho completo con el mismo estilo visual que `opencode-quota`.
  - Resalta únicamente la Fase y el paso en curso en blanco con `▶` (`[▶]`), manteniendo el resto en gris.
- **Selección manual (`/plan`):**
  - Escribe `/plan` en la TUI (o búscalo en la paleta de comandos `Ctrl+P`) para abrir un selector con todos los planes detectados en el proyecto (`docs/`, `.opencode/plan/`, `~/.opencode/plan/`) o introducir cualquier ruta manualmente.
  - Escribe `/plan docs/ruta/al/plan.md` para cargar un archivo directamente.
  - Escribe `/plan clear` para ocultar el plan del Sidebar en la sesión actual.

## Instalación desde `opencode-toolkit`

### Desde GitHub (`::path:`)
```bash
opencode plugin add 'github:<organizacion>/opencode-toolkit#main::path:plugins/opencode-plan-sidebar'
```

### Copia local en `~/.config/opencode/plugins/`
```bash
cp -R ./plugins/opencode-plan-sidebar ~/.config/opencode/plugins/opencode-plan-sidebar
```
