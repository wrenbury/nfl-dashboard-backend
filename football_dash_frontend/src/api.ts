// Automatically detect backend URL
// Priority:
// 1. footballpi.local (your Pi hostname)
// 2. Current host but port 8000
// 3. Localhost fallback for dev

function detectBackendBaseUrl(): string {
  // If Pi hostname resolves, use it
  const piHost = "http://footballpi.local:8000";

  // Try same hostname but port 8000
  const sameHost = `http://${window.location.hostname}:8000`;

  // Dev fallback
  const localhost = "http://localhost:8000";

  // Browser cannot actually test fetch sync,
  // so we use a simple heuristic:
  if (window.location.hostname.endsWith(".local")) {
    return sameHost;
  }

  return piHost || sameHost || localhost;
}

const BASE_URL = detectBackendBaseUrl();

// --- API Helper functions ---

export async function fetchGamesToday() {
  const res = await fetch(`${BASE_URL}/games/today`);
  if (!res.ok) {
    throw new Error(`Failed to fetch games today: ${res.status}`);
  }
  return res.json();
}

export async function fetchGameLive(gameId: string) {
  const encoded = encodeURIComponent(gameId);
  const res = await fetch(`${BASE_URL}/games/${encoded}/live`);
  if (!res.ok) {
    throw new Error(`Failed to fetch game live: ${res.status}`);
  }
  return res.json();
}
