export default function PlayByPlay({ data, plays }: { data?: any; plays?: any }) {
  const items = data ?? plays;
  if (!items) return null;
  return (
    <div className="card">
      <h3 className="font-semibold mb-2">Recent Plays</h3>
      <div className="space-y-1 text-sm">
        {items.slice(-8).map((p: any, i: number) => (
          <div key={i} className="opacity-80">
            {p.text || p.description || JSON.stringify(p)}
          </div>
        ))}
      </div>
    </div>
  );
}
