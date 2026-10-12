'use client';

import { useEffect, useRef, useState } from 'react';
import { lookupRoute, placeFromRoute } from '@/lib/routes';
import { SIM_DT, SIM_STEP_MS, Simulator } from '@/lib/simulator';
import { Tracker } from '@/lib/tracker';
import type { Movement, MovementType, StatesResponse } from '@/lib/types';

const ROWS = 9;
const LIVE_INTERVAL_MS = 30000;

type Mode = 'live' | 'demo';
interface Status {
  kind: '' | 'ok' | 'warn' | 'error';
  text: string;
  offerDemo?: boolean;
}

const fmtClock = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const initialStatus = (mode: Mode): Status => ({
  kind: '',
  text: mode === 'live' ? 'Connecting to OpenSky…' : 'Starting demo…',
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
  const trackerRef = useRef<Tracker | null>(null);

  useEffect(() => {
    const sim = mode === 'demo' ? new Simulator() : null;
    const tracker = new Tracker(sim ? SIM_DT : LIVE_INTERVAL_MS);
    trackerRef.current = tracker;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const publish = () => { if (!cancelled) setEvents(tracker.events); };
    const schedule = (ms: number) => { timer = setTimeout(tick, ms); };

    const resolvePlaces = (added: Movement[]) => {
      for (const ev of added) {
        if (sim) tracker.setPlace(ev, sim.placeFor(ev.callsign));
        else if (ev.callsign) {
          lookupRoute(ev.callsign).then((rt) => {
            if (cancelled || !rt) return;
            tracker.setPlace(ev, placeFromRoute(rt, ev.type));
            publish();
          });
        }
      }
    };

    async function tick() {
      if (sim) {
        resolvePlaces(tracker.ingest(sim.step(), sim.clock));
        publish();
        setStatus({ kind: 'ok', text: 'Demo: synthetic traffic at 10× speed.' });
        schedule(SIM_STEP_MS);
        return;
      }
      try {
        const r = await fetch('/api/opensky', { cache: 'no-store' });
        if (cancelled) return;
        if (r.status === 429) {
          const { retryAfter = 300 } = await r.json().catch(() => ({}));
          if (cancelled) return;
          setStatus({ kind: 'warn', text: `OpenSky daily limit reached. Trying again in ${Math.round(retryAfter / 60)} min.` });
          schedule(retryAfter * 1000);
          return;
        }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j: StatesResponse = await r.json();
        if (cancelled) return;
        resolvePlaces(tracker.ingest(j.states, j.time * 1000));
        publish();
        const waiting = tracker.events.length === 0 ? ' Waiting for the first landing or take-off…' : '';
        setStatus({ kind: 'ok', text: `Live. Updated ${fmtClock(tracker.clock)}, ${j.states.length} aircraft in the area.${waiting}` });
        schedule(LIVE_INTERVAL_MS);
      } catch {
        if (cancelled) return;
        setStatus({ kind: 'error', text: 'Could not reach OpenSky (blocked, offline or rate limited).', offerDemo: true });
        schedule(Math.max(LIVE_INTERVAL_MS, 60000));
      }
    }

    if (sim) {
      tracker.addEvents(sim.seed());
      publish();
    } else {
      fetch('/api/opensky/history', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { events: Movement[] } | null) => {
          if (cancelled || !j?.events.length) return;
          tracker.addEvents(j.events);
          resolvePlaces(j.events);
          publish();
        })
        .catch(() => {});
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
    setStatus(initialStatus(next));
    setMode(next);
  };

  const clear = () => {
    trackerRef.current?.clear();
    setEvents([]);
  };

  const dep = view === 'departure';
  const list = events.filter((e) => e.type === view).slice(0, ROWS);

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
            const flight = e.callsign || e.id;
            const label = [
              fmtClock(e.t),
              e.place ? (dep ? 'to ' : 'from ') + e.place : '',
              e.airline,
              'flight ' + flight,
            ].filter(Boolean).join(', ');
            return (
              <Row
                key={`${e.id}-${e.t}`}
                time={fmtClock(e.t)}
                place={e.place}
                airline={e.airline || e.id}
                flight={flight}
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
        Movements are detected from live aircraft positions (OpenSky Network). Destinations and origins are looked up
        by callsign from adsbdb.com, so a few may be blank or out of date.
      </p>
    </div>
  );
}
