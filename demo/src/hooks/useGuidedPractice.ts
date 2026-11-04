import { useCallback, useRef, useState } from "react";
import { SIGN_SAMPLES, type SignSample } from "../data/signs";
import { advancePractice, type PracticeProgress } from "../lib/practice";
import type { Detection } from "../types";
const EMPTY: PracticeProgress = { count: 0, feedback: "waiting" };
export function useGuidedPractice() {
  const [target, setTarget] = useState<SignSample>(SIGN_SAMPLES[0]);
  const targetRef = useRef(target);
  const revision = useRef(0);
  const [progress, setProgress] = useState(EMPTY);
  const progressRef = useRef(EMPTY);
  const reset = useCallback(() => {
    revision.current += 1;
    progressRef.current = EMPTY;
    setProgress(EMPTY);
  }, []);
  const selectTarget = (id: string) => {
    const next = SIGN_SAMPLES.find(sample => sample.id === id);
    if (!next) return;
    reset();
    targetRef.current = next;
    setTarget(next);
  };
  const record = useCallback((detections: Detection[], frameRevision: number) => {
    if (frameRevision !== revision.current) return;
    const next = advancePractice(progressRef.current, detections, targetRef.current.label);
    if (next.count !== progressRef.current.count || next.feedback !== progressRef.current.feedback) {
      progressRef.current = next;
      setProgress(next);
    }
  }, []);
  return { target, selectTarget, progress, record, reset, revision };
}
