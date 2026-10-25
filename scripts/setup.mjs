import { open, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const demoDirectory = join(projectRoot, "demo");
const modelPath = join(demoDirectory, "public", "models", "bdsl-yolov8s.onnx");
const supportedNode = "Node.js 20.19+ (20.x) or Node.js 22.12+";

function nodeVersionIsSupported(version) {
  const [major, minor] = version.split(".").map(Number);

  return (
    (major === 20 && minor >= 19) ||
    (major === 22 && minor >= 12) ||
    major > 22
  );
}

function runNpm(args) {
  const npmCli = process.env.npm_execpath;
  const npmCommand = npmCli
    ? { command: process.execPath, args: [npmCli, ...args] }
    : {
        command: process.platform === "win32" ? "npm.cmd" : "npm",
        args,
      };

  return new Promise((resolve, reject) => {
    const child = spawn(npmCommand.command, npmCommand.args, {
      cwd: demoDirectory,
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`npm was stopped by signal ${signal}.`));
      } else if (code !== 0) {
        reject(new Error(`npm ${args.join(" ")} failed with exit code ${code}.`));
      } else {
        resolve();
      }
    });
  });
}

async function verifyModel() {
  let modelStats;

  try {
    modelStats = await stat(modelPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(
        "The browser model is missing at demo/public/models/bdsl-yolov8s.onnx. " +
          "Restore the real ONNX model file, then run npm run setup again.",
      );
    }
    throw error;
  }

  if (!modelStats.isFile()) {
    throw new Error(
      "demo/public/models/bdsl-yolov8s.onnx is not a model file. " +
        "Restore the ONNX model file, then run npm run setup again.",
    );
  }

  const modelFile = await open(modelPath, "r");
  const headerBytes = Buffer.alloc(256);
  try {
    await modelFile.read(headerBytes, 0, headerBytes.length, 0);
  } finally {
    await modelFile.close();
  }
  const header = headerBytes.toString("utf8");

  if (header.trimStart().startsWith("version https://git-lfs.github.com/spec/v1")) {
    throw new Error(
      "demo/public/models/bdsl-yolov8s.onnx is a Git LFS pointer, not the model data. " +
        "Fetch the Git LFS file, then run npm run setup again.",
    );
  }

  if (modelStats.size < 1024) {
    throw new Error(
      "demo/public/models/bdsl-yolov8s.onnx is empty or too small to be a real model. " +
        "Restore the ONNX model file, then run npm run setup again.",
    );
  }
}

async function main() {
  const currentNode = process.versions.node;
  if (!nodeVersionIsSupported(currentNode)) {
    throw new Error(
      `Unsupported Node.js version ${currentNode}. Install ${supportedNode}, then run npm run setup again.`,
    );
  }

  console.log(`Using Node.js ${currentNode}.`);
  console.log("Installing demo dependencies from demo/package-lock.json...");
  await runNpm(["ci"]);

  console.log("Verifying the browser model...");
  await verifyModel();

  console.log("Building the browser application...");
  await runNpm(["run", "build"]);

  console.log("\nSetup complete. Launch BdSL Vision from the repository root with: npm start");
}

main().catch((error) => {
  console.error(`\nSetup failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
