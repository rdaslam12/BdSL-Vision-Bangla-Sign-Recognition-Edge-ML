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

export function SignGallery({ onSelect }: { onSelect?: (sample: SignSample) => void }) {
  return <section id="explore" className="gallery-section" aria-labelledby="gallery-title">
    <div className="section-heading"><h2 id="gallery-title">{onSelect ? "Choose a sign to practice." : "18 signs. One browser-based model."}</h2><p>{onSelect ? "Select a class to open guided camera practice." : "A compact view of the classes included in this prototype."}</p></div>
    <div className="sign-grid">{SIGN_SAMPLES.map((sample) => <article className="sign-item" key={sample.id}>
      <div className="sign-image"><SignReference sample={sample} /></div>
      <div className="sign-caption"><h3 lang="bn">{sample.label}</h3><p>{sample.english}</p></div>
      {onSelect && <button className="practice-sign" type="button" onClick={() => onSelect(sample)} aria-label={`Practice ${sample.english} with camera`}>Practice sign</button>}
    </article>)}</div>
    <p className="section-note">Illustrations are visual class references for the demo, not verified BdSL instructional material. They are not used for inference or training.</p>
  </section>;
}
