import type { MovementType } from './types';

interface Airport {
  icao_code?: string;
  iata_code?: string;
  municipality?: string;
  name?: string;
}

interface FlightRoute {
  origin?: Airport;
  midpoint?: Airport;
  destination?: Airport;
}

const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// adsbdb.com: free, no key
const routeCache = new Map<string, Promise<FlightRoute | null>>();

export function lookupRoute(callsign: string): Promise<FlightRoute | null> {
  if (!callsign) return Promise.resolve(null);
  let p = routeCache.get(callsign);
  if (!p) {
    p = fetch('https://api.adsbdb.com/v0/callsign/' + encodeURIComponent(callsign))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.response?.flightroute ?? null)
      .catch(() => {
        routeCache.delete(callsign);
        return null;
      });
    routeCache.set(callsign, p);
  }
  return p;
}

/** Departures show the stop after London City, arrivals the stop before it. */
export function placeFromRoute(route: FlightRoute, type: MovementType): string {
  const isLcy = (a?: Airport) => a && (a.icao_code === 'EGLC' || a.iata_code === 'LCY');
  const stops = [route.origin, route.midpoint, route.destination].filter((a): a is Airport => !!a);
  const i = stops.findIndex(isLcy);
  // Route doesn't involve LCY: better blank than wrong
  if (i < 0) return '';
  const other = type === 'departure' ? stops[i + 1] : stops[i - 1];
  return other ? plain(other.municipality || other.name || other.iata_code || '') : '';
}
