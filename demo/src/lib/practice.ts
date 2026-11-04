import type { Detection } from "../types";
export const PRACTICE_CONFIDENCE = 0.65;
export const PRACTICE_FRAMES = 3;
export type PracticeFeedback = "waiting" | "empty" | "mismatch" | "uncertain" | "matching" | "success";
export interface PracticeProgress { count: number; feedback: PracticeFeedback }
export function advancePractice(previous: PracticeProgress, detections: Detection[], target: string): PracticeProgress {
  const best = detections.reduce<Detection | undefined>((top, item) => !top || item.confidence > top.confidence ? item : top, undefined);
  if (!best) return { count: 0, feedback: "empty" };
  if (best.name.normalize("NFC") !== target.normalize("NFC")) return { count: 0, feedback: "mismatch" };
  if (!Number.isFinite(best.confidence) || best.confidence < PRACTICE_CONFIDENCE) return { count: 0, feedback: "uncertain" };
  const count = Math.min(PRACTICE_FRAMES, previous.count + 1);
  return { count, feedback: count >= PRACTICE_FRAMES ? "success" : "matching" };
}
