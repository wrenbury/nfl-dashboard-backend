// football_dash_frontend/src/pages/Scoreboard.tsx

import useSWR from "swr";
import GameList from "../components/GameList";
import { API } from "../api";

type Sport = "nfl" | "college-football";

type Props = {
  sport: Sport;
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  let data: any = null;
  if (contentType.includes("application/json")) {
    try {
      data = text ? JSON.parse(text) : null;
    } catch (err) {
      console.error("Scoreboard JSON parse error:", err, text);
      throw new Error(
        "Backend returned malformed JSON. Snippet: " + text.slice(0, 200)
      );
    }
  }

  if (!res.ok) {
    const detail =
      (data && (data.detail || data.error || data.message)) || text || "";
    const msg = `HTTP ${res.status}${
      detail ? ` – ${String(detail).slice(0, 200)}` : ""
    }`;
    console.error("Scoreboard HTTP error:", msg);
    throw new Error(msg);
  }

  if (!contentType.includes("application/json")) {
    console.error(
      "Scoreboard non-JSON response:",
      contentType || "(no content-type)",
      text
    );
    throw new Error(
      "Backend did not return JSON. Snippet: " + text.slice(0, 200)
    );
  }

  return data;
};

function getLocalYyyyMmDd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export default function Scoreboard({ sport }: Props) {
  const date = getLocalYyyyMmDd();
  const endpoint = API.scoreboard(sport, { date });

  const { data, error, isLoading } = useSWR(endpoint, fetcher, {
    revalidateOnFocus: false,
  });

  const games = Array.isArray(data) ? data : [];

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div className="text-sm opacity-70">
          Showing:{" "}
          <span className="font-semibold">
            {sport === "nfl" ? "NFL" : "COLLEGE-FOOTBALL"}
          </span>{" "}
          — {date}
        </div>
      </div>

      {isLoading && (
        <div className="text-sm opacity-80">Loading scoreboard…</div>
      )}

      {error && (
        <div className="text-sm text-red-400 whitespace-pre-wrap card">
          Failed to load scoreboard.
          {"\n"}
          {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && (
        <div className="space-y-3">
          <GameList games={games} />
        </div>
      )}
    </section>
  );
}
