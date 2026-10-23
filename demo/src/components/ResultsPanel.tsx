import type { Detection, ModelStatus } from "../types";

interface ResultsPanelProps {
  detections?: Detection[];
  hasResult?: boolean;
  inferenceMs?: number | null;
  isPredicting?: boolean;
  modelStatus?: ModelStatus;
  runtime?: string | null;
}

function formatLatency(inferenceMs: number | null | undefined) {
  if (typeof inferenceMs !== "number" || !Number.isFinite(inferenceMs)) return "—";
  return `${inferenceMs.toFixed(1)} ms`;
}

function formatConfidence(confidence: number | undefined) {
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) return "—";
  return `${(confidence * 100).toFixed(1)}%`;
}

export function ResultsPanel({
  detections,
  hasResult,
  inferenceMs,
  isPredicting,
  modelStatus,
  runtime,
}: ResultsPanelProps) {
  const safeDetections = Array.isArray(detections) ? detections : [];
  const safeRuntime = typeof runtime === "string" && runtime.trim() ? runtime : "Unavailable";
  const statusLabel =
    modelStatus === "ready"
      ? "Model ready"
      : modelStatus === "error"
        ? "Model error"
        : "Loading model";

  return (
    <aside className="results-panel" aria-label="Inference results">
      <div className="results-heading">
        <div>
          <h2>Detected signs</h2>
          <p aria-live="polite">
            {isPredicting && !hasResult
              ? "Analysing frame…"
              : hasResult
                ? `${safeDetections.length} ${safeDetections.length === 1 ? "detection" : "detections"}`
                : "Awaiting input"}
          </p>
        </div>
        <span className={`status-mark status-mark--${modelStatus}`} aria-hidden="true" />
      </div>

      <dl className="measurements">
        <div>
          <dt>Model status</dt>
          <dd>{statusLabel}</dd>
        </div>
        <div>
          <dt>Inference time</dt>
          <dd>{formatLatency(inferenceMs)}</dd>
        </div>
        <div>
          <dt>Runtime</dt>
          <dd>{safeRuntime}</dd>
        </div>
      </dl>

      <div className="detection-table" aria-live="polite" aria-busy={isPredicting}>
        <div className="detection-table__header" aria-hidden="true">
          <span>Sign</span>
          <span>Confidence</span>
        </div>

        {hasResult && safeDetections.length === 0 ? (
          <p className="empty-result">No supported sign detected.</p>
        ) : safeDetections.length > 0 ? (
          <ol className="detection-list">
            {safeDetections.map((detection, index) => (
              <li key={`${detection.name}-${detection.x1}-${detection.y1}-${index}`}>
                <span lang="bn">{detection.name}</span>
                <strong>{formatConfidence(detection.confidence)}</strong>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-result empty-result--muted">
            Results will appear here after inference.
          </p>
        )}
      </div>
    </aside>
  );
}
