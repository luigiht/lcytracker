# LCY Tracker

A split-flap style departures and arrivals board for London City Airport (LCY/EGLC), built with Next.js.

Flight data comes from [AeroDataBox](https://aerodatabox.com): the board lists flights that have actually departed from or landed at London City, with destination or origin, airline and flight number.

## Features

- **Departures / Arrivals board** with a flip-tile look that scales with the viewport.
- **Live mode** shows the last 12 hours of real LCY movements, newest first, using actual runway or gate times where available.
- **Demo mode** generates synthetic LCY traffic at 10× speed, useful without an API key or when the airport is quiet (LCY is closed at night and from Saturday afternoon to Sunday afternoon).
- **Responsive**: on small screens each movement becomes a compact card.

## How it works

| Path | Purpose |
| --- | --- |
| `app/api/flights/route.ts` | Server route that calls the AeroDataBox airport departures/arrivals endpoint for EGLC, keeps only flights that have happened, and caches the upstream response for an hour. The API key never reaches the browser. |
| `lib/simulator.ts` | Demo traffic generator. |
| `components/Board.tsx` | The board UI and polling loop. |

### API usage

AeroDataBox's free plan has a small monthly quota, so the server caches the AeroDataBox response for **one hour** in the Next.js Data Cache (shared across visitors and Vercel instances). That is roughly 24 calls a day, or about 750 a month, regardless of traffic. The browser polls the app every 5 minutes, which is free. To change the refresh rate, edit `CACHE_SECONDS` in `app/api/flights/route.ts`, and check how many units each call costs on your plan.

Because of the cache, a flight can take up to an hour to appear on the board.

## Getting started

Requires Node.js 20.9 or later.

1. Subscribe to the free plan of [AeroDataBox on RapidAPI](https://rapidapi.com/aedbx-aedbx/api/aerodatabox) and copy your `X-RapidAPI-Key`.
2. Copy `.env.example` to `.env.local` and set:

   ```
   AERODATABOX_API_KEY=your-rapidapi-key
   ```

3. Install and run:

   ```sh
   npm install
   npm run dev
   ```

Open http://localhost:3000.

## Deploying to Vercel

1. Import the GitHub repository in Vercel. The Next.js framework preset is detected automatically; no build settings need changing.
2. Add `AERODATABOX_API_KEY` under **Settings → Environment Variables**.
3. Deploy.

## Scripts

- `npm run dev` – start the development server
- `npm run build` – production build
- `npm start` – serve the production build
