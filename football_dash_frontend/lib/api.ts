export const API = {
  scoreboard: (sport: 'nfl'|'college-football', params: Record<string,string|number|undefined> = {}) =>
    `/api/scoreboard/${sport}` + query(params),
  game: (sport: 'nfl'|'college-football', id: string) => `/api/game/${sport}/${id}`,
};

function query(p: Record<string, any>) {
  const q = Object.entries(p).filter(([,v])=>v!==undefined).map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join('&');
  return q ? `?${q}`: '';
}
