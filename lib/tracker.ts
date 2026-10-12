import type { AircraftState, Movement, MovementType } from './types';

export const LCY = { lat: 51.5053, lon: 0.0553 };
const COS = Math.cos((LCY.lat * Math.PI) / 180);

export const toXY = (lat: number, lon: number) => ({
  x: (lon - LCY.lon) * COS * 111320,
  y: (lat - LCY.lat) * 110540,
});
export const toLL = (x: number, y: number) => ({
  lat: LCY.lat + y / 110540,
  lon: LCY.lon + x / (111320 * COS),
});

export const AIRLINES: Record<string, string> = {
  CFE: 'BA CityFlyer', BAW: 'British Airways', KLC: 'KLM Cityhopper', SWR: 'Swiss',
  LOG: 'Loganair', DLH: 'Lufthansa', AFR: 'Air France', LGL: 'Luxair', ITY: 'ITA Airways',
};

interface Sample {
  t: number;
  x: number;
  y: number;
  dist: number;
  alt: number | null;
  vr: number | null;
  gnd: boolean;
  trk: number | null;
  vel: number | null;
}

interface Track {
  id: string;
  callsign: string;
  samples: Sample[];
  last: number;
}

const isLow = (p: Sample) => p.dist < 6 && (p.gnd || (p.alt != null && p.alt < 600));

function classify(tr: Track): MovementType | null {
  const s = tr.samples;
  if (!s.length || !s.some((p) => !p.gnd)) return null;
  const f = s[0], l = s[s.length - 1];
  const fl = isLow(f), ll = isLow(l);
  if (fl && !ll) return 'departure';
  if (!fl && ll) return 'arrival';
  if (fl && ll) {
    if (f.gnd && !l.gnd) return 'departure';
    if (!f.gnd && l.gnd) return 'arrival';
    if (!f.gnd && !l.gnd) {
      const dAlt = (l.alt ?? 0) - (f.alt ?? 0);
      if (dAlt > 30 || (l.vr ?? 0) > 1) return 'departure';
      if (dAlt < -30 || (l.vr ?? 0) < -1) return 'arrival';
    }
  }
  return null;
}

function runwayFor(tr: Track, type: MovementType) {
  const air = tr.samples.filter((p) => !p.gnd && p.trk != null);
  const p = type === 'arrival' ? air[air.length - 1] : air[0];
  if (!p || p.trk == null) return '';
  if (p.trk >= 225 && p.trk <= 315) return '27';
  if (p.trk >= 45 && p.trk <= 135) return '09';
  return '';
}

/** Detects arrivals and departures at LCY from successive aircraft position snapshots. */
export class Tracker {
  tracks = new Map<string, Track>();
  events: Movement[] = [];
  clock = Date.now();

  constructor(private intervalMs: number) {}

  private finalize(tr: Track, type: MovementType | null = classify(tr)): Movement | null {
    if (!type) return null;
    const dup = this.events.find((e) => e.id === tr.id && e.type === type && Math.abs(this.clock - e.t) < 5 * 60000);
    if (dup) return null;
    const ev: Movement = {
      t: this.clock, type, id: tr.id, callsign: tr.callsign,
      airline: AIRLINES[tr.callsign.slice(0, 3)] || '', rwy: runwayFor(tr, type), place: '',
    };
    this.events = [ev, ...this.events];
    return ev;
  }

  /** Feeds a snapshot of states; returns any movements detected by it. */
  ingest(states: AircraftState[], clock: number): Movement[] {
    this.clock = clock;
    const added: Movement[] = [];
    const push = (ev: Movement | null) => { if (ev) added.push(ev); };

    for (const st of states) {
      if (st.lat == null || st.lon == null) continue;
      const p = toXY(st.lat, st.lon);
      let tr = this.tracks.get(st.icao24);
      if (!tr) {
        tr = { id: st.icao24, callsign: '', samples: [], last: clock };
        this.tracks.set(st.icao24, tr);
      }
      if (st.callsign) tr.callsign = st.callsign;
      tr.samples.push({
        t: clock, x: p.x, y: p.y, dist: Math.hypot(p.x, p.y) / 1000,
        alt: st.alt, vr: st.vr, gnd: st.gnd, trk: st.track, vel: st.vel,
      });
      if (tr.samples.length > 60) tr.samples.shift();
      tr.last = clock;

      const l = tr.samples[tr.samples.length - 1];
      const type = classify(tr);
      if (type === 'arrival' && l.gnd) {
        push(this.finalize(tr, type));
        tr.samples = [l];
      } else if (type === 'departure' && (l.dist > 6 || (l.alt != null && l.alt > 900))) {
        push(this.finalize(tr, type));
        tr.samples = [l];
      }
    }

    const stale = Math.max(90000, 2.5 * this.intervalMs);
    for (const [id, tr] of this.tracks) {
      if (clock - tr.last > stale) {
        push(this.finalize(tr));
        this.tracks.delete(id);
      }
    }
    return added;
  }

  addEvents(evs: Movement[]) {
    this.events = [...this.events, ...evs];
  }

  setPlace(ev: Movement, place: string) {
    this.events = this.events.map((e) => (e === ev ? { ...e, place } : e));
  }

  clear() {
    this.events = [];
  }
}
