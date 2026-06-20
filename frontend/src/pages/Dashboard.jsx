import { useEffect, useState } from "react";
import { getDashboard } from "../lib/api";

export default function Dashboard() {
  const [content, setContent] = useState("Loading dashboard...");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      try {
        setContent(await getDashboard(controller.signal));
      } catch (requestError) {
        if (requestError.name === "AbortError") {
          return;
        }

        setError(requestError.message || "Failed to load dashboard.");
      }
    }

    loadDashboard();

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <main className="dashboard-page">
      {error ? <p>{error}</p> : <p>{content}</p>}
    </main>
  );
}
