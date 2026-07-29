# Spectrum Killian × MB2 Dental — Tampa Bay

A Tampa-only version of the "first five cases free" promotion, in two forms:

- **`index.html`** — the landing page, with a live case-logistics board
- **`kiosk.html`** — a broadcast display that plays on a loop, for a lobby or
  operatory screen

Both run on the real National Weather Service forecast for Tampa Bay. No build
step, no server, no API key.

## Why weather is on a dental lab page

Tampa's storm season runs June 1 – November 30. A lab that moves crown & bridge
cases by courier around the bay is genuinely affected by it, so the forecast is
turned into the thing a practice actually wants to know:

| Live conditions | State | Courier status |
| --- | --- | --- |
| Hurricane / tornado / tropical storm warning, or any NWS *Extreme* or *Severe* alert | Routes suspended (red) | Pickup paused, rush unavailable |
| Any watch, advisory, or sustained wind ≥ 25 mph | Monitoring (amber) | Running with possible delays |
| Clear, or ordinary afternoon storms | Normal (teal) | On schedule |

When an alert is active the accent color shifts across the whole page and the
sticky rail turns red, so the state is legible without reading.

## Broadcast mode

`kiosk.html` is built to be left running on a screen. It cycles six panels on a
timer — title card, current conditions, extended forecast, active weather
advisory, case logistics, and the partner offer — in a 90s-broadcast style:
deep blue gradients, heavy type with hard drop shadows, beveled panels,
scanlines, a CRT vignette, and a scrolling crawl along the bottom.

The advisory panel only enters the rotation while the NWS actually has an alert
out for Tampa, and drops back out when it clears.

**The music is generated live in your browser** — an original smooth jazz
engine written in Web Audio (`jazz.js`). Rhodes-style FM electric piano
comping, walking upright bass, brushed kit, and a sparse lead over ii–V–I
changes in rotating keys. Nothing is sampled and nothing is copyrighted, so it
can run all day in a public space, and because the parts are generated rather
than looped it doesn't become a thirty-second earworm.

**Running it on a screen**
- Click **Start the broadcast** — browsers require a gesture before audio can
  play. Tick "start without music" for a silent display.
- **Fullscreen** button, or press `f`. `m` toggles music, arrow keys change panel.
- It requests a screen wake lock so the display doesn't sleep (Chrome/Edge;
  Safari ignores it, so set the OS sleep timer there).
- The stage is a fixed 16:9 box that letterboxes to any screen, and every
  element is sized in container query units, so it scales from a phone to a
  lobby TV without a separate mobile layout.
- Weather refreshes every 10 minutes and again whenever the tab regains focus.

Controls fade out after a few seconds of no mouse movement.

## Files

| File | Purpose |
| --- | --- |
| `index.html` / `style.css` | the landing page |
| `kiosk.html` / `kiosk.css` | the broadcast display |
| `wx-data.js` | shared data layer — fetching, courier-status rules, icons |
| `weather.js` | landing-page rendering |
| `kiosk.js` | panel rotation, clock, crawl, controls |
| `jazz.js` | generative smooth jazz engine |

## Data sources

Both are public, free, CORS-enabled, and need no key or account:

- **[api.weather.gov](https://www.weather.gov/documentation/services-web-api)** —
  the official NWS forecast and active alerts. Public domain. Tampa resolves to
  forecast office `TBW`, grid `71,98`.
- **[open-meteo.com](https://open-meteo.com/)** — live current conditions
  (temperature, apparent temperature, humidity, wind, pressure), and a forecast
  fallback if the NWS endpoint is unavailable.

The three requests are issued independently, so one source going down does not
blank the display. If everything fails, the landing page shows a clearly-marked
unavailable state pointing at the phone number rather than stale data, and the
broadcast falls back to its brand panels.

## Customizing

**Location** — edit `CONFIG` at the top of `wx-data.js`. Both pages read it:

```js
const CONFIG = {
    lat: 27.9506,
    lon: -82.4572,
    placeName: 'Tampa',
    regionName: 'Tampa Bay',
    grid: { office: 'TBW', x: 71, y: 98 },  // set to null to auto-resolve
    refreshMs: 10 * 60 * 1000,
    forecastPeriods: 5,
};
```

Change `lat`/`lon` and set `grid: null` — the NWS grid is then looked up
automatically at page load.

**Courier status wording and thresholds** — `deriveStatus()` in `wx-data.js`.
The `HALTING` and `CAUTION` regexes decide which NWS event names escalate.

**Panel timing** — the `ROTATION` array at the top of `kiosk.js`. Each entry has
a `hold` in milliseconds.

**Music** — tempo, swing and the chord progressions are constants at the top of
`jazz.js`. `Jazz.setVolume(0–1)` sets level; the slider in the controls bar is
wired to it.

**Still needs your real details.** Two spots are placeholders, marked in amber
with a dashed underline on the landing page so they are hard to ship by accident:

- the Tampa lab street address in `index.html`
- the QR code, currently decorative — swap in a real one pointing at your
  booking link

Phone numbers and the account-manager email carried over from the original page
and are already live links.

## Browser support

Modern evergreen browsers. Uses `color-mix()`, `overflow: clip`, container query
units, and Web Audio. The landing page degrades gracefully without JavaScript,
showing everything except the live board.

## Legal notes

Weather data is from the U.S. National Weather Service (NOAA) and is public
domain; the footer credits it. The broadcast display evokes the look of 90s
cable weather segments but does not use any broadcaster's name, logo, fonts, or
music — the visual design is original and the soundtrack is generated from
scratch at runtime.
