import { NextResponse } from 'next/server';
import { CURRENT_WINDOW_MS, type FlightsResponse, type Movement, type MovementType } from '@/lib/types';

// One upstream call per hour keeps a free AeroDataBox quota going for the month.
const CACHE_SECONDS = 3600;
const HOST = 'aerodatabox.p.rapidapi.com';
// The past hour (for delayed flights) plus the next 11 hours; 12 hours is the maximum window per call.
const FIDS_URL = `https://${HOST}/flights/airports/icao/EGLC?` + new URLSearchParams({
  offsetMinutes: '-60',
  durationMinutes: '720',
  withLeg: 'false',
  direction: 'Both',
  withCancelled: 'false',
  withCodeshared: 'false',
  withCargo: 'false',
  withPrivate: 'false',
  withLocation: 'false',
});

interface AdbTime { utc?: string }
interface AdbFlight {
  number: string;
  airline?: { name?: string };
  movement?: {
    airport?: { name?: string; shortName?: string; municipalityName?: string; iata?: string };
    scheduledTime?: AdbTime;
    revisedTime?: AdbTime;
    runwayTime?: AdbTime;
  };
}

const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
// AeroDataBox returns UTC times like "2026-10-12 14:15Z"
const parseUtc = (s?: string) => (s ? Date.parse(s.replace(' ', 'T')) : NaN);

function toMovement(f: AdbFlight, type: MovementType, now: number): Movement | null {
  const m = f.movement;
  if (!m) return null;
  const t = parseUtc(m.runwayTime?.utc ?? m.revisedTime?.utc ?? m.scheduledTime?.utc);
  if (Number.isNaN(t) || t < now - CURRENT_WINDOW_MS) return null;
  const a = m.airport ?? {};
  const place = plain(a.municipalityName || a.shortName || a.name || a.iata || '');
  return {
    id: `${type}-${f.number}-${m.scheduledTime?.utc ?? t}`,
    t, type,
    flight: f.number,
    airline: f.airline?.name ?? '',
    place: place === 'Unknown' ? '' : place,
  };
}

export async function GET() {
  const key = process.env.AERODATABOX_API_KEY;
  if (!key) return NextResponse.json({ error: 'AeroDataBox API key is not configured.' }, { status: 500 });

  try {
    const r = await fetch(FIDS_URL, {
      headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': HOST },
      next: { revalidate: CACHE_SECONDS },
    });
    if (r.status === 429) return NextResponse.json({ error: 'AeroDataBox quota reached.' }, { status: 429 });
    if (r.status === 401 || r.status === 403) {
      return NextResponse.json({ error: 'AeroDataBox rejected the API key.' }, { status: 502 });
    }
    if (!r.ok && r.status !== 204) {
      return NextResponse.json({ error: `AeroDataBox HTTP ${r.status}` }, { status: 502 });
    }

    const j: { departures?: AdbFlight[]; arrivals?: AdbFlight[] } = r.status === 204 ? {} : await r.json();
    const now = Date.now();
    const movements = [
      ...(j.departures ?? []).map((f) => toMovement(f, 'departure', now)),
      ...(j.arrivals ?? []).map((f) => toMovement(f, 'arrival', now)),
    ]
      .filter((m): m is Movement => !!m)
      .sort((a, b) => a.t - b.t);

    const date = Date.parse(r.headers.get('date') ?? '');
    const body: FlightsResponse = { updated: Number.isNaN(date) ? null : date, movements };
    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ error: 'AeroDataBox is unreachable.' }, { status: 502 });
  }
}
