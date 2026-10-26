import { useEffect, useState } from "react";
import { LandingPage } from "./LandingPage";
import { DemoWorkspace } from "./DemoWorkspace";

export default function PastxApp() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  if (path === "/demo" || path.startsWith("/demo/")) {
    return <DemoWorkspace />;
  }

  return <LandingPage />;
}
