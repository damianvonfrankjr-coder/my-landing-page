/* ═══════════════════════════════════════════════════════════════
   Shared Tampa Bay weather data layer.

   Used by both the landing page (weather.js) and the broadcast
   display (kiosk.js). Exposes a single global: window.WX

   Sources (public, CORS-enabled, no API key):
     • api.weather.gov     — official NWS forecast + active alerts
     • api.open-meteo.com  — live current conditions, forecast fallback
   ═══════════════════════════════════════════════════════════════ */

(function (global) {
    'use strict';

    const CONFIG = {
        // Downtown Tampa. Change these to point everything at another city.
        lat: 27.9506,
        lon: -82.4572,
        placeName: 'Tampa',
        regionName: 'Tampa Bay',

        // NWS forecast grid for downtown Tampa (office TBW), resolved from
        // https://api.weather.gov/points/27.9506,-82.4572
        // Set to null when you change lat/lon and it is looked up live.
        grid: { office: 'TBW', x: 71, y: 98 },

        refreshMs: 10 * 60 * 1000,
        forecastPeriods: 5,
    };

    async function getJSON(url, { timeout = 12000 } = {}) {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), timeout);
        try {
            const res = await fetch(url, {
                signal: ctl.signal,
                headers: { Accept: 'application/geo+json, application/json' },
            });
            if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
            return await res.json();
        } finally {
            clearTimeout(timer);
        }
    }

    /* ── WMO weather codes (Open-Meteo) ───────────────────────── */

    const WMO = {
        0: 'Clear', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
        45: 'Fog', 48: 'Rime Fog', 51: 'Light Drizzle', 53: 'Drizzle', 55: 'Heavy Drizzle',
        61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain',
        71: 'Light Snow', 73: 'Snow', 75: 'Heavy Snow', 77: 'Snow Grains',
        80: 'Light Showers', 81: 'Showers', 82: 'Violent Showers',
        95: 'Thunderstorms', 96: 'Thunderstorms with Hail', 99: 'Severe Thunderstorms',
    };

    /* ── Condition classification, shared by both icon sets ───── */

    function classify(text = '') {
        const t = text.toLowerCase();
        if (/thunder|t-storm|tstorm|lightning/.test(t)) return 'storm';
        if (/rain|shower|drizzle|precip/.test(t)) return 'rain';
        if (/fog|haze|mist|smoke/.test(t)) return 'fog';
        if (/(mostly|partly)\s+(sunny|clear)|partly cloudy/.test(t)) return 'partly';
        if (/cloud|overcast/.test(t)) return 'cloud';
        if (/sunny|clear|fair|hot/.test(t)) return 'sun';
        return 'partly';
    }

    function iconFor(text) {
        const s = 'stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"';
        const cloud = `<path d="M7 18.5h10a3.75 3.75 0 0 0 .3-7.5 5.5 5.5 0 0 0-10.5-1.2A3.9 3.9 0 0 0 7 18.5z" ${s}/>`;
        const parts = {
            sun: `<circle cx="12" cy="12" r="4.4" ${s}/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" ${s}/>`,
            cloud,
            rain: `${cloud}<path d="M8.5 20.5l-.9 2M12 20.5l-.9 2M15.5 20.5l-.9 2" ${s}/>`,
            storm: `${cloud}<path d="M12.8 19.4l-2.4 3.4h2.6l-1.6 2.6" ${s} stroke-width="1.5"/>`,
            fog: `${cloud}<path d="M5.5 21h13M7.5 23.5h9" ${s}/>`,
            partly: `<circle cx="8.6" cy="8.6" r="3.1" ${s}/><path d="M8.6 2.8v1.6M2.8 8.6h1.6M4.5 4.5l1.1 1.1M12.7 4.5l-1.1 1.1" ${s}/><path d="M9 19.5h8a3.2 3.2 0 0 0 .25-6.4 4.7 4.7 0 0 0-8.95-1A3.35 3.35 0 0 0 9 19.5z" ${s}/>`,
        };
        return `<svg width="27" height="27" viewBox="0 0 24 26" aria-hidden="true">${parts[classify(text)]}</svg>`;
    }

    /* ── Fetching ─────────────────────────────────────────────── */

    async function resolveGrid() {
        if (CONFIG.grid) return CONFIG.grid;
        const pt = await getJSON(`https://api.weather.gov/points/${CONFIG.lat},${CONFIG.lon}`);
        const p = pt.properties;
        return { office: p.gridId, x: p.gridX, y: p.gridY };
    }

    async function fetchNwsForecast() {
        const g = await resolveGrid();
        const data = await getJSON(
            `https://api.weather.gov/gridpoints/${g.office}/${g.x},${g.y}/forecast`
        );
        return data.properties.periods.slice(0, CONFIG.forecastPeriods).map((p) => ({
            name: p.name,
            temp: p.temperature,
            unit: p.temperatureUnit,
            short: p.shortForecast,
            detailed: p.detailedForecast || '',
            pop: p.probabilityOfPrecipitation?.value ?? null,
            wind: p.windSpeed,
            windDir: p.windDirection || '',
            isDay: p.isDaytime,
        }));
    }

    async function fetchAlerts() {
        const data = await getJSON(
            `https://api.weather.gov/alerts/active?point=${CONFIG.lat},${CONFIG.lon}`
        );
        return (data.features || []).map((f) => ({
            event: f.properties.event,
            severity: (f.properties.severity || 'unknown').toLowerCase(),
            urgency: f.properties.urgency,
            headline: f.properties.headline,
            description: f.properties.description || '',
            ends: f.properties.ends || f.properties.expires,
        }));
    }

    async function fetchCurrent() {
        const url =
            'https://api.open-meteo.com/v1/forecast' +
            `?latitude=${CONFIG.lat}&longitude=${CONFIG.lon}` +
            '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,' +
            'wind_speed_10m,wind_direction_10m,surface_pressure' +
            '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FNew_York';
        const d = await getJSON(url);
        const c = d.current;
        return {
            temp: Math.round(c.temperature_2m),
            feels: Math.round(c.apparent_temperature),
            humidity: Math.round(c.relative_humidity_2m),
            wind: Math.round(c.wind_speed_10m),
            windDir: compass(c.wind_direction_10m),
            pressure: c.surface_pressure != null ? (c.surface_pressure * 0.02953).toFixed(2) : null,
            text: WMO[c.weather_code] ?? 'Current Conditions',
        };
    }

    async function fetchOpenMeteoForecast() {
        const url =
            'https://api.open-meteo.com/v1/forecast' +
            `?latitude=${CONFIG.lat}&longitude=${CONFIG.lon}` +
            '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
            '&temperature_unit=fahrenheit&timezone=America%2FNew_York' +
            `&forecast_days=${CONFIG.forecastPeriods}`;
        const d = await getJSON(url);
        const fmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'America/New_York' });
        return d.daily.time.map((iso, i) => ({
            name: i === 0 ? 'Today' : fmt.format(new Date(`${iso}T12:00:00`)),
            temp: Math.round(d.daily.temperature_2m_max[i]),
            low: Math.round(d.daily.temperature_2m_min[i]),
            unit: 'F',
            short: WMO[d.daily.weather_code[i]] ?? '—',
            detailed: '',
            pop: d.daily.precipitation_probability_max[i],
            wind: '',
            isDay: true,
        }));
    }

    function compass(deg) {
        if (deg == null) return '';
        const pts = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                     'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        return pts[Math.round(deg / 22.5) % 16];
    }

    /* ── Courier status ───────────────────────────────────────── */

    const HALTING = /hurricane|tornado|tropical storm warning|storm surge warning|flash flood warning|extreme wind/i;
    const CAUTION = /watch|advisory|flood|wind|thunderstorm|heat|rip current|special weather/i;

    function deriveStatus(alerts, forecast, current) {
        const worst = alerts.find(
            (a) => HALTING.test(a.event) || ['extreme', 'severe'].includes(a.severity)
        );
        if (worst) {
            return {
                level: 'halt',
                label: 'Courier routes suspended',
                short: 'ROUTES SUSPENDED',
                accent: '#ff4e4e',
                copy: `The National Weather Service has an active ${worst.event} for the Tampa Bay area. ` +
                      'Courier pickup and delivery are paused until the advisory clears. Cases already in ' +
                      'the lab stay in production, and your account manager will call you directly with an ETA.',
                pickup: 'Paused',
                rush: 'Unavailable',
            };
        }

        const caution = alerts.find((a) => CAUTION.test(a.event));
        const stormy = forecast.some((p) => p.pop != null && p.pop >= 60);
        const windy = current && current.wind >= 25;

        if (caution || windy) {
            const reason = caution ? caution.event : 'sustained winds across the bay';
            return {
                level: 'watch',
                label: 'Monitoring conditions',
                short: 'MONITORING',
                accent: '#ffb347',
                copy: `An active ${reason} may slow afternoon routes across the bay. Pickups are running, ` +
                      'but build in extra time on anything seating tomorrow. Digital case intake is unaffected.',
                pickup: 'Running · possible delays',
                rush: 'Case-by-case',
            };
        }

        if (stormy) {
            return {
                level: 'normal',
                label: 'All routes normal',
                short: 'ALL ROUTES NORMAL',
                accent: '#4fd1c5',
                copy: 'Routes are running on schedule. Typical Gulf Coast afternoon storms are in the ' +
                      'forecast, so morning pickups are the safest window for anything time-sensitive.',
                pickup: 'On schedule',
                rush: 'Available · book by 10a',
            };
        }

        return {
            level: 'normal',
            label: 'All routes normal',
            short: 'ALL ROUTES NORMAL',
            accent: '#4fd1c5',
            copy: 'Clear conditions across Tampa Bay. Courier pickup and delivery are running on ' +
                  'schedule for Tampa, St. Petersburg, Clearwater and Brandon.',
            pickup: 'On schedule',
            rush: 'Available',
        };
    }

    /* ── One call for everything ──────────────────────────────── */

    async function fetchAll() {
        // Settle independently so a single outage cannot blank the display.
        const [fcRes, alRes, curRes] = await Promise.allSettled([
            fetchNwsForecast(),
            fetchAlerts(),
            fetchCurrent(),
        ]);

        let forecast = fcRes.status === 'fulfilled' ? fcRes.value : null;
        let usedFallback = false;
        if (!forecast) {
            console.warn('[wx] NWS forecast unavailable, falling back to Open-Meteo', fcRes.reason);
            forecast = await fetchOpenMeteoForecast();
            usedFallback = true;
        }

        const alerts = alRes.status === 'fulfilled' ? alRes.value : [];
        const current = curRes.status === 'fulfilled' ? curRes.value : null;

        if (!forecast.length && !current) throw new Error('no weather data available');

        return {
            forecast,
            alerts,
            current,
            usedFallback,
            status: deriveStatus(alerts, forecast, current),
            fetchedAt: new Date(),
        };
    }

    global.WX = {
        CONFIG, getJSON, WMO, classify, iconFor, compass,
        fetchNwsForecast, fetchAlerts, fetchCurrent, fetchOpenMeteoForecast,
        deriveStatus, fetchAll,
    };
})(window);
