import { Route, Routes, Navigate } from "react-router-dom";
import Scoreboard from "./pages/Scoreboard";
import Game from "./pages/Game";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/cfb" replace />} />
      <Route path="/nfl" element={<Scoreboard sport="nfl"/>} />
      <Route path="/cfb" element={<Scoreboard sport="college-football"/>} />
      <Route path="/:sport/game/:id" element={<Game/>} />
    </Routes>
  );
}
