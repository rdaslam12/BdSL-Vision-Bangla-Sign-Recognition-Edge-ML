import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Link, Route, Routes, useLocation } from "react-router-dom";
import { ProjectHeader, ProjectHero, ProjectStory, ProjectFooter } from "./components/ProjectStory";
import { SignGallery } from "./components/SignGallery";

const InferencePlayground = lazy(() => import("./components/InferencePlayground").then(module => ({ default: module.InferencePlayground })));

function RoutePosition() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = pathname === "/demo" ? "Live Model Demo — BdSL Vision" : "BdSL Vision — Bangla Sign Language Recognition";
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}

function ProjectPage({ demo = false }: { demo?: boolean }) {
  return <div className="app-shell" id="top">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <ProjectHeader demo={demo} />
    <main id="main-content" tabIndex={-1}>{demo ? <>
      <section className="demo-intro"><p className="eyebrow">LIVE INFERENCE</p><h1>Try the model yourself.</h1><p>Use an image or your camera and see the model’s prediction directly in the browser.</p></section>
      <Suspense fallback={<p role="status">Loading live demo…</p>}><InferencePlayground /></Suspense>
    </> : <><ProjectHero /><SignGallery /><ProjectStory /></>}</main>
    <ProjectFooter />
  </div>;
}

export default function App() {
  return <BrowserRouter><RoutePosition /><Routes>
    <Route path="/" element={<ProjectPage />} />
    <Route path="/demo" element={<ProjectPage demo />} />
    <Route path="*" element={<div className="app-shell"><ProjectHeader demo /><main><h1>Page not found.</h1><Link to="/">Back to project</Link></main><ProjectFooter /></div>} />
  </Routes></BrowserRouter>;
}
