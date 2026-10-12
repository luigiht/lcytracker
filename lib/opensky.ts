const TOKEN_URL = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

let token: { value: string; expires: number } | null = null;

export const hasCredentials = () => !!(process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET);

async function getToken(): Promise<string | null> {
  const id = process.env.OPENSKY_CLIENT_ID;
  const secret = process.env.OPENSKY_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (token && Date.now() < token.expires) return token.value;
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
    cache: 'no-store',
  });
  if (!r.ok) return null;
  const j = await r.json();
  token = { value: j.access_token, expires: Date.now() + ((j.expires_in ?? 1800) - 60) * 1000 };
  return token.value;
}

/** Server-side fetch to the OpenSky API, authenticated when credentials are configured. */
export async function openskyFetch(url: string): Promise<Response> {
  const t = await getToken().catch(() => null);
  return fetch(url, { headers: t ? { Authorization: `Bearer ${t}` } : {}, cache: 'no-store' });
}
