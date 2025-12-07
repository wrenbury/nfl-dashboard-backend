export default function BoxScore({ data, boxscore }: { data?: any[]; boxscore?: any[] }) {
  const rows = data ?? boxscore ?? [];
  if (!rows || !rows.length) return null;
  return (
    <div className="card">
      <h3 className="font-semibold mb-2">Box Score</h3>
      <div className="grid gap-3">
        {rows.map((c, i) => (
          <div key={i}>
            <div className="text-sm opacity-80 mb-1">{c.title}</div>
            <table className="w-full text-sm">
              <tbody>
                {c.rows.map((r: any, idx: number) => (
                  <tr
                    className="border-b border-[#1b2026]/60 last:border-0"
                    key={idx}
                  >
                    {r.map((cell: string, i2: number) => (
                      <td
                        className={`py-1 ${i2 === 0 ? "font-medium" : ""}`}
                        key={i2}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
