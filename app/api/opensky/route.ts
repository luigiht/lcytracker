import { NextResponse } from 'next/server';
import { openskyFetch } from '@/lib/opensky';
import type { AircraftState } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Fixed box around London City; never taken from the request.
const BBOX = new URLSearchParams({ lamin: '51.43', lamax: '51.58', lomin: '-0.17', lomax: '0.28' });
const STATES_URL = 'https://opensky-network.org/api/states/all?' + BBOX.toString();

type RawState = [string, string | null, string, number | null, number, number | null, number | null,
  number | null, boolean, number | null, number | null, number | null, unknown, number | null, ...unknown[]];

function parseState(a: RawState): AircraftState {
  return {
    icao24: a[0], callsign: (a[1] || '').trim(), lon: a[5], lat: a[6], alt: a[7] ?? a[13],
    gnd: !!a[8], vel: a[9], track: a[10], vr: a[11],
  };
}

export async function GET() {
  try {
    const r = await openskyFetch(STATES_URL);
    if (r.status === 429) {
      const retryAfter = Number(r.headers.get('X-Rate-Limit-Retry-After-Seconds')) || 300;
      return NextResponse.json({ error: 'rate_limited', retryAfter }, { status: 429 });
    }
    if (!r.ok) return NextResponse.json({ error: `OpenSky HTTP ${r.status}` }, { status: 502 });
    const j = await r.json();
    const states = ((j.states ?? []) as RawState[]).map(parseState);
    return NextResponse.json({ time: j.time ?? Math.floor(Date.now() / 1000), states });
  } catch {
    return NextResponse.json({ error: 'OpenSky unreachable' }, { status: 502 });
  }
}
