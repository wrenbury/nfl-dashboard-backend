export default function TeamStats({ data, teamStats }: { data?: any[]; teamStats?: any[] }) {
  const rows = data ?? teamStats ?? [];
  if (!rows || !rows.length) return null;
  return (
    <div className="card">
      <h3 className="font-semibold mb-2">Team Stats</h3>
      {rows.map((c: any, i: number) => (
        <div key={i} className="mb-3 last:mb-0">
          <div className="text-sm opacity-80 mb-1">{c.title}</div>
          <table className="w-full text-sm">
            <tbody>
              {c.rows.map((r: any, idx: number) => (
                <tr
                  key={idx}
                  className="border-b border-[#1b2026]/60 last:border-0"
                >
                  <td className="py-1 opacity-80">{r[0]}</td>
                  <td className="py-1 text-right">{r[1]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
