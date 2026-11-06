# OpenCode Suite — Plugins & Skills

Repositorio centralizado de **Plugins** y **Skills** para **OpenCode V2**, diseñado para estandarizar y potenciar el flujo de trabajo del equipo (compatible con **macOS**, **Linux** y **Windows 11**).

---

## 📁 Estructura del repositorio

```text
OpenCode/
├── plugins/
│   └── opencode-plan-sidebar/    # Plugin TUI + Server para visualizar planes en el Sidebar
└── skills/
    └── models_tokens/            # Skill /tokens para consultar modelos, costes y Score en BenchLM.ai
```

---

## 🧩 Plugins disponibles

### 1. [`opencode-plan-sidebar`](./plugins/opencode-plan-sidebar)
Visualiza en tiempo real en el **Sidebar vertical de la TUI** las etapas (fases/tareas) y checks (`[x]`, `[▶]`, `[ ]`) de un plan en Markdown, junto con una barra de progreso a ancho completo.

- **Comando:** `/plan` (abre el selector interactivo de planes detectados en `/docs` o `.opencode/plan`), `/plan <ruta.md>` o `/plan clear`.
- **Características:**
  - **Aislamiento por sesión:** cada sesión mantiene su propio plan activo sin interferir con otras sesiones abiertas.
  - **Detección automática:** vincula el plan cuando se crea o edita en la sesión (`write`, `edit`, `patch`) o cuando se ejecutan scripts de **Superpowers** (`sdd-workspace`, `task-start`, `task-done`).
  - **Sincronización en vivo:** vigila cambios en disco (`fs.watch`) y actualiza los checks en tiempo real conforme el agente avanza.
- 📖 **[Ver documentación del plugin →](./plugins/opencode-plan-sidebar/README.md)**

---

## 📚 Skills disponibles

### 1. [`models-tokens`](./skills/models_tokens)
Consulta dinámicamente en tiempo real los modelos de código y agentes configurados en **OpenCode** (todos o filtrados por proveedor: `copilot`, `google`, `opencode`, `ollama`), extrae su ventana de contexto y sus costes en créditos, y los cruza con el ranking público de **[BenchLM.ai](https://benchlm.ai/)** (`Score`).

- **Comando:** `/tokens` (o `/tokens copilot`, `/tokens google`, `/tokens opencode`, `/tokens ollama`).
- **Incluye:**
  - Tabla ordenada de mayor a menor `Score` con los tramos de contexto disponibles (`200K / 1M`, `100K / 1M`, `272K / 1M`, etc.), costes por tramo obtenidos prioritariamente de **OpenRouter** (`Input`, `Output`, `Cache Read`, `Cache Write`) con fallback a OpenCode, y categoría de coste (`FREE`, `LOW`, `MEDIUM`, `HIGH`).
  - Resaltado en la propia tabla del modelo ganador (`🧠`, `🛠️`, `💻`) y las alternativas (#2 y #3) para cada tipo de tarea.
  - Recomendación directa de los 3 mejores modelos por orden para:
    - 🧠 **Brainstorming, Especificación y Plan**
    - 🛠️ **Implementaciones generales, uso general**
    - 💻 **Implementaciones guiadas o sencillas**
- 📖 **[Ver documentación de la skill →](./skills/models_tokens/README.md)**

---

## 🚀 Cómo instalar en tu entorno

### Opción 1: Instalar un plugin directamente desde GitHub

OpenCode V2 permite instalar plugins alojados en subcarpetas de un repositorio Git mediante el selector `::path:`:

```bash
opencode plugin add 'github:<organizacion>/<repositorio>#main::path:plugins/opencode-plan-sidebar'
```

O añadiéndolo en `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "github:<organizacion>/<repositorio>#main::path:plugins/opencode-plan-sidebar"
  ]
}
```

---

### Opción 2: Clonar el repositorio en local (Plugins + Skills)

Si clonas este repositorio en tu máquina (por ejemplo en `~/Code/OpenCode`), puedes referenciar tanto la carpeta de `skills` como los `plugins` o copiarlos a tu carpeta global `~/.config/opencode/`.

#### En macOS / Linux (`~/.config/opencode/`)

- **Para instalar un plugin globalmente:**
  ```bash
  mkdir -p ~/.config/opencode/plugins
  cp -R ./plugins/opencode-plan-sidebar ~/.config/opencode/plugins/opencode-plan-sidebar
  ```
- **Para instalar la skill `models-tokens` globalmente:**
  ```bash
  mkdir -p ~/.config/opencode/skills/models-tokens
  cp -R ./skills/models_tokens/* ~/.config/opencode/skills/models-tokens/
  chmod +x ~/.config/opencode/skills/models-tokens/scripts/fetch_tokens.py
  ```

#### En Windows 11 (`%USERPROFILE%\.config\opencode\`)

- **En PowerShell:**
  ```powershell
  # Copiar plugin opencode-plan-sidebar
  New-Item -ItemType Directory -Force -Path "$HOME\.config\opencode\plugins" | Out-Null
  Copy-Item -Path ".\plugins\opencode-plan-sidebar" -Destination "$HOME\.config\opencode\plugins\opencode-plan-sidebar" -Recurse -Force

  # Copiar skill models-tokens
  New-Item -ItemType Directory -Force -Path "$HOME\.config\opencode\skills\models-tokens" | Out-Null
  Copy-Item -Path ".\skills\models_tokens\*" -Destination "$HOME\.config\opencode\skills\models-tokens\" -Recurse -Force
  ```
