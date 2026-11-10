import { NextRequest, NextResponse } from 'next/server';
import { describeWeather } from '@/lib/weather-codes';

export const dynamic = 'force-dynamic';
export const revalidate = 600; // cache for 10 minutes

// Real-time weather via Open-Meteo (free, no API key required).
// Docs: https://open-meteo.com/en/docs

interface WeatherCurrent {
  time: string;
  temperature_2m: number;
  relative_humidity_2m: number;
  apparent_temperature: number;
  precipitation: number;
  rain: number;
  weather_code: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  cloud_cover: number;
  surface_pressure: number;
}

interface WeatherHourly {
  time: string[];
  temperature_2m: number[];
  precipitation_probability: number[];
  precipitation: number[];
  weather_code: number[];
  wind_speed_10m: number[];
  relative_humidity_2m: number[];
}

interface WeatherDaily {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  precipitation_probability_max: number[];
  wind_speed_10m_max: number[];
  sunrise: string[];
  sunset: string[];
  uv_index_max: number[];
}

export interface WeatherResponse {
  location: { latitude: number; longitude: number; name?: string };
  current: WeatherCurrent;
  hourly: WeatherHourly;
  daily: WeatherDaily;
  units: Record<string, string>;
}

// Re-export for any client that imports from the route module.
export { describeWeather };

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const lat = url.searchParams.get('lat');
  const lon = url.searchParams.get('lon');
  const name = url.searchParams.get('name');

  if (!lat || !lon) {
    return NextResponse.json(
      { error: 'lat and lon query params are required (e.g. ?lat=-0.42&lon=36.95)' },
      { status: 400 },
    );
  }

  const latitude = Number(lat);
  const longitude = Number(lon);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return NextResponse.json({ error: 'lat and lon must be numeric' }, { status: 400 });
  }

  // Open-Meteo endpoint — free, no API key.
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'precipitation',
      'rain',
      'weather_code',
      'wind_speed_10m',
      'wind_direction_10m',
      'cloud_cover',
      'surface_pressure',
    ].join(','),
    hourly: [
      'temperature_2m',
      'precipitation_probability',
      'precipitation',
      'weather_code',
      'wind_speed_10m',
      'relative_humidity_2m',
    ].join(','),
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'precipitation_probability_max',
      'wind_speed_10m_max',
      'sunrise',
      'sunset',
      'uv_index_max',
    ].join(','),
    timezone: 'Africa/Nairobi',
    forecast_days: '7',
  });

  const upstream = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;

  try {
    const res = await fetch(upstream, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 600 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream weather API returned ${res.status}` },
        { status: 502 },
      );
    }
    const data = (await res.json()) as WeatherResponse | { error: boolean; reason: string };
    // Open-Meteo returns 200 with an error body when rate-limited.
    if ('error' in data && data.error) {
      return NextResponse.json(
        { error: 'Weather service rate-limited', detail: data.reason, rateLimited: true },
        { status: 429 },
      );
    }
    const weatherData = data as WeatherResponse;
    // Attach the location name the client sent (for display only).
    weatherData.location = { ...weatherData.location, name: name || `${latitude.toFixed(2)}, ${longitude.toFixed(2)}` };
    return NextResponse.json(weatherData, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to fetch weather data', detail: (e as Error).message },
      { status: 502 },
    );
  }
}
