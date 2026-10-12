import type { Movement, MovementType } from './types';

export const SIM_STEP_MS = 2000;
const SIM_DT = 20000;

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const digits = (n: number) =>
  String(1 + Math.floor(Math.random() * 9)) + Array.from({ length: n - 1 }, () => Math.floor(Math.random() * 10)).join('');
const hex6 = () => Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');

// Weights roughly mirror London City's mix. Routes are plausible examples, not a real schedule.
const FLEET = [
  { iata: 'BA', name: 'BA CityFlyer', w: 5, n: 4,
    to: ['Edinburgh', 'Glasgow', 'Dublin', 'Amsterdam', 'Florence', 'Milan', 'Ibiza', 'Malaga', 'Faro', 'Palma'] },
  { iata: 'KL', name: 'KLM Cityhopper', w: 2, n: 4, to: ['Amsterdam'] },
  { iata: 'LX', name: 'Swiss', w: 2, n: 3, to: ['Zurich', 'Geneva'] },
  { iata: 'LH', name: 'Lufthansa', w: 1, n: 3, to: ['Frankfurt'] },
  { iata: 'LG', name: 'Luxair', w: 1, n: 4, to: ['Luxembourg'] },
  { iata: 'AZ', name: 'ITA Airways', w: 1, n: 3, to: ['Milan'] },
];
const POOL = FLEET.flatMap((f) => Array(f.w).fill(f) as (typeof f)[]);

function movement(t: number): Movement {
  const f = pick(POOL);
  const type: MovementType = Math.random() < 0.5 ? 'arrival' : 'departure';
  return { id: hex6(), t, type, flight: `${f.iata} ${digits(f.n)}`, airline: f.name, place: pick(f.to) };
}

/** Synthetic LCY traffic at 10x speed. */
export class Simulator {
  private clock = Date.now();

  /** About half an hour of recent history so the board isn't empty. */
  seed(): Movement[] {
    const out: Movement[] = [];
    let t = this.clock - 60000;
    for (let i = 0; i < 16; i++) {
      t -= (60 + Math.random() * 140) * 1000;
      out.push(movement(t));
    }
    return out;
  }

  step(): Movement | null {
    this.clock += SIM_DT;
    return Math.random() < 0.3 ? movement(this.clock) : null;
  }
}
