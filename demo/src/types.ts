import type { YOLO } from "@ultralytics/yolo";

export type LoadedModel = Awaited<ReturnType<typeof YOLO.load>>;
export type ModelStatus = "loading" | "ready" | "error";
export type DemoMode = "upload" | "camera";

export interface Detection {
  name: string;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface InferenceSummary {
  detections: Detection[];
  inferenceMs: number | null;
}
