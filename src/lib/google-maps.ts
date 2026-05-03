export interface ParsedGoogleMapsLocation {
  mapUrl: string;
  latitude: number | null;
  longitude: number | null;
}

function parseCoordinatePair(value: string | null): {
  latitude: number | null;
  longitude: number | null;
} {
  if (!value) {
    return { latitude: null, longitude: null };
  }

  const match = value.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) {
    return { latitude: null, longitude: null };
  }

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { latitude: null, longitude: null };
  }

  return { latitude, longitude };
}

function normalizeGoogleMapsUrl(rawValue: string): URL | null {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed;
  } catch {
    return null;
  }
}

export function parseGoogleMapsLocation(rawValue: string): ParsedGoogleMapsLocation | null {
  const parsed = normalizeGoogleMapsUrl(rawValue);
  if (!parsed) {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  const isGoogleMapsHost =
    hostname.includes("google.com") || hostname.includes("goo.gl") || hostname.includes("maps.app.goo.gl");

  if (!isGoogleMapsHost) {
    return null;
  }

  if (hostname.includes("maps.app.goo.gl")) {
    return null;
  }

  const pathWithCoordinates = parsed.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (pathWithCoordinates) {
    return {
      mapUrl: parsed.toString(),
      latitude: Number(pathWithCoordinates[1]),
      longitude: Number(pathWithCoordinates[2]),
    };
  }

  const queryCandidates = [
    parsed.searchParams.get("q"),
    parsed.searchParams.get("query"),
    parsed.searchParams.get("ll"),
    parsed.searchParams.get("destination"),
    parsed.searchParams.get("origin"),
  ];

  for (const candidate of queryCandidates) {
    const coordinates = parseCoordinatePair(candidate);
    if (coordinates.latitude !== null && coordinates.longitude !== null) {
      return {
        mapUrl: parsed.toString(),
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      };
    }
  }

  return null;
}

export function buildGoogleMapsDirectionsUrl(
  latitude: number | null,
  longitude: number | null,
  fallbackUrl: string | null = null,
): string | null {
  if (latitude === null || longitude === null) {
    return fallbackUrl;
  }

  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

export function haversineDistanceKm(
  originLatitude: number,
  originLongitude: number,
  targetLatitude: number | null,
  targetLongitude: number | null,
): number | null {
  if (targetLatitude === null || targetLongitude === null) {
    return null;
  }

  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latDiff = toRadians(targetLatitude - originLatitude);
  const lngDiff = toRadians(targetLongitude - originLongitude);
  const a =
    Math.sin(latDiff / 2) * Math.sin(latDiff / 2) +
    Math.cos(toRadians(originLatitude)) *
      Math.cos(toRadians(targetLatitude)) *
      Math.sin(lngDiff / 2) *
      Math.sin(lngDiff / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((earthRadiusKm * c).toFixed(2));
}
