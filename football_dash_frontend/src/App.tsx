import AppRoutes from "./routes";
import ScoreboardHeader from "./components/ScoreboardHeader";

export default function App() {
  return (
    <div className="min-h-screen">
      <ScoreboardHeader />
      <div className="max-w-7xl mx-auto px-4 py-4">
        <AppRoutes />
      </div>
    </div>
  );
}
