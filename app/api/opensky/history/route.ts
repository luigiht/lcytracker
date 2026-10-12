import { NextResponse } from 'next/server';
import { hasCredentials, openskyFetch } from '@/lib/opensky';
import { AIRLINES } from '@/lib/tracker';
import type { Movement, MovementType } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Flight {
  icao24: string;
  callsign: string | null;
  firstSeen: number;
  lastSeen: number;
}

async function fetchFlights(type: MovementType, begin: number, end: number): Promise<Movement[]> {
  const q = new URLSearchParams({ airport: 'EGLC', begin: String(begin), end: String(end) });
  const r = await openskyFetch(`https://opensky-network.org/api/flights/${type}?${q}`);
  // 404 means no flights in the interval
  if (r.status === 404) return [];
  if (!r.ok) throw new Error(`OpenSky HTTP ${r.status}`);
  const flights = (await r.json()) as Flight[];
  return flights.map((f) => {
    const callsign = (f.callsign || '').trim();
    return {
      t: (type === 'departure' ? f.firstSeen : f.lastSeen) * 1000,
      type, id: f.icao24, callsign,
      airline: AIRLINES[callsign.slice(0, 3)] || '', rwy: '', place: '',
    };
  });
}

/** Recent EGLC movements to pre-fill the board. Needs OpenSky credentials. */
export async function GET() {
  if (!hasCredentials()) return NextResponse.json({ events: [] });
  const end = Math.floor(Date.now() / 1000);
  const begin = end - 24 * 3600;
  try {
    const [dep, arr] = await Promise.all([fetchFlights('departure', begin, end), fetchFlights('arrival', begin, end)]);
    const events = [...dep, ...arr].sort((a, b) => b.t - a.t);
    return NextResponse.json({ events });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, events: [] }, { status: 502 });
  }
}
