import { useCallback, useRef } from "react";
import type { LoadedModel } from "../types";

const PREDICTION_OPTIONS = { conf: 0.25, iou: 0.7 } as const;

type PredictionSource = Parameters<LoadedModel["predict"]>[0];
export type PredictionResults = Awaited<ReturnType<LoadedModel["predict"]>>;

export function useInferenceCoordinator(model: LoadedModel | null) {
  const inFlightRef = useRef<Promise<PredictionResults> | null>(null);

  return useCallback(
    async (source: PredictionSource, isRelevant: () => boolean) => {
      while (inFlightRef.current) {
        try {
          await inFlightRef.current;
        } catch {
          // The originating request reports its own failure. A relevant newer
          // request can proceed once the shared model is idle again.
        }

        if (!isRelevant()) return null;
      }

      if (!model || !isRelevant()) return null;

      const prediction = model.predict(source, PREDICTION_OPTIONS);
      inFlightRef.current = prediction;

      try {
        const results = await prediction;
        return isRelevant() ? results : null;
      } finally {
        if (inFlightRef.current === prediction) inFlightRef.current = null;
      }
    },
    [model],
  );
}
