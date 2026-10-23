import { useCallback, useEffect, useRef, useState } from "react";
import { annotate } from "@ultralytics/yolo";
import { ResultsPanel } from "./components/ResultsPanel";
import { useYoloModel } from "./hooks/useYoloModel";
import type { DemoMode, Detection, InferenceSummary, LoadedModel } from "./types";

const PREDICTION_OPTIONS = { conf: 0.25, iou: 0.7 } as const;
const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_ANNOTATION_EDGE = 1600;
const MAX_ANNOTATION_PIXELS = 2_000_000;
const EMPTY_SUMMARY: InferenceSummary = { detections: [], inferenceMs: null };

type PredictionResults = Awaited<ReturnType<LoadedModel["predict"]>>;
type InferenceSource = HTMLImageElement | HTMLVideoElement;

function describeError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error !== null && error !== undefined) return String(error);
  return fallback;
}

function cameraErrorMessage(error: unknown) {
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

  return describeError(error, "The camera could not be started.");
}

function finiteNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toSummary(results: PredictionResults | undefined): InferenceSummary {
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

function sourceDimensions(source: InferenceSource) {
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  return { width: source.videoWidth, height: source.videoHeight };
}

function isSourceReady(source: InferenceSource) {
  const { width, height } = sourceDimensions(source);
  if (source instanceof HTMLImageElement) {
    return source.complete && width > 0 && height > 0;
  }
  return source.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && width > 0 && height > 0;
}

function boundedDimensions(width: number, height: number) {
  const edgeScale = Math.min(1, MAX_ANNOTATION_EDGE / Math.max(width, height));
  const pixelScale = Math.min(1, Math.sqrt(MAX_ANNOTATION_PIXELS / (width * height)));
  const scale = Math.min(edgeScale, pixelScale);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function annotationResults(
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

async function annotateSafely(
  canvas: HTMLCanvasElement | null,
  source: InferenceSource | null,
  results: PredictionResults | undefined,
) {
  if (!canvas || !source || !results) {
    throw new Error("Annotation was skipped because its canvas, source, or results were unavailable.");
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
    await annotate(canvas, boundedSource, annotationResults(results, size.width, size.height));
  } catch (error) {
    console.error("[BdSL annotate]", error);
    throw error;
  }
}

function waitForVideoMetadata(video: HTMLVideoElement) {
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

function App() {
  const {
    model,
    status: modelStatus,
    error: modelError,
    runtime,
    retry: retryModel,
  } = useYoloModel();
  const [mode, setMode] = useState<DemoMode>("upload");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [summary, setSummary] = useState<InferenceSummary>(EMPTY_SUMMARY);
  const [hasResult, setHasResult] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [surfaceError, setSurfaceError] = useState<string | null>(null);
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [cameraFrameReady, setCameraFrameReady] = useState(false);

  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedFileRef = useRef<File | null>(null);
  const currentImageUrlRef = useRef<string | null>(null);
  const imageUrlsInUseRef = useRef(new Set<string>());
  const retiredImageUrlsRef = useRef(new Set<string>());
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const cameraInFlightRef = useRef(false);
  const cameraSessionRef = useRef(0);
  const imageRequestRef = useRef(0);

  const controlsDisabled = modelStatus !== "ready";

  const stopCamera = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const releaseImageUrl = useCallback((url: string) => {
    imageUrlsInUseRef.current.delete(url);
    if (retiredImageUrlsRef.current.delete(url)) URL.revokeObjectURL(url);
  }, []);

  const runImageInference = useCallback(async () => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    const file = selectedFileRef.current;
    const requestUrl = imageUrl;
    if (!model || !file || !requestUrl || !image || !canvas) return;

    const requestId = ++imageRequestRef.current;
    imageUrlsInUseRef.current.add(requestUrl);
    setIsPredicting(true);
    setSurfaceError(null);
    setHasResult(false);

    try {
      try {
        await image.decode();
      } catch (decodeError) {
        if (requestId !== imageRequestRef.current) return;
        console.error("[BdSL image decode]", decodeError);
        throw new Error(
          describeError(decodeError, "The selected image could not be decoded."),
        );
      }

      if (
        requestId !== imageRequestRef.current ||
        imageRef.current !== image ||
        canvasRef.current !== canvas ||
        !isSourceReady(image)
      ) {
        return;
      }

      let results: PredictionResults;
      try {
        results = await model.predict(file, PREDICTION_OPTIONS);
      } catch (predictionError) {
        console.error("[BdSL upload inference]", predictionError);
        throw predictionError;
      }

      if (requestId !== imageRequestRef.current) return;
      const nextSummary = toSummary(results);
      let annotationError: unknown = null;

      try {
        await annotateSafely(canvasRef.current, imageRef.current, results);
      } catch (error) {
        annotationError = error;
      }

      if (requestId !== imageRequestRef.current) return;
      setSummary(nextSummary);
      setHasResult(true);
      if (annotationError) {
        setSurfaceError(
          `Results are available, but the preview could not be annotated: ${describeError(
            annotationError,
            "drawing failed",
          )}`,
        );
      }
    } catch (error) {
      if (requestId !== imageRequestRef.current) return;
      setSurfaceError(
        describeError(error, "Inference failed for this image. Try another JPG or PNG file."),
      );
    } finally {
      releaseImageUrl(requestUrl);
      if (requestId === imageRequestRef.current) setIsPredicting(false);
    }
  }, [imageUrl, model, releaseImageUrl]);

  useEffect(() => {
    if (mode !== "camera" || !model) return;

    const sessionId = ++cameraSessionRef.current;
    let disposed = false;
    let annotationEnabled = true;
    const isCurrentSession = () =>
      !disposed && cameraSessionRef.current === sessionId;
    setSurfaceError(null);
    setHasResult(false);
    setCameraFrameReady(false);

    const scheduleNextFrame = (callback: () => void) => {
      if (isCurrentSession()) animationFrameRef.current = requestAnimationFrame(callback);
    };

    const failCamera = (error: unknown) => {
      console.error("[BdSL camera inference]", error);
      if (isCurrentSession()) {
        setSurfaceError(cameraErrorMessage(error));
        setIsPredicting(false);
      }
      disposed = true;
      stopCamera();
    };

    const predictFrame = async () => {
      animationFrameRef.current = null;
      if (!isCurrentSession()) return;
      if (cameraInFlightRef.current) {
        scheduleNextFrame(() => void predictFrame());
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (
        !video ||
        !canvas ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        video.videoWidth <= 0 ||
        video.videoHeight <= 0
      ) {
        scheduleNextFrame(() => void predictFrame());
        return;
      }

      cameraInFlightRef.current = true;
      let predictionFailed = false;
      try {
        let results: PredictionResults;
        try {
          results = await model.predict(video, PREDICTION_OPTIONS);
        } catch (predictionError) {
          predictionFailed = true;
          failCamera(predictionError);
          return;
        }

        if (!isCurrentSession()) return;
        const nextSummary = toSummary(results);

        if (annotationEnabled) {
          try {
            await annotateSafely(canvasRef.current, videoRef.current, results);
            if (isCurrentSession()) {
              setCameraFrameReady(true);
              setSurfaceError(null);
            }
          } catch (annotationError) {
            annotationEnabled = false;
            if (isCurrentSession()) {
              setCameraFrameReady(false);
              setSurfaceError(
                `Live results are available, but annotation was disabled: ${describeError(
                  annotationError,
                  "drawing failed",
                )}`,
              );
            }
          }
        }

        if (isCurrentSession()) {
          setSummary(nextSummary);
          setHasResult(true);
        }
      } finally {
        cameraInFlightRef.current = false;
        if (isCurrentSession() && !predictionFailed) {
          scheduleNextFrame(() => void predictFrame());
        }
      }
    };

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        failCamera(new Error("Camera access is not supported by this browser."));
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (!isCurrentSession()) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) {
          stream.getTracks().forEach((track) => track.stop());
          throw new Error("Camera preview is unavailable.");
        }

        streamRef.current = stream;
        video.srcObject = stream;
        await waitForVideoMetadata(video);
        if (!isCurrentSession()) return;
        await video.play();
        if (
          !isCurrentSession() ||
          video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
          video.videoWidth <= 0 ||
          video.videoHeight <= 0
        ) {
          throw new Error("The camera did not provide a usable video frame.");
        }

        setIsPredicting(true);
        scheduleNextFrame(() => void predictFrame());
      } catch (error) {
        if (isCurrentSession()) failCamera(error);
      }
    };

    void startCamera();

    return () => {
      disposed = true;
      if (cameraSessionRef.current === sessionId) cameraSessionRef.current += 1;
      stopCamera();
    };
  }, [cameraAttempt, mode, model, stopCamera]);

  useEffect(
    () => () => {
      imageRequestRef.current += 1;
      stopCamera();
      for (const url of retiredImageUrlsRef.current) URL.revokeObjectURL(url);
      if (currentImageUrlRef.current) URL.revokeObjectURL(currentImageUrlRef.current);
    },
    [stopCamera],
  );

  useEffect(() => {
    currentImageUrlRef.current = imageUrl;
    if (!imageUrl) return;

    return () => {
      if (imageUrlsInUseRef.current.has(imageUrl)) {
        retiredImageUrlsRef.current.add(imageUrl);
      } else {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  const selectMode = (nextMode: DemoMode) => {
    if (controlsDisabled || nextMode === mode) return;
    imageRequestRef.current += 1;
    if (mode === "camera") {
      cameraSessionRef.current += 1;
      stopCamera();
    }
    setIsPredicting(false);
    setMode(nextMode);
    setSummary(EMPTY_SUMMARY);
    setHasResult(false);
    setSurfaceError(null);
    setCameraFrameReady(false);
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!SUPPORTED_TYPES.has(file.type)) {
      setSurfaceError("Choose a JPG, JPEG, or PNG image.");
      return;
    }

    imageRequestRef.current += 1;
    selectedFileRef.current = file;
    const nextUrl = URL.createObjectURL(file);
    setImageUrl(nextUrl);
    setImageName(file.name);
    setSummary(EMPTY_SUMMARY);
    setHasResult(false);
    setSurfaceError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImageError = (error: unknown) => {
    console.error("[BdSL image decode]", error);
    setSurfaceError("The selected image could not be decoded.");
    setIsPredicting(false);
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand-block">
          <h1>BdSL Vision</h1>
          <p>18-class Bangla Sign Language recognition running locally in your browser.</p>
        </div>
        <div className="badges" aria-label="Model details">
          <span>YOLOv8s</span>
          <span>18 classes</span>
          <span>416 × 416</span>
          <span>Local inference</span>
        </div>
      </header>

      <main>
        <section className="workspace" aria-label="BdSL inference workspace">
          <div className="workspace-controls">
            <div className="mode-switch" aria-label="Input mode">
              <button
                type="button"
                className={mode === "upload" ? "is-active" : undefined}
                onClick={() => selectMode("upload")}
                disabled={controlsDisabled}
                aria-pressed={mode === "upload"}
              >
                Upload Image
              </button>
              <button
                type="button"
                className={mode === "camera" ? "is-active" : undefined}
                onClick={() => selectMode("camera")}
                disabled={controlsDisabled}
                aria-pressed={mode === "camera"}
              >
                Use Camera
              </button>
            </div>

            <div className={`model-chip model-chip--${modelStatus}`} role="status">
              <span aria-hidden="true" />
              {modelStatus === "ready"
                ? "Model ready"
                : modelStatus === "error"
                  ? "Model error"
                  : "Loading model"}
            </div>
          </div>

          {(modelError || surfaceError) && (
            <div className="error-message" role="alert">
              <strong>{modelError ? "Model unavailable" : "Unable to continue"}</strong>
              <span>{modelError || surfaceError}</span>
              {modelError ? (
                <button type="button" onClick={retryModel}>
                  Retry model
                </button>
              ) : mode === "camera" && surfaceError ? (
                <button type="button" onClick={() => setCameraAttempt((value) => value + 1)}>
                  Try camera again
                </button>
              ) : null}
            </div>
          )}

          <div className="workbench">
            <div className="preview-column">
              <div className="preview-header">
                <div>
                  <h2>{mode === "camera" ? "Live camera" : imageName || "No image selected"}</h2>
                </div>

                {mode === "upload" && (
                  <>
                    <input
                      ref={fileInputRef}
                      className="visually-hidden"
                      id="image-upload"
                      type="file"
                      accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                      disabled={controlsDisabled}
                      onChange={(event) => handleFile(event.target.files?.[0])}
                    />
                    <label
                      className={`file-control ${controlsDisabled ? "is-disabled" : ""}`}
                      htmlFor="image-upload"
                    >
                      {imageUrl ? "Replace image" : "Choose image"}
                    </label>
                  </>
                )}
              </div>

              <div className="preview-stage">
                {mode === "upload" ? (
                  imageUrl ? (
                    <div className="media-stack">
                      <img
                        ref={imageRef}
                        src={imageUrl}
                        alt="Selected input for Bangla Sign Language detection"
                        onLoad={() => void runImageInference()}
                        onError={handleImageError}
                      />
                      <canvas
                        ref={canvasRef}
                        className={hasResult ? "is-visible" : undefined}
                        aria-label="Annotated detection output"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="empty-preview"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={controlsDisabled}
                    >
                      <svg viewBox="0 0 40 40" aria-hidden="true">
                        <path d="M7 11.5h26v20H7zM13 7v9M9 11l4-4 4 4M10 27l6-6 4 4 4-4 6 6" />
                      </svg>
                      <span>{controlsDisabled ? "Waiting for model" : "Select an image to run inference"}</span>
                      <small>JPG, JPEG, or PNG</small>
                    </button>
                  )
                ) : (
                  <div className="media-stack media-stack--camera">
                    <video
                      ref={videoRef}
                      muted
                      playsInline
                      className={cameraFrameReady ? "is-covered" : undefined}
                      aria-label="Live camera feed"
                    />
                    <canvas
                      ref={canvasRef}
                      className={cameraFrameReady ? "is-visible" : undefined}
                      aria-label="Live annotated camera output"
                    />
                    {!cameraFrameReady && !surfaceError && (
                      <div className="camera-waiting" role="status">
                        Starting camera…
                      </div>
                    )}
                  </div>
                )}

                {isPredicting && mode === "upload" && (
                  <div className="processing-indicator" role="status">
                    <span />
                    Running inference
                  </div>
                )}
              </div>
            </div>

            <ResultsPanel
              detections={summary.detections}
              hasResult={hasResult}
              inferenceMs={summary.inferenceMs}
              isPredicting={isPredicting}
              modelStatus={modelStatus}
              runtime={runtime}
            />
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <p>
          Research prototype. Supports a limited 18-sign vocabulary and is not a complete
          Bangla Sign Language translation system.
        </p>
        <p>Images and camera frames are processed locally in your browser.</p>
      </footer>
    </div>
  );
}

export default App;
