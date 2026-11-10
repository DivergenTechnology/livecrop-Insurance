'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { CloudSun, RefreshCw, Droplets, Wind, Gauge, Eye, Sun, CloudRain, Thermometer } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { apiFetch, type Plot } from './shared';
import { SectionCard } from './shared';
import { describeWeather } from '@/lib/weather-codes';

// WeatherResponse shape returned by /api/weather
interface WeatherResponse {
  location: { latitude: number; longitude: number; name?: string };
  current: {
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
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    precipitation: number[];
    weather_code: number[];
    wind_speed_10m: number[];
    relative_humidity_2m: number[];
  };
  daily: {
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
  };
  units: Record<string, string>;
}

// Extract the centroid of a plot's GeoJSON polygon so we can query weather for it.
function centroidOf(geoJson: string): { lat: number; lon: number } | null {
  try {
    const obj = JSON.parse(geoJson);
    // Accept either a GeoJSON Feature or a raw Polygon.
    const geom = obj.geometry ?? obj;
    if (!geom || geom.type !== 'Polygon' || !Array.isArray(geom.coordinates)) return null;
    const ring = geom.coordinates[0] as [number, number][];
    if (!ring || ring.length === 0) return null;
    let sumLon = 0;
    let sumLat = 0;
    for (const [lon, lat] of ring) {
      sumLon += lon;
      sumLat += lat;
    }
    return { lat: sumLat / ring.length, lon: sumLon / ring.length };
  } catch {
    return null;
  }
}

