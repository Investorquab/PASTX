import { useEffect, useState } from "react";
import { LandingPage } from "./LandingPage";
import PastxDashboard from "./PastxDashboard";

export default function PastxApp() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  if (path === "/demo" || path.startsWith("/demo/") || path === "/app") {
    return <PastxDashboard />;
  }

  return <LandingPage />;
}
