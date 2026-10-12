'use client';

import { useEffect, useRef, useState } from 'react';
import { SIM_STEP_MS, Simulator } from '@/lib/simulator';
import type { FlightsResponse, Movement, MovementType } from '@/lib/types';

const ROWS = 9;
// The server caches AeroDataBox, so polling only drops flights that have moved on.
const LIVE_INTERVAL_MS = 60000;

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
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!infoOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!infoRef.current?.contains(e.target as Node)) setInfoOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setInfoOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [infoOpen]);

  useEffect(() => {
    const sim = mode === 'demo' ? new Simulator() : null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = (ms: number) => { timer = setTimeout(tick, ms); };

    async function tick() {
      if (sim) {
        setEvents(sim.step());
        setStatus({ kind: 'ok', text: 'Demo: synthetic schedule at 10× speed.' });
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

    if (sim) setEvents(sim.step(false));
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

  const dep = view === 'departure';
  const list = events.filter((e) => e.type === view).slice(0, ROWS);

  return (
    <div className="board">
      <div className="title">
        <div className="icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path fill="#1c1c1e" d="M12 1.5c.8 0 1.3.7 1.3 1.6V9l8.2 4.6v2.2l-8.2-2.4v4.6l2.3 1.7V21l-3.6-1-3.6 1v-1.5l2.3-1.7v-4.6l-8.2 2.4v-2.2l8.2-4.6V3.1c0-.9.5-1.6 1.3-1.6z" />
          </svg>
        </div>
        <button className="tab" aria-pressed={dep} onClick={() => setView('departure')}>Departures</button>
        <button className="tab" aria-pressed={!dep} onClick={() => setView('arrival')}>Arrivals</button>

        <div className="title-actions">
          <div className="mode" role="group" aria-label="Data source">
            <button aria-pressed={mode === 'live'} onClick={() => changeMode('live')}>Live</button>
            <button aria-pressed={mode === 'demo'} onClick={() => changeMode('demo')}>Demo</button>
          </div>
          <div className="info" ref={infoRef}>
            <button
              className={`info-btn ${status.kind}`}
              aria-label="Status and information"
              aria-expanded={infoOpen}
              aria-controls="info-panel"
              onClick={() => setInfoOpen((o) => !o)}
            >
              <span aria-hidden="true">i</span>
              <span className="badge" aria-hidden="true" />
            </button>
            {infoOpen && (
              <div id="info-panel" className="info-panel" role="dialog" aria-label="Status and information">
                <div className={`status ${status.kind}`}>
                  <span className="dot" />
                  <span>{status.text}</span>
                </div>
                {status.offerDemo && (
                  <button className="link" onClick={() => { changeMode('demo'); setInfoOpen(false); }}>
                    Try demo
                  </button>
                )}
                <p className="note">
                  Current and upcoming flights from AeroDataBox, soonest first. Times are the latest estimates and
                  the schedule is refreshed about once an hour.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      <span className="sr-only" role="status">{status.text}</span>

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
        <p className="empty-msg">No upcoming {dep ? 'departures' : 'arrivals'}</p>
      )}
    </div>
  );
}