export function WeatherTab() {
  const [plots, setPlots] = useState<Plot[]>([]);
  const [selectedPlotId, setSelectedPlotId] = useState<string>('');
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchingWeather, setFetchingWeather] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadPlots = useCallback(async () => {
    setLoading(true);
    try {
      const p = await apiFetch<Plot[]>('/api/plots');
      setPlots(p);
      if (p.length > 0 && !selectedPlotId) setSelectedPlotId(p[0].id);
    } catch (e) {
      toast.error('Failed to load plots', { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [selectedPlotId]);

  useEffect(() => {
    void loadPlots();
  }, [loadPlots, refreshKey]);

  const selectedPlot = useMemo(
    () => plots.find((p) => p.id === selectedPlotId) ?? null,
    [plots, selectedPlotId],
  );

  const loadWeather = useCallback(async () => {
    if (!selectedPlot) return;
    const c = centroidOf(selectedPlot.boundaryGeoJson);
    if (!c) {
      toast.error('Could not determine plot location from its GeoJSON');
      return;
    }
    setFetchingWeather(true);
    setWeather(null); // clear stale data so error states render cleanly
    try {
      const params = new URLSearchParams({
        lat: c.lat.toFixed(4),
        lon: c.lon.toFixed(4),
        name: selectedPlot.plotName,
      });
      const data = await apiFetch<WeatherResponse>(`/api/weather?${params.toString()}`);
      setWeather(data);
      toast.success('Weather updated', {
        description: `${selectedPlot.plotName} · ${data.current.temperature_2m}°C · ${describeWeather(data.current.weather_code).label}`,
      });
    } catch (e) {
      const err = e as Error & { status?: number; data?: { rateLimited?: boolean; detail?: string } };
      if (err.status === 429 || err.data?.rateLimited) {
        toast.error('Weather service rate-limited', {
          description: 'Open-Meteo free tier daily limit reached. Please try again later or self-host the API.',
          duration: 10000,
        });
      } else {
        toast.error('Failed to fetch weather', { description: err.message });
      }
    } finally {
      setFetchingWeather(false);
    }
  }, [selectedPlot]);

  // Auto-fetch weather when the selected plot changes.
  useEffect(() => {
    if (selectedPlot) void loadWeather();
  }, [selectedPlotId, selectedPlot, loadWeather]);

  // Auto-refresh every 10 minutes while the tab is open.
  useEffect(() => {
    const id = setInterval(() => {
      if (selectedPlot) void loadWeather();
    }, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [selectedPlot, loadWeather]);

  // Build chart data — next 24 hours of hourly forecast.
  const hourlyData = useMemo(() => {
    if (!weather) return [];
    const now = new Date();
    const next24: { time: string; label: string; temp: number; precipProb: number; precip: number; humidity: number; wind: number }[] = [];
    for (let i = 0; i < weather.hourly.time.length; i++) {
      const t = new Date(weather.hourly.time[i]);
      if (t < now) continue;
      if (next24.length >= 24) break;
      next24.push({
        time: weather.hourly.time[i],
        label: t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        temp: weather.hourly.temperature_2m[i],
        precipProb: weather.hourly.precipitation_probability[i] ?? 0,
        precip: weather.hourly.precipitation[i] ?? 0,
        humidity: weather.hourly.relative_humidity_2m[i] ?? 0,
        wind: weather.hourly.wind_speed_10m[i] ?? 0,
      });
    }
    return next24;
  }, [weather]);

  // 7-day daily forecast cards data.
  const dailyData = useMemo(() => {
    if (!weather) return [];
    return weather.daily.time.map((t, i) => ({
      date: new Date(t),
      weatherCode: weather.daily.weather_code[i],
      tempMax: weather.daily.temperature_2m_max[i],
      tempMin: weather.daily.temperature_2m_min[i],
      precipSum: weather.daily.precipitation_sum[i],
      precipProb: weather.daily.precipitation_probability_max[i] ?? 0,
      windMax: weather.daily.wind_speed_10m_max[i],
      sunrise: weather.daily.sunrise[i],
      sunset: weather.daily.sunset[i],
      uvMax: weather.daily.uv_index_max[i],
    }));
  }, [weather]);

  const currentDesc = weather ? describeWeather(weather.current.weather_code) : null;
  const tempUnit = weather?.units?.temperature_2m ?? '°C';
  const windUnit = weather?.units?.wind_speed_10m ?? 'km/h';
  const precipUnit = weather?.units?.precipitation ?? 'mm';

  return (
    <div className="space-y-6">
      <SectionCard
        title="Real-time weather conditions"
        description="Live current conditions + 24-hour hourly + 7-day forecast per registered plot. Data: Open-Meteo (no API key, 10-min cache)."
        actions={
          <>
            <Select value={selectedPlotId} onValueChange={setSelectedPlotId}>
              <SelectTrigger className="w-[260px]"><SelectValue placeholder="Select a plot" /></SelectTrigger>
              <SelectContent>
                {plots.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.plotName}{p.cropType ? ` · ${p.cropType}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh plots
            </Button>
            <Button size="sm" className="bg-[#0C3B2E] text-white hover:bg-[#0C3B2E]/90" onClick={loadWeather} disabled={fetchingWeather || !selectedPlot}>
              <CloudSun className="mr-2 h-4 w-4" /> {fetchingWeather ? 'Fetching…' : 'Update weather'}
            </Button>
          </>
        }
      >
        {loading ? (
          <p className="text-sm text-slate-500">Loading plots…</p>
        ) : plots.length === 0 ? (
          <p className="text-sm text-slate-500">No plots registered. Register a plot first to view its weather.</p>
        ) : !weather ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800">Weather data unavailable</p>
            <p className="mt-1 text-xs text-amber-700">
              The Open-Meteo free API may be rate-limited (10,000 requests/day shared across all sandbox users).
              Click <strong>Update weather</strong> to retry, or wait a few minutes for the limit to reset.
              In production this is not an issue — Open-Meteo free tier is generous for a single deployment.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current conditions hero card */}
            <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-sky-50 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-5xl" aria-hidden>{currentDesc?.emoji}</div>
                  <div>
                    <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">{weather.location.name}</p>
                    <p className="text-3xl font-bold text-slate-900">
                      {weather.current.temperature_2m}{tempUnit}
                    </p>
                    <p className="text-sm text-slate-600">{currentDesc?.label}</p>
                    <p className="text-xs text-slate-500">
                      Feels like {weather.current.apparent_temperature}{tempUnit} · Updated {new Date(weather.current.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Metric icon={<Droplets className="h-4 w-4" />} label="Humidity" value={`${weather.current.relative_humidity_2m}%`} />
                  <Metric icon={<Wind className="h-4 w-4" />} label="Wind" value={`${weather.current.wind_speed_10m} ${windUnit}`} />
                  <Metric icon={<CloudRain className="h-4 w-4" />} label="Precip" value={`${weather.current.precipitation} ${precipUnit}`} />
                  <Metric icon={<Eye className="h-4 w-4" />} label="Cloud cover" value={`${weather.current.cloud_cover}%`} />
                  <Metric icon={<Gauge className="h-4 w-4" />} label="Pressure" value={`${weather.current.surface_pressure} hPa`} />
                  <Metric icon={<Thermometer className="h-4 w-4" />} label="Apparent" value={`${weather.current.apparent_temperature}${tempUnit}`} />
                </div>
              </div>
            </div>

            {/* 24-hour hourly charts */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Thermometer className="h-4 w-4 text-rose-500" /> Temperature · next 24 hours
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={hourlyData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
                        <YAxis tick={{ fontSize: 10 }} unit={tempUnit} />
                        <Tooltip formatter={(v: number) => [`${v}${tempUnit}`, 'Temperature']} />
                        <Line type="monotone" dataKey="temp" stroke="#dc2626" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <CloudRain className="h-4 w-4 text-sky-500" /> Precipitation · next 24 hours
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hourlyData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} unit="%" />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit={precipUnit} />
                        <Tooltip formatter={(v: number, name: string) => name === 'precipProb' ? [`${v}%`, 'Probability'] : [`${v} ${precipUnit}`, 'Rain']} />
                        <Legend formatter={(e: string) => e === 'precipProb' ? 'Probability %' : 'Rain mm'} />
                        <Bar yAxisId="left" dataKey="precipProb" fill="#0ea5e9" name="precipProb" radius={[3, 3, 0, 0]} />
                        <Bar yAxisId="right" dataKey="precip" fill="#0284c7" name="precip" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Droplets className="h-4 w-4 text-emerald-500" /> Humidity · next 24 hours
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={hourlyData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
                        <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                        <Tooltip formatter={(v: number) => [`${v}%`, 'Humidity']} />
                        <Line type="monotone" dataKey="humidity" stroke="#10b981" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Wind className="h-4 w-4 text-slate-500" /> Wind speed · next 24 hours
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={hourlyData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
                        <YAxis tick={{ fontSize: 10 }} unit={` ${windUnit}`} />
                        <Tooltip formatter={(v: number) => [`${v} ${windUnit}`, 'Wind']} />
                        <Line type="monotone" dataKey="wind" stroke="#64748b" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 7-day forecast */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">7-day forecast</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                  {dailyData.map((d) => {
                    const desc = describeWeather(d.weatherCode);
                    return (
                      <div key={d.date.toISOString()} className="rounded-lg border border-slate-200 bg-white p-3 text-center">
                        <p className="text-xs font-medium text-slate-500">
                          {d.date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit' })}
                        </p>
                        <div className="my-1 text-3xl" aria-hidden>{desc.emoji}</div>
                        <p className="text-xs text-slate-600">{desc.label}</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">
                          {d.tempMax}° / <span className="text-slate-400">{d.tempMin}°</span>
                        </p>
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-sky-600">
                          <CloudRain className="h-3 w-3" /> {d.precipSum} {precipUnit}
                        </p>
                        <p className="text-[10px] text-slate-400">{d.precipProb}% prob</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <p className="text-xs text-slate-400">
              Source: <a href="https://open-meteo.com" target="_blank" rel="noreferrer" className="underline">Open-Meteo</a> · free, no API key · cached 10 minutes · auto-refreshes every 10 minutes while this tab is open.
            </p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white/70 px-3 py-2">
      <span className="text-emerald-600">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
        <p className="truncate text-sm font-medium text-slate-900">{value}</p>
      </div>
    </div>
  );
}
