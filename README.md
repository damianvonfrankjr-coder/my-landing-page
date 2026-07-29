# Spectrum Killian × MB2 Dental — Tampa Bay

A Tampa-only version of the "first five cases free" landing page, with a live
case-logistics board driven by the real National Weather Service forecast for
Tampa Bay.

Same offer, same structure as the original two-lab flyer — one Center of
Excellence instead of Orange County and Los Angeles, and a live weather feed
that tells partners whether courier routes are actually running today.

## Why weather is on a dental lab page

Tampa's storm season runs June 1 – November 30. A lab that moves crown &
bridge cases by courier around the bay is genuinely affected by it, so the
board turns the forecast into the thing a practice actually wants to know:

| Live conditions | Board state | Courier status |
| --- | --- | --- |
| Hurricane / tornado / tropical storm warning, or any NWS *Extreme* or *Severe* alert | Routes suspended (red) | Pickup paused, rush unavailable |
| Any watch, advisory, or sustained wind ≥ 25 mph | Monitoring (amber) | Running with possible delays |
| Clear, or ordinary afternoon storms | Normal (teal) | On schedule |

When an alert is active the accent color shifts across the whole page and the
sticky rail at the top turns red, so the state is obvious without reading.

## Files

- `index.html` — page structure
- `style.css` — styling, including the alert-responsive theming
- `weather.js` — live data fetching, courier-status logic, rendering

Open `index.html` in a browser, or host the three files on any static host.
There is no build step, no server, and no API key.

## Data sources

Both are public, free, CORS-enabled, and need no key or account:

- **[api.weather.gov](https://www.weather.gov/documentation/services-web-api)** —
  the official NWS forecast and active alerts. Public domain. Tampa resolves to
  forecast office `TBW`, grid `71,98`.
- **[open-meteo.com](https://open-meteo.com/)** — live current conditions
  (temperature, apparent temperature, humidity, wind), and a forecast fallback
  if the NWS endpoint is unavailable.

The three requests are issued independently, so one source going down does not
blank the board. If everything fails, the board shows a clearly-marked
unavailable state pointing partners at the phone number rather than showing
stale data. It refreshes every 10 minutes and again whenever the tab regains
focus.

## Customizing

**Location** — edit `CONFIG` at the top of `weather.js`:

```js
const CONFIG = {
    lat: 27.9506,
    lon: -82.4572,
    placeName: 'Tampa',
    grid: { office: 'TBW', x: 71, y: 98 },  // set to null to auto-resolve
    refreshMs: 10 * 60 * 1000,
    forecastPeriods: 5,
};
```

Change `lat`/`lon` and set `grid: null` — the NWS grid is then looked up
automatically at page load.

**Courier status wording and thresholds** — `deriveStatus()` in `weather.js`.
The `HALTING` and `CAUTION` regexes decide which NWS event names escalate the
board.

**Still needs your real details.** Two spots are placeholders, marked in amber
with a dashed underline on the page so they are hard to ship by accident:

- the Tampa lab street address in `index.html`
- the QR code, which is currently a decorative placeholder — swap in a real one
  pointing at your booking link

Phone numbers and the account-manager email carried over from the original page
and are already live links.

## Browser support

Modern evergreen browsers. Uses `color-mix()`, `overflow: clip`, and CSS nesting-free
custom properties; the layout degrades gracefully without JavaScript, showing
everything except the live board.
