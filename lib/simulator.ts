import { CURRENT_WINDOW_MS, type Movement, type MovementType } from './types';

export const SIM_STEP_MS = 2000;
const SIM_DT = 20000;
const HORIZON_MS = 3 * 3600000;

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

/** Synthetic LCY schedule running at 10x speed. */
export class Simulator {
  private clock = Date.now();
  private flights: Movement[] = [];
  private last = this.clock - CURRENT_WINDOW_MS;

  /** Current and upcoming flights, soonest first. */
  step(advance = true): Movement[] {
    if (advance) this.clock += SIM_DT;
    this.flights = this.flights.filter((f) => f.t >= this.clock - CURRENT_WINDOW_MS);
    while (this.last < this.clock + HORIZON_MS) {
      this.last += (2 + Math.random() * 6) * 60000;
      this.flights.push(movement(Math.round(this.last / 300000) * 300000));
    }
    return this.flights;
  }
}
