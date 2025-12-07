import GameCard from "./GameCard";

export default function GameList({ games }: { games: any }) {
  const list = Array.isArray(games) ? games : [];

  if (!list.length) {
    return (
      <div className="text-sm opacity-60">
        No games found for this date.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {list.map((g: any, idx: number) => (
        <GameCard key={g.id ?? g.game_id ?? idx} g={g} />
      ))}
    </div>
  );
}
