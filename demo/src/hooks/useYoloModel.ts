import { useEffect, useState } from "react";
import { YOLO } from "@ultralytics/yolo";
import inferenceWasmUrl from "@ultralytics/yolo/pkg/ultralytics_inference_web_bg.wasm?url";
import type { LoadedModel, ModelStatus } from "../types";

const MODEL_PATH = "/models/bdsl-yolov8s.onnx";

let modelPromise: Promise<LoadedModel> | null = null;

function loadModelOnce() {
  if (!modelPromise) {
    modelPromise = YOLO.load(MODEL_PATH, {
      wasmUrl: inferenceWasmUrl,
      device: "auto",
    }).catch((error: unknown) => {
      modelPromise = null;
      throw error;
    });
  }

  return modelPromise;
}

export function useYoloModel() {
  const [model, setModel] = useState<LoadedModel | null>(null);
  const [status, setStatus] = useState<ModelStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [runtime, setRuntime] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    loadModelOnce()
      .then((loadedModel) => {
        if (!active) return;

        // Read the WASM-backed getter once while the model is idle. Reading it
        // from render while predict() owns the Rust object causes an aliasing trap.
        let loadedRuntime: string | null = null;
        try {
          const device = String(loadedModel.device);
          loadedRuntime = device ? device.toUpperCase() : null;
        } catch (runtimeError) {
          console.error("[BdSL model runtime]", runtimeError);
        }

        setRuntime(loadedRuntime);
        setModel(loadedModel);
        setStatus("ready");
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        console.error("[BdSL model load]", loadError);
        setError(
          loadError instanceof Error
            ? loadError.message
            : String(loadError || "The model could not be loaded."),
        );
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = () => {
    setModel(null);
    setRuntime(null);
    setError(null);
    setStatus("loading");
    setAttempt((value) => value + 1);
  };

  return { model, status, error, runtime, retry };
}
