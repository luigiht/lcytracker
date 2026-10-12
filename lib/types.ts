export type MovementType = 'arrival' | 'departure';

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
