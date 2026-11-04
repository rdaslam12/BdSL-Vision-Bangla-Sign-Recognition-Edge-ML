import { annotate } from "@ultralytics/yolo";
import type { PredictionResults } from "../hooks/useInferenceCoordinator";
import type { Detection, InferenceSummary } from "../types";
const MAX_ANNOTATION_EDGE = 1600;
const MAX_ANNOTATION_PIXELS = 2_000_000;
type InferenceSource = HTMLImageElement | HTMLVideoElement;
export type SurfaceIssue = { kind: "input" | "prediction" | "camera" | "preview"; message: string };
export function surfaceIssueTitle(kind: SurfaceIssue["kind"]) {
  if (kind === "input") return "Image unavailable";
  if (kind === "prediction") return "Inference paused";
  if (kind === "camera") return "Camera unavailable";
  return "Preview unavailable";
}

export function describeError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error !== null && error !== undefined) return String(error);
  return fallback;
}

export function cameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Camera access was denied. Allow camera permission in your browser and try again.";
    }
    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") {
      return "No compatible camera was found on this device.";
    }
    if (error.name === "NotReadableError") {
      return "The camera is already in use by another application.";
    }
  }

  return "The camera could not be started. Check that it is available, then try again or use image mode.";
}

export function finiteNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function toSummary(results: PredictionResults | undefined): InferenceSummary {
  const boxes = Array.isArray(results?.boxes) ? results.boxes : [];
  const detections: Detection[] = boxes
    .map((box) => ({
      name: String(box.name ?? "Unknown sign"),
      confidence: finiteNumber(box.conf),
      x1: finiteNumber(box.x1),
      y1: finiteNumber(box.y1),
      x2: finiteNumber(box.x2),
      y2: finiteNumber(box.y2),
    }))
    .sort((a, b) => b.confidence - a.confidence);

  const inference = Number(results?.speed?.inference);
  return {
    detections,
    inferenceMs: Number.isFinite(inference) ? inference : null,
  };
}

export function sourceDimensions(source: InferenceSource) {
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  return { width: source.videoWidth, height: source.videoHeight };
}

export function isSourceReady(source: InferenceSource) {
  const { width, height } = sourceDimensions(source);
  if (source instanceof HTMLImageElement) {
    return source.complete && width > 0 && height > 0;
  }
  return source.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && width > 0 && height > 0;
}

export function boundedDimensions(width: number, height: number) {
  const edgeScale = Math.min(1, MAX_ANNOTATION_EDGE / Math.max(width, height));
  const pixelScale = Math.min(1, Math.sqrt(MAX_ANNOTATION_PIXELS / (width * height)));
  const scale = Math.min(edgeScale, pixelScale);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function annotationResults(
  results: PredictionResults,
  width: number,
  height: number,
): PredictionResults {
  const originalWidth = finiteNumber(results.width, width) || width;
  const originalHeight = finiteNumber(results.height, height) || height;
  const scaleX = width / originalWidth;
  const scaleY = height / originalHeight;

  return {
    ...results,
    width,
    height,
    boxes: (results.boxes ?? []).map((box) => ({
      ...box,
      x1: finiteNumber(box.x1) * scaleX,
      y1: finiteNumber(box.y1) * scaleY,
      x2: finiteNumber(box.x2) * scaleX,
      y2: finiteNumber(box.y2) * scaleY,
    })),
    obb: (results.obb ?? []).map((box) => ({
      ...box,
      x: finiteNumber(box.x) * scaleX,
      y: finiteNumber(box.y) * scaleY,
      w: finiteNumber(box.w) * scaleX,
      h: finiteNumber(box.h) * scaleY,
    })),
    keypoints: (results.keypoints ?? []).map((keypoints) => ({
      ...keypoints,
      points: keypoints.points.map(([x, y, confidence]) => [
        finiteNumber(x) * scaleX,
        finiteNumber(y) * scaleY,
        finiteNumber(confidence),
      ]),
    })),
    // This demo uses a detection model. Do not copy potentially large WASM-backed
    // overlays into the bounded display canvas.
    masks: new Uint8Array(),
    semantic_mask: undefined,
    depth: new Uint8Array(),
  };
}

export async function createAnnotation(
  source: InferenceSource | null,
  results: PredictionResults | undefined,
) {
  if (!source || !results) {
    throw new Error("Annotation was skipped because its source or results were unavailable.");
  }
  if (!isSourceReady(source)) {
    throw new Error("Annotation source was not ready.");
  }

  try {
    const sourceSize = sourceDimensions(source);
    const size = boundedDimensions(sourceSize.width, sourceSize.height);
    const boundedSource = document.createElement("canvas");
    boundedSource.width = size.width;
    boundedSource.height = size.height;
    const context = boundedSource.getContext("2d");
    if (!context) throw new Error("Could not create the annotation canvas context.");
    context.drawImage(source, 0, 0, size.width, size.height);
    const annotation = document.createElement("canvas");
    await annotate(annotation, boundedSource, annotationResults(results, size.width, size.height));
    return annotation;
  } catch (error) {
    console.error("[BdSL annotate]", error);
    throw error;
  }
}

export function presentAnnotation(canvas: HTMLCanvasElement | null, annotation: HTMLCanvasElement) {
  if (!canvas) throw new Error("The annotation preview is unavailable.");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create the preview canvas context.");
  canvas.width = annotation.width;
  canvas.height = annotation.height;
  context.drawImage(annotation, 0, 0);
}

export function clearCanvas(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  canvas.width = 0;
  canvas.height = 0;
}

export function waitForVideoMetadata(video: HTMLVideoElement) {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA && video.videoWidth > 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const onLoaded = () => finish();
    const onError = () => finish(new Error("The camera stream could not be decoded."));
    const timeout = window.setTimeout(() => finish(new Error("Camera metadata timed out.")), 10_000);
    const finish = (error?: Error) => {
      window.clearTimeout(timeout);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
      error ? reject(error) : resolve();
    };

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("error", onError);
  });
}

