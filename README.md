# LCY Tracker

A split-flap style departures and arrivals board for London City Airport (LCY/EGLC), built with Next.js.

Movements are detected in real time from live aircraft positions supplied by the [OpenSky Network](https://opensky-network.org). Destinations and origins are looked up by callsign from [adsbdb.com](https://www.adsbdb.com), so a few may be blank or out of date.

## Features

- **Departures / Arrivals board** with a flip-tile look that scales with the viewport.
- **Live mode** polls OpenSky every 30 seconds for aircraft in a box around LCY and classifies each track as a landing or take-off from its altitude, ground state and vertical rate.
- **Demo mode** generates synthetic LCY traffic at 10× speed, useful when OpenSky is unavailable or the airport is quiet (LCY is closed at night and from Saturday afternoon to Sunday afternoon).
- **Recent history**: with OpenSky API credentials, the board is pre-filled with the last day of EGLC movements. OpenSky batches this data overnight, so it may only cover the previous day.
- **Responsive**: on small screens each movement becomes a compact card.

## How it works

| Path | Purpose |
| --- | --- |
| `app/api/opensky/route.ts` | Server proxy for OpenSky `/states/all` (fixed LCY bounding box). Avoids CORS and keeps credentials server-side. |
| `app/api/opensky/history/route.ts` | Recent EGLC arrivals and departures from OpenSky (requires credentials). |
| `lib/opensky.ts` | OAuth2 client-credentials token handling. |
| `lib/tracker.ts` | Track building and arrival/departure detection. |
| `lib/simulator.ts` | Demo traffic generator. |
| `lib/routes.ts` | Callsign → route lookup via adsbdb. |
| `components/Board.tsx` | The board UI and polling loop. |

## Getting started

Requires Node.js 20.9 or later.

```sh
npm install
npm run dev
```

Open http://localhost:3000.

### OpenSky credentials (optional)

Anonymous access works but is limited to 400 API credits per day, which live polling uses up within a few hours. A free OpenSky account gives 4,000 credits per day and enables the recent-history feature.

1. Log in at https://opensky-network.org and open the [Account](https://opensky-network.org/my-opensky/account) page.
2. Create an API client and copy its client ID and secret.
3. Copy `.env.example` to `.env.local` and fill in:

   ```
   OPENSKY_CLIENT_ID=
   OPENSKY_CLIENT_SECRET=
   ```

4. Restart the dev server.

## Deploying to Vercel

1. Import the GitHub repository in Vercel. The Next.js framework preset is detected automatically; no build settings need changing.
2. Optionally add `OPENSKY_CLIENT_ID` and `OPENSKY_CLIENT_SECRET` under **Settings → Environment Variables**.
3. Deploy.

Note that OpenSky rate limits anonymous use by IP address, and Vercel's server IPs are shared with other projects, so adding credentials is recommended for production.

## Scripts

- `npm run dev` – start the development server
- `npm run build` – production build
- `npm start` – serve the production build
