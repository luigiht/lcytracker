export type MovementType = 'arrival' | 'departure';

/** Flights stay on the board until this long after their time. */
export const CURRENT_WINDOW_MS = 10 * 60000;

export interface Movement {
  id: string;
  t: number;
  type: MovementType;
  flight: string;
  airline: string;
  place: string;
}

export interface FlightsResponse {
  updated: number | null;
  movements: Movement[];
}
