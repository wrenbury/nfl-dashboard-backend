// football_dash_frontend/src/App.tsx

import AppRoutes from "./routes";
import ScoreboardHeader from "./components/ScoreboardHeader";

export default function App() {
  return (
    <div className="min-h-screen bg-[#050608] text-slate-100">
      <ScoreboardHeader />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <AppRoutes />
      </main>
    </div>
  );
}
