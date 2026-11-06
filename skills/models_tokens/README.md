# Skill `models-tokens`

Consulta en tiempo real los modelos disponibles en **OpenCode** (todos o filtrados por `copilot`, `google`, `opencode`, `ollama`), su ventana de contexto, sus costes en créditos y su clasificación en **[BenchLM.ai](https://benchlm.ai/)** mediante el comando `/tokens`.

---

## 1. Comandos disponibles

Una vez instalada, puedes usarla desde cualquier sesión de OpenCode:

- `/tokens` → Muestra la tabla con **todos** los modelos de código/agentes definidos.
- `/tokens copilot` → Muestra solo los modelos de **GitHub Copilot** (`github-copilot/`).
- `/tokens google` → Muestra solo los modelos de **Google** (`google/`).
- `/tokens opencode` → Muestra solo los modelos gratuitos de **OpenCode** (`opencode/`).
- `/tokens ollama` → Muestra solo los modelos locales de **Ollama** (`ollama/`).

---

## 2. Estructura de la skill

```text
models_tokens/
├── SKILL.md                   # Definición e instrucciones de la skill para OpenCode
├── README.md                  # Documentación de la skill
└── scripts/
    └── fetch_tokens.py        # Script que consulta OpenCode + OpenRouter + BenchLM.ai
```

| Archivo | Función |
| :--- | :--- |
| `SKILL.md` | Define el nombre (`models-tokens`), descripción y reglas de ejecución para que OpenCode detecte la skill en macOS, Linux y Windows 11. |
| `scripts/fetch_tokens.py` | Ejecuta `opencode api get /api/model`, filtra modelos de código/agentes (y proveedor si se pasa argumento), cruza con `leaderboard.json` y `models.json` de BenchLM.ai y genera la tabla Markdown + recomendaciones. |

---

## 3. Requisitos y configuración del comando `/tokens`

### Requisitos previos
- Tener **OpenCode** instalado.
- Tener **Python 3** instalado (`python3 --version` en macOS/Linux o `python --version` en Windows 11).

### Registro del comando `/tokens` en `opencode.jsonc`
Una vez copiada la carpeta de la skill en `~/.config/opencode/skills/models-tokens` (o `%USERPROFILE%\.config\opencode\skills\models-tokens` en Windows 11), añade el comando `tokens` en tu archivo `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "commands": {
    "tokens": {
      "description": "Mostrar modelos disponibles (todos o filtrados por copilot, google, opencode, ollama), costes y Score",
      "template": "Carga y sigue la skill models-tokens para consultar dinámicamente los modelos disponibles (filtro de proveedor: '$ARGUMENTS') y presentar la tabla solicitada."
    }
  }
}
```

### Verificación rápida del script
- **macOS / Linux:**
  ```bash
  python3 ~/.config/opencode/skills/models-tokens/scripts/fetch_tokens.py
  python3 ~/.config/opencode/skills/models-tokens/scripts/fetch_tokens.py copilot
  ```
- **Windows 11 (PowerShell):**
  ```powershell
  python "$HOME\.config\opencode\skills\models-tokens\scripts\fetch_tokens.py"
  python "$HOME\.config\opencode\skills\models-tokens\scripts\fetch_tokens.py" copilot
  ```

---

## 4. Qué muestra el reporte `/tokens`

1. **Tabla ordenada de mayor a menor `Score` (BenchLM.ai):**
   - **Modelo (contexto):** Nombre del modelo con sus tramos de contexto disponibles (`200K / 1M`, `100K / 1M`, `272K / 1M`, `200K / 500K`, `400K`, `256K`, `200K`).
   - **Provider:** Proveedor del modelo (`copilot`, `google`, `opencode`, `ollama`), mostrado cuando se consultan todos los proveedores.
   - **Input / Output / Cache Read / Cache Write:** Créditos por 1M de tokens obtenidos prioritariamente de la API de **OpenRouter** (con fallback a OpenCode si no existe en OpenRouter), mostrando los precios de cada tramo de contexto (`10 / 50`) sin duplicar cuando ambos tramos valen igual.
   - **Cost:** Clasificación automática según el tramo más caro de `max(Input, Output)`:
     - `FREE` (modelos gratuitos de `opencode` o locales de `ollama`)
     - `LOW` ≤ 500
     - `MEDIUM` < 2000
     - `HIGH` ≥ 2000
   - **Score:** Puntuación oficial de BenchLM.ai con su `#posición` (o puntuación provisional resaltada en código inline si aún no está en el leaderboard principal).
2. **Resaltado visual en la tabla:**
   - **Negrita + icono (`🧠`, `🛠️`, `💻`):** El modelo ganador (#1) de cada una de las 3 categorías de tarea.
   - **Color de código (`...`):** Las alternativas #2 y #3 recomendadas para cada tarea.
3. **Modelos Recomendados por Tarea (por orden):**
   - 🧠 **Brainstorming, Especificación y Plan**
   - 🛠️ **Implementaciones generales, uso general**
   - 💻 **Implementaciones guiadas o sencillas**
