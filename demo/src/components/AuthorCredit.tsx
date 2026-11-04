import { useState } from "react";

// Vite discovers an optional public photo at build time, avoiding a missing-image request.
const photos = import.meta.glob("/public/author/towhid-aslam.jpg", { eager: true, query: "?url", import: "default" });
const photo = Object.keys(photos).length ? `${import.meta.env.BASE_URL}author/towhid-aslam.jpg` : null;

export function AuthorCredit({ detail = false }: { detail?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <div className="author-credit">
    <span className="author-avatar" aria-hidden="true">{photo && !failed ? <img src={photo} alt="" onError={() => setFailed(true)} /> : "TA"}</span>
    <div><strong>Built by Towhid Aslam</strong>{detail && <span>Computer Science · Applied AI / Computer Vision</span>}</div>
  </div>;
}
