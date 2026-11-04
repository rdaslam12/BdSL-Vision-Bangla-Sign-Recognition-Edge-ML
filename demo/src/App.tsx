import { InferencePlayground } from "./components/InferencePlayground";
import { ProjectHeader, ProjectHero, ProjectStory, ProjectFooter } from "./components/ProjectStory";

export default function App() {
  return <div className="app-shell" id="top">
    <a href="#demo" className="skip-link">Skip to live demo</a>
    <ProjectHeader />
    <main><ProjectHero /><InferencePlayground /><ProjectStory /></main>
    <ProjectFooter />
  </div>;
}
