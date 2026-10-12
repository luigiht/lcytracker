import { AIRLINES, toLL } from './tracker';
import type { AircraftState, Movement } from './types';

export const SIM_STEP_MS = 2000;
export const SIM_DT = 20000;

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const num = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
const letters = (n: number) => Array.from({ length: n }, () => pick([...'ABCDEFGHJKLMNPRSTUVWXYZ'])).join('');
const hex6 = () => Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');

// Weights roughly mirror London City's mix. Routes are plausible examples, not a real schedule.
const SIM_FLEET = [
  { p: 'CFE', w: 5, make: () => num(2) + letters(1),
    to: ['Edinburgh', 'Glasgow', 'Dublin', 'Amsterdam', 'Florence', 'Milan', 'Ibiza', 'Malaga', 'Faro', 'Palma'] },
  { p: 'KLC', w: 2, make: () => num(2) + letters(1), to: ['Amsterdam', 'Rotterdam'] },
  { p: 'SWR', w: 2, make: () => num(1) + letters(2), to: ['Zurich'] },
  { p: 'DLH', w: 1, make: () => num(1) + letters(2), to: ['Frankfurt'] },
  { p: 'LGL', w: 1, make: () => num(1) + letters(2), to: ['Luxembourg'] },
  { p: 'ITY', w: 1, make: () => num(3), to: ['Milan'] },
];
const FLEET_POOL = SIM_FLEET.flatMap((f) => Array(f.w).fill(f) as (typeof f)[]);

function simFlight() {
  const f = pick(FLEET_POOL);
  return { callsign: f.p + f.make(), place: pick(f.to) };
}

interface SimAircraft {
  icao24: string;
  arrival: boolean;
  dir: 1 | -1;
  s: number;
  age: number;
  landed: boolean;
  callsign: string;
}

function simPosition(a: SimAircraft) {
  const xTd = -a.dir * 750;
  if (a.arrival) {
    const x = -a.dir * 14000 + a.dir * a.s;
    const remaining = a.dir * (xTd - x);
    if (remaining > 0) return { x, y: 0, alt: 6 + 0.096 * remaining, gnd: false, vel: 65, vr: -6.2 };
    return { x: xTd + a.dir * Math.min(-remaining, 900), y: 0, alt: 6, gnd: true, vel: 25, vr: 0 };
  }
  const x = -a.dir * 750 + a.dir * a.s;
  if (a.s < 1000) return { x, y: 0, alt: 6, gnd: true, vel: 40, vr: 0 };
  return { x, y: (a.s - 1000) * 0.01 * a.dir, alt: 6 + 0.1 * (a.s - 1200), gnd: false, vel: 80, vr: 8 };
}

/** Synthetic LCY traffic at 10x speed. */
export class Simulator {
  clock = Date.now();
  private ac: SimAircraft[] = [];
  private places = new Map<string, string>();

  placeFor(callsign: string) {
    return this.places.get(callsign) || '';
  }

  /** About half an hour of recent history so the board isn't empty. */
  seed(): Movement[] {
    const out: Movement[] = [];
    let t = this.clock - 60000;
    for (let i = 0; i < 16; i++) {
      t -= (60 + Math.random() * 140) * 1000;
      const { callsign, place } = simFlight();
      out.push({
        t, type: Math.random() < 0.5 ? 'arrival' : 'departure', id: hex6(), callsign,
        airline: AIRLINES[callsign.slice(0, 3)] || '', rwy: Math.random() < 0.7 ? '27' : '09', place,
      });
    }
    return out;
  }

  private spawn() {
    const { callsign, place } = simFlight();
    this.places.set(callsign, place);
    this.ac.push({
      icao24: hex6(), arrival: Math.random() < 0.5,
      dir: Math.random() < 0.7 ? -1 : 1, // runway 27 is used about 70% of the time
      s: 0, age: 0, landed: false, callsign,
    });
  }

  step(): AircraftState[] {
    this.clock += SIM_DT;
    if (Math.random() < 0.3 || this.ac.length === 0) this.spawn();
    const states: AircraftState[] = [];
    this.ac = this.ac.filter((a) => {
      if (a.age > 0) {
        const speed = a.arrival ? (a.landed ? 25 : 65) : a.s < 1000 ? 40 : 80;
        a.s += (speed * SIM_DT) / 1000;
      }
      a.age++;
      const p = simPosition(a);
      if (p.gnd && a.arrival) {
        if (a.landed) return false;
        a.landed = true;
      }
      if (Math.abs(p.x) > 15500) return false;
      const ll = toLL(p.x, p.y);
      states.push({
        icao24: a.icao24, callsign: a.callsign, lat: ll.lat, lon: ll.lon, alt: p.alt, gnd: p.gnd,
        vel: p.vel, track: a.dir < 0 ? 270 : 90, vr: p.vr,
      });
      return true;
    });
    return states;
  }
}
