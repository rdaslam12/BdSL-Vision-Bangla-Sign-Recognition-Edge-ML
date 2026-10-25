import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const demoDirectory = join(projectRoot, "demo");
const builtIndex = join(demoDirectory, "dist", "index.html");
const builtModel = join(demoDirectory, "dist", "models", "bdsl-yolov8s.onnx");
const viteCli = join(demoDirectory, "node_modules", "vite", "bin", "vite.js");

async function requireSetup() {
  try {
    await Promise.all([
      access(builtIndex, constants.R_OK),
      access(builtModel, constants.R_OK),
      access(viteCli, constants.R_OK),
    ]);
  } catch {
    console.error(
      "BdSL Vision is not set up yet. Run npm run setup from the repository root, then run npm start again.",
    );
    process.exitCode = 1;
    return false;
  }

  return true;
}

async function main() {
  if (!(await requireSetup())) return;

  const args = [viteCli, "preview", "--host", "127.0.0.1", "--port", "4173"];
  if (process.env.BDSL_VISION_NO_OPEN !== "1") args.push("--open");

  console.log("Starting BdSL Vision locally. Press Ctrl+C to stop the server.");
  console.log("If port 4173 is occupied, Vite will select and report the next available local port.");

  const server = spawn(process.execPath, args, {
    cwd: demoDirectory,
    stdio: "inherit",
  });

  server.once("error", (error) => {
    console.error(`Unable to start the local server: ${error.message}`);
    process.exitCode = 1;
  });

  server.once("exit", (code, signal) => {
    if (signal) {
      process.exitCode = 0;
    } else {
      process.exitCode = code ?? 1;
    }
  });
}

main().catch((error) => {
  console.error(`Unable to start BdSL Vision: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
