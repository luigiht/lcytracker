'use client';

import { useEffect, useState } from 'react';
import { SIM_STEP_MS, Simulator } from '@/lib/simulator';
import type { FlightsResponse, Movement, MovementType } from '@/lib/types';

const ROWS = 9;
// The server caches AeroDataBox, so polling only re-filters which flights have already happened.
const LIVE_INTERVAL_MS = 5 * 60000;

type Mode = 'live' | 'demo';
interface Status {
  kind: '' | 'ok' | 'warn' | 'error';
  text: string;
  offerDemo?: boolean;
}

const fmtClock = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const initialStatus = (mode: Mode): Status => ({
  kind: '',
  text: mode === 'live' ? 'Loading flights…' : 'Starting demo…',
});

// Blank tiles that pad mobile card lines to the full width; extras are clipped by CSS.
const FILL = 24;

function Tiles({ text, n, className, fill = 0 }: { text: string; n: number; className: string; fill?: number }) {
  const chars = [...text.toUpperCase().slice(0, n).padEnd(n, ' ')];
  return (
    <span className={`tiles ${className}`} aria-hidden="true">
      {chars.map((c, i) => (
        <i key={i}>{c === ' ' ? '' : c}</i>
      ))}
      {Array.from({ length: fill }, (_, i) => (
        <i key={`f${i}`} className="f" />
      ))}
    </span>
  );
}

function Row({ time = '', place = '', airline = '', flight = '', label }: {
  time?: string; place?: string; airline?: string; flight?: string; label?: string;
}) {
  return (
    <div
      className={label ? 'grid row' : 'grid row empty'}
      {...(label ? { role: 'listitem', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <Tiles text={time} n={5} className="c-time" />
      <Tiles text="" n={0} fill={FILL} className="c-gap" />
      <Tiles text={place} n={14} fill={FILL} className="c-place" />
      <Tiles text={airline} n={15} fill={FILL} className="c-air" />
      <Tiles text={flight} n={8} className="c-flt" />
    </div>
  );
}

export default function Board() {
  const [mode, setMode] = useState<Mode>('live');
  const [view, setView] = useState<MovementType>('departure');
  const [events, setEvents] = useState<Movement[]>([]);
  const [status, setStatus] = useState<Status>(initialStatus('live'));
  const [clearedAt, setClearedAt] = useState(0);

  useEffect(() => {
    const sim = mode === 'demo' ? new Simulator() : null;
    let demoEvents: Movement[] = [];
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = (ms: number) => { timer = setTimeout(tick, ms); };

    async function tick() {
      if (sim) {
        const m = sim.step();
        if (m) {
          demoEvents = [m, ...demoEvents];
          setEvents(demoEvents);
        }
        setStatus({ kind: 'ok', text: 'Demo: synthetic traffic at 10× speed.' });
        schedule(SIM_STEP_MS);
        return;
      }
      try {
        const r = await fetch('/api/flights', { cache: 'no-store' });
        const j = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) {
          setStatus({
            kind: r.status === 429 ? 'warn' : 'error',
            text: j.error ?? `Flight data unavailable (HTTP ${r.status}).`,
            offerDemo: true,
          });
        } else {
          const data = j as FlightsResponse;
          setEvents(data.movements);
          setStatus({ kind: 'ok', text: `Live. Flight data updated ${fmtClock(data.updated ?? Date.now())}.` });
        }
      } catch {
        if (cancelled) return;
        setStatus({ kind: 'error', text: 'Could not load flight data.', offerDemo: true });
      }
      schedule(LIVE_INTERVAL_MS);
    }

    if (sim) {
      demoEvents = sim.seed();
      setEvents(demoEvents);
    }
    tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mode]);

  const changeMode = (next: Mode) => {
    if (next === mode) return;
    setEvents([]);
    setClearedAt(0);
    setStatus(initialStatus(next));
    setMode(next);
  };

  const clear = () => setClearedAt(Math.max(Date.now(), ...events.map((e) => e.t)));

  const dep = view === 'departure';
  const list = events.filter((e) => e.type === view && e.t > clearedAt).slice(0, ROWS);

  return (
    <div className="wrap">
      <div className="board">
        <div className="title">
          <div className="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path fill="#1c1c1e" d="M12 1.5c.8 0 1.3.7 1.3 1.6V9l8.2 4.6v2.2l-8.2-2.4v4.6l2.3 1.7V21l-3.6-1-3.6 1v-1.5l2.3-1.7v-4.6l-8.2 2.4v-2.2l8.2-4.6V3.1c0-.9.5-1.6 1.3-1.6z" />
            </svg>
          </div>
          <button aria-pressed={dep} onClick={() => setView('departure')}>Departures</button>
          <button aria-pressed={!dep} onClick={() => setView('arrival')}>Arrivals</button>
        </div>

        <div className="grid head" aria-hidden="true">
          <span className="c-time">Time</span>
          <span className="c-place">{dep ? 'Destination' : 'Origin'}</span>
          <span className="c-air">Airline</span>
          <span className="c-flt">Flight</span>
        </div>

        <div className="rows" role="list" aria-live="polite">
          {Array.from({ length: ROWS }, (_, i) => {
            const e = list[i];
            if (!e) return <Row key={`empty-${i}`} />;
            const label = [
              fmtClock(e.t),
              e.place ? (dep ? 'to ' : 'from ') + e.place : '',
              e.airline,
              'flight ' + e.flight,
            ].filter(Boolean).join(', ');
            return (
              <Row
                key={e.id}
                time={fmtClock(e.t)}
                place={e.place}
                airline={e.airline}
                flight={e.flight}
                label={label}
              />
            );
          })}
        </div>
        {list.length === 0 && (
          <p className="empty-msg">No {dep ? 'departures' : 'arrivals'} yet</p>
        )}
      </div>

      <div className="foot">
        <div className={`status ${status.kind}`} role="status">
          <span className="dot" />
          <span>{status.text}</span>
          {status.offerDemo && <button onClick={() => changeMode('demo')}>Try demo</button>}
        </div>
        <div className="actions">
          <button aria-pressed={mode === 'live'} onClick={() => changeMode('live')}>Live</button>
          <button aria-pressed={mode === 'demo'} onClick={() => changeMode('demo')}>Demo</button>
          <button onClick={clear}>Clear</button>
        </div>
      </div>
      <p className="note">
        Actual departure and arrival times from AeroDataBox, refreshed about once an hour. The most recent flights
        may appear with a short delay.
      </p>
    </div>
  );
}
