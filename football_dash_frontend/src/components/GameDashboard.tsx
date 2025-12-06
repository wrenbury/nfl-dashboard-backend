import React, { useEffect, useState } from "react";
import { GameLiveResponse, TeamSide } from "../types/api";
import { fetchGameLive } from "../api";

interface GameDashboardProps {
  gameId: string;
  onBack: () => void;
}

type FetchState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "success"; data: T };

export const GameDashboard: React.FC<GameDashboardProps> = ({ gameId, onBack }) => {
  const [state, setState] = useState<FetchState<GameLiveResponse>>({
    status: "idle"
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setState({ status: "loading" });
      try {
        const json = await fetchGameLive(gameId);
        if (!cancelled) {
          setState({ status: "success", data: json });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            error: err instanceof Error ? err.message : "Unknown error"
          });
        }
      }
    };

    load();
    const interval = setInterval(load, 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [gameId]);

  // (Everything below stays the same — layout, components, etc.)
  ...
};
