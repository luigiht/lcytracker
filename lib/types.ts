export type MovementType = 'arrival' | 'departure';

export interface AircraftState {
  icao24: string;
  callsign: string;
  lat: number | null;
  lon: number | null;
  alt: number | null;
  gnd: boolean;
  vel: number | null;
  track: number | null;
  vr: number | null;
}

export interface StatesResponse {
  time: number;
  states: AircraftState[];
}

export interface Movement {
  t: number;
  type: MovementType;
  id: string;
  callsign: string;
  airline: string;
  rwy: string;
  place: string;
}
