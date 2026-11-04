import { SIGN_SAMPLES } from "../data/signs";
import type { useGuidedPractice } from "../hooks/useGuidedPractice";
import { PRACTICE_FRAMES } from "../lib/practice";
import type { ModelStatus } from "../types";
import { SignReference } from "./SignGallery";
const FEEDBACK = {
  waiting: "Waiting for the first prediction.",
  empty: "No sign detected. Keep your signing area in view.",
  mismatch: "A different sign was detected. Adjust your pose and try again.",
  uncertain: "Target detected below 65% confidence. Try even lighting.",
  matching: "Matching the target. Hold the sign steady…",
  success: "Target matched across three consecutive frames.",
};
export function PracticePanel({ practice, cameraStatus, modelStatus, hasError }: {
  practice: ReturnType<typeof useGuidedPractice>; cameraStatus: string; modelStatus: ModelStatus; hasError: boolean;
}) {
  const active = cameraStatus === "running" && modelStatus === "ready" && !hasError;
  const message = hasError ? "Practice paused. Resolve the camera or model error to continue." : modelStatus !== "ready" ? "Waiting for the model to load." : cameraStatus === "starting" ? "Waiting for camera access…" : !active ? "Select a target, then start the camera." : FEEDBACK[practice.progress.feedback];
  return <div className={`practice-panel ${active && practice.progress.feedback === "success" ? "practice-panel--success" : ""}`}>
    <figure className="practice-reference"><SignReference key={practice.target.id} sample={practice.target} /><figcaption><strong lang="bn">{practice.target.label}</strong><span>{practice.target.english}</span></figcaption></figure>
    <div className="practice-controls"><h3>Guided practice</h3><label htmlFor="practice-target">Target sign</label><select id="practice-target" value={practice.target.id} onChange={event => practice.selectTarget(event.target.value)}>{SIGN_SAMPLES.map(sample => <option value={sample.id} key={sample.id}>{sample.label} · {sample.english}</option>)}</select><p>AI-generated concept illustration, not a verified BdSL guide. The illustrated pose may not match the model’s trained gesture. Practice signs you already know.</p></div>
    <div className="practice-feedback"><p role="status">{message}</p><div className="frame-markers" aria-hidden="true">{Array.from({ length: PRACTICE_FRAMES }, (_, i) => <span key={i} className={active && practice.progress.count > i ? "is-matched" : ""} />)}</div><small>3 consecutive frames · ≥65% confidence<br />Model feedback, not an assessment of signing fluency.</small></div>
  </div>;
}
