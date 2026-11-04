import { useCallback, useEffect, useRef, useState } from "react";
import { ResultsPanel } from "./ResultsPanel";
import { SignGallery } from "./SignGallery";
import { PracticePanel } from "./PracticePanel";
import { useGuidedPractice } from "../hooks/useGuidedPractice";
import type { SignSample } from "../data/signs";
import { useInferenceCoordinator, type PredictionResults } from "../hooks/useInferenceCoordinator";
import { useYoloModel } from "../hooks/useYoloModel";
import type { DemoMode, InferenceSummary } from "../types";
import { surfaceIssueTitle, cameraErrorMessage, toSummary, isSourceReady, createAnnotation, presentAnnotation, clearCanvas, waitForVideoMetadata, type SurfaceIssue } from "../lib/presentation";
const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_IMAGE_SIZE_LABEL = "15 MB";
const EMPTY_SUMMARY: InferenceSummary = { detections: [], inferenceMs: null };
type CameraStatus = "idle" | "starting" | "running" | "stopped";
export function InferencePlayground() {
  const {
    model,
    status: modelStatus,
    error: modelError,
    runtime,
    retry: retryModel,
  } = useYoloModel();
  const predictLatest = useInferenceCoordinator(model);
  const [mode, setMode] = useState<DemoMode>("upload");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [summary, setSummary] = useState<InferenceSummary>(EMPTY_SUMMARY);
  const [hasResult, setHasResult] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [surfaceIssue, setSurfaceIssue] = useState<SurfaceIssue | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [previewReady, setPreviewReady] = useState(false);

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
  const cameraSessionRef = useRef(0);
  const cameraStatusRef = useRef<CameraStatus>("idle");
  const imageRequestRef = useRef(0);

  const practice = useGuidedPractice();
  const resetPractice = practice.reset;
  const recordPractice = practice.record;
  const practiceRevision = practice.revision;
  const controlsDisabled = modelStatus !== "ready";

  const updateCameraStatus = useCallback((status: CameraStatus) => {
    if (status !== "running") resetPractice();
    cameraStatusRef.current = status;
    setCameraStatus(status);
  }, [resetPractice]);

  const releaseCamera = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stopCamera = useCallback(() => {
    cameraSessionRef.current += 1;
    releaseCamera();
    updateCameraStatus("stopped");
    clearCanvas(canvasRef.current);
    setPreviewReady(false);
    setIsPredicting(false);
    setSummary(EMPTY_SUMMARY);
    setHasResult(false);
    setSurfaceIssue(null);
  }, [releaseCamera, updateCameraStatus]);

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
    const isCurrentRequest = () =>
      requestId === imageRequestRef.current &&
      imageRef.current === image &&
      canvasRef.current === canvas;
    imageUrlsInUseRef.current.add(requestUrl);
    clearCanvas(canvas);
    setPreviewReady(false);
    setIsPredicting(true);
    setSurfaceIssue(null);
    setHasResult(false);

    try {
      try {
        await image.decode();
      } catch (decodeError) {
        console.error("[BdSL image decode]", decodeError);
        if (isCurrentRequest()) {
          setSurfaceIssue({
            kind: "input",
            message: `This image could not be opened. Choose a valid JPG, JPEG, or PNG file up to ${MAX_IMAGE_SIZE_LABEL}.`,
          });
        }
        return;
      }

      if (!isCurrentRequest() || !isSourceReady(image)) return;

      let results: PredictionResults | null;
      try {
        results = await predictLatest(file, isCurrentRequest);
      } catch (predictionError) {
        console.error("[BdSL upload inference]", predictionError);
        if (isCurrentRequest()) {
          setSurfaceIssue({
            kind: "prediction",
            message: "This image could not be analysed. Try the image again or choose another JPG or PNG file.",
          });
        }
        return;
      }

      if (!results || !isCurrentRequest()) return;
      const nextSummary = toSummary(results);
      setSummary(nextSummary);
      setHasResult(true);

      try {
        const annotation = await createAnnotation(image, results);
        if (!isCurrentRequest()) return;
        presentAnnotation(canvas, annotation);
        setPreviewReady(true);
      } catch (annotationError) {
        if (!isCurrentRequest()) return;
        setPreviewReady(false);
        setSurfaceIssue({
          kind: "preview",
          message: "The detections are listed, but the annotated image preview could not be drawn.",
        });
      }
    } finally {
      releaseImageUrl(requestUrl);
      if (isCurrentRequest()) setIsPredicting(false);
    }
  }, [imageUrl, model, predictLatest, releaseImageUrl]);

  const startCamera = useCallback(async () => {
    if (
      !model ||
      mode !== "camera" ||
      cameraStatusRef.current === "starting" ||
      cameraStatusRef.current === "running"
    ) {
      return;
    }

    const sessionId = ++cameraSessionRef.current;
    let annotationEnabled = true;
    const isCurrentSession = () => cameraSessionRef.current === sessionId;
    updateCameraStatus("starting");
    releaseCamera();
    clearCanvas(canvasRef.current);
    setSurfaceIssue(null);
    setSummary(EMPTY_SUMMARY);
    setHasResult(false);
    setPreviewReady(false);
    setIsPredicting(false);

    const scheduleNextFrame = (callback: () => void) => {
      if (isCurrentSession()) animationFrameRef.current = requestAnimationFrame(callback);
    };

    const failCamera = (error: unknown, message: string) => {
      console.error("[BdSL camera inference]", error);
      if (!isCurrentSession()) return;
      releaseCamera();
      cameraSessionRef.current += 1;
      updateCameraStatus("stopped");
      clearCanvas(canvasRef.current);
      setPreviewReady(false);
      setIsPredicting(false);
      setSummary(EMPTY_SUMMARY);
      setHasResult(false);
      setSurfaceIssue({ kind: "camera", message });
    };

    const predictFrame = async () => {
      animationFrameRef.current = null;
      if (!isCurrentSession()) return;

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

      const targetRevision = practiceRevision.current;
      try {
        let results: PredictionResults | null;
        try {
          results = await predictLatest(video, isCurrentSession);
        } catch (predictionError) {
          failCamera(
            predictionError,
            "Camera inference stopped. Start the camera again, or switch to image mode and choose a JPG or PNG file.",
          );
          return;
        }

        if (!results || !isCurrentSession()) return;
        const nextSummary = toSummary(results);
        recordPractice(nextSummary.detections, targetRevision);
        setSummary(nextSummary);
        setHasResult(true);

        if (annotationEnabled) {
          try {
            const annotation = await createAnnotation(video, results);
            if (!isCurrentSession()) return;
            presentAnnotation(canvas, annotation);
            setPreviewReady(true);
            setSurfaceIssue(null);
          } catch (annotationError) {
            annotationEnabled = false;
            if (isCurrentSession()) {
              setPreviewReady(false);
              setSurfaceIssue({
                kind: "preview",
                message: "Live detections are listed, but the annotated camera preview could not be drawn.",
              });
            }
          }
        }
      } finally {
        if (isCurrentSession()) {
          scheduleNextFrame(() => void predictFrame());
        }
      }
    };

    if (!navigator.mediaDevices?.getUserMedia) {
      failCamera(
        new Error("Camera access is not supported by this browser."),
        "Camera access is not supported by this browser. Use image mode instead.",
      );
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

      updateCameraStatus("running");
      setIsPredicting(true);
      scheduleNextFrame(() => void predictFrame());
    } catch (error) {
      if (isCurrentSession()) failCamera(error, cameraErrorMessage(error));
    }
  }, [mode, model, predictLatest, releaseCamera, updateCameraStatus, recordPractice, practiceRevision]);

  useEffect(
    () => () => {
      imageRequestRef.current += 1;
      cameraSessionRef.current += 1;
      releaseCamera();
      for (const url of retiredImageUrlsRef.current) URL.revokeObjectURL(url);
      if (currentImageUrlRef.current) URL.revokeObjectURL(currentImageUrlRef.current);
    },
    [releaseCamera],
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
    if (nextMode === mode) return;
    imageRequestRef.current += 1;
    if (mode === "camera") stopCamera();
    setIsPredicting(false);
    setMode(nextMode);
    setSummary(EMPTY_SUMMARY);
    setHasResult(false);
    setSurfaceIssue(null);
    setPreviewReady(false);
    clearCanvas(canvasRef.current);
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!SUPPORTED_TYPES.has(file.type)) {
      setSurfaceIssue({
        kind: "input",
        message: `Choose a JPG, JPEG, or PNG image up to ${MAX_IMAGE_SIZE_LABEL}.`,
      });
      return;
    }
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      setSurfaceIssue({
        kind: "input",
        message:
          file.size === 0
            ? `This image is empty. Choose a valid JPG, JPEG, or PNG file up to ${MAX_IMAGE_SIZE_LABEL}.`
            : `This image is larger than ${MAX_IMAGE_SIZE_LABEL}. Choose a smaller JPG, JPEG, or PNG file.`,
      });
      return;
    }

    imageRequestRef.current += 1;
    selectedFileRef.current = file;
    const nextUrl = URL.createObjectURL(file);
    setImageUrl(nextUrl);
    setImageName(file.name);
    setSummary(EMPTY_SUMMARY);
    setHasResult(false);
    setIsPredicting(false);
    setPreviewReady(false);
    setSurfaceIssue(null);
    clearCanvas(canvasRef.current);
  };

  const clearImage = () => {
    imageRequestRef.current += 1;
    selectedFileRef.current = null;
    setImageUrl(null);
    setImageName(null);
    setSummary(EMPTY_SUMMARY);
    setHasResult(false);
    setIsPredicting(false);
    setPreviewReady(false);
    setSurfaceIssue(null);
    clearCanvas(canvasRef.current);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const practiceSign = (sample: SignSample) => {
    practice.selectTarget(sample.id);
    selectMode("camera");
    requestAnimationFrame(() => {
      document.getElementById("practice-target")?.focus({ preventScroll: true });
      document.getElementById("demo")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    });
  };

  const handleImageError = () => {
    console.error("[BdSL image decode] The browser rejected the selected file.", {
      name: selectedFileRef.current?.name,
      size: selectedFileRef.current?.size,
      type: selectedFileRef.current?.type,
    });
    imageRequestRef.current += 1;
    setSummary(EMPTY_SUMMARY);
    setHasResult(false);
    setIsPredicting(false);
    setPreviewReady(false);
    clearCanvas(canvasRef.current);
    setSurfaceIssue({
      kind: "input",
      message: `This image could not be opened. Choose a valid JPG, JPEG, or PNG file up to ${MAX_IMAGE_SIZE_LABEL}.`,
    });
  };

  return (
    <>
      <section id="demo" className="playground-section" aria-labelledby="playground-title">
        <h2 id="playground-title" className="visually-hidden">Live model workspace</h2>
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

          {(modelError || surfaceIssue) && (
            <div className="error-message" role="alert">
              <strong>
                {modelError ? "Model unavailable" : surfaceIssueTitle(surfaceIssue!.kind)}
              </strong>
              <span>{modelError || surfaceIssue?.message}</span>
              {modelError ? (
                <button type="button" onClick={retryModel}>
                  Retry model
                </button>
              ) : mode === "camera" &&
                surfaceIssue?.kind === "camera" &&
                cameraStatus === "stopped" ? (
                <button type="button" onClick={() => void startCamera()}>
                  Try camera again
                </button>
              ) : mode === "upload" && surfaceIssue?.kind === "prediction" ? (
                <button type="button" onClick={() => void runImageInference()}>Retry image</button>
              ) : null}
            </div>
          )}

          <div className={mode === "camera" ? "practice-workspace" : undefined}>
          {mode === "camera" && <PracticePanel practice={practice} cameraStatus={cameraStatus} modelStatus={modelStatus} hasError={Boolean(surfaceIssue?.kind === "camera" || modelError)} />}
          <div className="workbench">
            <div className="preview-column">
              <div className="preview-header">
                <div>
                  <h2>{mode === "camera" ? "Live camera" : imageName || "No image selected"}</h2>
                </div>

                {mode === "upload" ? (
                  <div className="preview-actions">
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
                    {imageUrl && (
                      <button
                        type="button"
                        className="file-control file-control--quiet"
                        onClick={clearImage}
                      >
                        Clear image
                      </button>
                    )}
                  </div>
                ) : cameraStatus === "starting" || cameraStatus === "running" ? (
                  <button type="button" className="file-control" onClick={stopCamera}>
                    Stop camera
                  </button>
                ) : null}
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
                        className={previewReady ? "is-visible" : undefined}
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
                      <small>JPG, JPEG, or PNG · up to {MAX_IMAGE_SIZE_LABEL}</small>
                    </button>
                  )
                ) : cameraStatus === "starting" || cameraStatus === "running" ? (
                  <div className="media-stack media-stack--camera">
                    <video
                      ref={videoRef}
                      muted
                      playsInline
                      className={previewReady ? "is-covered" : undefined}
                      aria-label="Live camera feed"
                    />
                    <canvas
                      ref={canvasRef}
                      className={previewReady ? "is-visible" : undefined}
                      aria-label="Live annotated camera output"
                    />
                    {cameraStatus === "starting" && (
                      <div className="camera-waiting" role="status">
                        Requesting camera access…
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="empty-preview camera-prompt">
                    <svg viewBox="0 0 40 40" aria-hidden="true">
                      <path d="M7.5 12.5h18v15h-18zM25.5 17l7-4v14l-7-4zM12 9h9" />
                    </svg>
                    <span>
                      {cameraStatus === "stopped" ? "Camera stopped" : "Camera is off"}
                    </span>
                    <small>
                      Position one hand in the frame with even lighting. Access begins only
                      when you start the camera.
                    </small>
                    <button
                      type="button"
                      className="file-control"
                      onClick={() => void startCamera()}
                      disabled={controlsDisabled}
                    >
                      Start camera
                    </button>
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
          </div>
        </section>
      </section>
      <SignGallery onSelect={practiceSign} />
    </>
  );
}
