import { Link } from "react-router-dom";
import browserArchive from "../../../assets/browser-demo.png";
import { AuthorCredit } from "./AuthorCredit";
export const GITHUB_URL = "https://github.com/rdaslam12/BdSL-Vision-Bangla-Sign-Recognition-Edge-ML";
export function Arrow({ diagonal = false }: { diagonal?: boolean }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d={diagonal ? "M6 18 18 6M6 6h12v12" : "M4 12h16m-6-6 6 6-6 6"} /></svg>; }
export function ProjectHeader({ demo = false }: { demo?: boolean }) {
  return <header className={`site-nav${demo ? " site-nav--demo" : ""}`}>
    <Link className="wordmark" to="/" aria-label="BdSL Vision home"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M11 3H3v8m18-8h8v8M3 21v8h8m18-8v8h-8" stroke="currentColor" strokeWidth="2.5"/><circle cx="16" cy="16" r="5" fill="currentColor"/></svg>BdSL<span>Vision</span></Link>
    <nav aria-label="Main navigation">{demo ? <Link to="/">← Back to project</Link> : <><a href="#top">Home</a><a href="#explore">Signs</a><a href="#how-it-works">How It Works</a><Link to="/demo" className="button button-small">Live Demo <Arrow /></Link></>}
      <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub <Arrow diagonal /></a>
    </nav>
  </header>;
}
export function ProjectHero() {
  return <section className="hero" aria-labelledby="hero-heading"><div className="hero-copy">
    <p className="eyebrow">BANGLA SIGN LANGUAGE · EDGE COMPUTER VISION</p>
    <h1 id="hero-heading">Bangla sign language recognition, <span>running right in your browser.</span></h1>
    <p>BdSL Vision recognizes 18 Bangla sign classes from images or a live camera using an edge-deployed computer-vision model. Inference runs locally in the browser, turning a trained YOLOv8 model into an interactive experience without requiring a remote inference server.</p>
    <div className="hero-actions"><Link to="/demo" className="button">Try the Live Model <Arrow /></Link><a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-link">View on GitHub <Arrow diagonal /></a></div>
    <a className="text-link explore-link" href="#explore">Explore the 18 signs ↓</a>
    <AuthorCredit detail />
  </div><figure className="hero-visual"><div className="visual-topline"><span>BdSL / COMPUTER VISION</span><span>ARCHIVE 001</span></div><div className="archive-crop"><img src={browserArchive} alt="Archived browser demo showing a real detection and bounding box. This is a project screenshot, not live output." /></div><div className="visual-bottomline"><span lang="bn">ইশারা থেকে সম্ভাবনা</span><svg viewBox="0 0 100 24" aria-hidden="true"><path d="M0 12h20l6-9 10 18 9-14 7 5h48" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg></div><figcaption>Existing project screenshot · recorded output, not a live prediction</figcaption></figure></section>;
}
export function ProjectStory() {
  return <>
    <section id="how-it-works" className="how-section" aria-labelledby="how-title">
      <div className="section-heading"><h2 id="how-title">How it works.</h2><p>From a camera frame or image to a prediction, all on your device.</p></div>
      <ol className="pipeline">{["Camera / Image", "YOLOv8", "Browser ONNX inference", "18-class prediction"].map((step, index) => <li key={step}><span className="pipeline-number">0{index + 1}</span><strong>{step}</strong>{index < 3 && <Arrow />}</li>)}</ol>
    </section>
    <section id="technology" className="technology-section" aria-labelledby="tech-title">
      <div className="technology-intro"><h2 id="tech-title">From a trained model<br /><em>to a working prototype.</em></h2><p>A lightweight Bangla sign-recognition system exploring how computer vision can move into practical browser and mobile prototypes.</p><a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-link">Explore the repository <Arrow diagonal /></a></div>
      <div className="tech-details"><dl>
        <div><dt>18 sign classes</dt><dd>A focused vocabulary<span>A Bangla sign-recognition prototype.</span></dd></div>
        <div><dt>Browser inference</dt><dd>YOLOv8 → ONNX<span>Exported and executed client-side with the Ultralytics web runtime.</span></dd></div>
        <div><dt>Edge-first deployment</dt><dd>Beyond the notebook<span>Exploring local inference without a remote inference server.</span></dd></div>
        <div><dt>Android prototype</dt><dd>TensorFlow Lite<span>A separate implementation explores mobile deployment.</span></dd></div>
      </dl><p>An engineering prototype with a limited vocabulary, not a full sign-language translator.</p></div>
    </section>
    <section className="launch-section" aria-labelledby="launch-title"><h2 id="launch-title">Try the model yourself.</h2><Link to="/demo" className="button">Launch Live Demo <Arrow /></Link></section>
  </>;
}
export function ProjectFooter() {
  return <footer className="site-footer"><AuthorCredit /><a href="https://github.com/rdaslam12" target="_blank" rel="noreferrer" className="text-link">GitHub <Arrow diagonal /></a></footer>;
}
