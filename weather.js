// Netlify Function: weather proxy
// يتجنب CORS — الـ fetch يصير من server-side
// ?mode=daily  → يجيب توقع 7 أيام
// بدون mode   → يجيب الطقس الحالي

exports.handler = async function(event) {
  const mode = (event.queryStringParameters || {}).mode || 'current';
  const isDailyMode = mode === 'daily';

  const LAT = '29.5993';
  const LNG = '32.7084';
  const TZ  = 'Africa%2FCairo';

  const OPEN_METEO_CURRENT =
    'https://api.open-meteo.com/v1/forecast?latitude=' + LAT + '&longitude=' + LNG +
    '&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,visibility,weather_code' +
    '&wind_speed_unit=kmh&timezone=' + TZ;

  const OPEN_METEO_DAILY =
    'https://api.open-meteo.com/v1/forecast?latitude=' + LAT + '&longitude=' + LNG +
    '&daily=temperature_2m_max,temperature_2m_min,weathercode,windspeed_10m_max' +
    '&timezone=' + TZ + '&forecast_days=7';

  const WTTR = 'https://wttr.in/' + LAT + ',' + LNG + '?format=j1';

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=600'
  };

  const url = isDailyMode ? OPEN_METEO_DAILY : OPEN_METEO_CURRENT;

  // 1) open-meteo
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    return { statusCode: 200, headers, body: JSON.stringify({ source: 'openmeteo', data }) };
  } catch (e1) {}

  // 2) wttr.in fallback (current only)
  if (!isDailyMode) {
    try {
      const ctrl2 = new AbortController();
      const timer2 = setTimeout(() => ctrl2.abort(), 5000);
      const r2 = await fetch(WTTR, { signal: ctrl2.signal });
      clearTimeout(timer2);
      if (!r2.ok) throw new Error('HTTP ' + r2.status);
      const data2 = await r2.json();
      return { statusCode: 200, headers, body: JSON.stringify({ source: 'wttr', data: data2 }) };
    } catch (e2) {}
  }

  // 3) static fallback
  return { statusCode: 200, headers, body: JSON.stringify({ source: 'static', data: null }) };
};
