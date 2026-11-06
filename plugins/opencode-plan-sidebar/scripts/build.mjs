import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { transformAsync } from "@babel/core"
import presetTypescript from "@babel/preset-typescript"
import presetSolid from "babel-preset-solid"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const distDir = path.join(rootDir, "dist")
const srcDir = path.join(rootDir, "src")

fs.rmSync(distDir, { recursive: true, force: true })

// 1. Run tsc to emit JS and .d.ts files (JSX preserved as dist/tui.jsx)
const tscBin = path.join(rootDir, "node_modules", ".bin", "tsc")
execFileSync(tscBin, ["-p", path.join(rootDir, "tsconfig.json")], {
  cwd: rootDir,
  stdio: "inherit",
})

// 2. Compile src/tui.tsx -> dist/tui.js using babel-preset-solid for @opentui/solid
const tuiSource = fs.readFileSync(path.join(srcDir, "tui.tsx"), "utf8")
const transformed = await transformAsync(tuiSource, {
  filename: path.join(srcDir, "tui.tsx"),
  presets: [
    [
      presetSolid,
      {
        moduleName: "@opentui/solid",
        generate: "universal",
      },
    ],
    [presetTypescript, { isTSX: true, allExtensions: true }],
  ],
})

if (!transformed?.code) {
  throw new Error("Failed to transform src/tui.tsx with babel-preset-solid")
}

fs.writeFileSync(path.join(distDir, "tui.js"), `${transformed.code}\n`, "utf8")
const jsxArtifact = path.join(distDir, "tui.jsx")
if (fs.existsSync(jsxArtifact)) {
  fs.rmSync(jsxArtifact)
}

console.log("Built opencode-plan-sidebar dist/ successfully.")
