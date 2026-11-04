import { useState } from "react";
import { SIGN_SAMPLES, type SignSample } from "../data/signs";

export function SignReference({ sample }: { sample: SignSample }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  return <div className={`sign-artwork sign-artwork--${status}`} aria-busy={status === "loading"}>
    {status !== "error" && <img key={attempt} src={sample.image} alt={`AI-generated conceptual illustration for ${sample.english}; unverified BdSL pose`} loading="lazy" decoding="async" onLoad={() => setStatus("loaded")} onError={() => setStatus("error")} />}
    {status === "loading" && <span className="artwork-message">Loading illustration…</span>}
    {status === "error" && <div className="artwork-message"><span>Illustration could not load.</span><button type="button" onClick={() => { setStatus("loading"); setAttempt(attempt + 1); }}>Retry image</button></div>}
  </div>;
}

export function SignGallery({ onSelect }: { onSelect: (sample: SignSample) => void }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? SIGN_SAMPLES : SIGN_SAMPLES.slice(0, 6);
  return <section id="explore" className="gallery-section" aria-labelledby="gallery-title">
    <div className="section-heading"><h2 id="gallery-title">Small vocabulary.<br />Meaningful expressions.</h2><p>Explore 18 supported classes through AI-generated concept illustrations. These are not verified BdSL instructional references, and their poses may not match the model’s trained gestures.</p></div>
    <div id="sign-gallery-grid" className="sign-grid">{visible.map((sample) => <article className="sign-item" key={sample.id}>
      <div className="sign-image"><SignReference sample={sample} /></div>
      <div className="sign-caption"><div><h3 lang="bn">{sample.label}</h3><p>{sample.english}</p></div><button type="button" onClick={() => onSelect(sample)} aria-label={`Practice ${sample.english} with camera`}>Practice sign</button></div>
    </article>)}</div>
    <button className="gallery-expand file-control" type="button" aria-expanded={expanded} aria-controls="sign-gallery-grid" onClick={() => setExpanded(!expanded)}>{expanded ? "Show featured signs" : "Explore all 18 signs"}</button>
    <p className="section-note">Choose a sign for guided camera practice. Illustrations are visual context only; recognition uses your live camera and the actual model.</p>
  </section>;
}
