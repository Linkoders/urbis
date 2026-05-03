import { NextRequest, NextResponse } from "next/server";
import { buildGoogleMapsDirectionsUrl, haversineDistanceKm } from "@/lib/google-maps";
import { readDb } from "@/lib/urbis-store";

export const runtime = "nodejs";

function safeNumber(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  const db = await readDb();
  const latitude = safeNumber(request.nextUrl.searchParams.get("latitude"));
  const longitude = safeNumber(request.nextUrl.searchParams.get("longitude"));

  const conjuntos = db.conjuntos
    .filter((entry) => entry.status === "approved")
    .map((entry) => {
      const distanceKm =
        latitude === null || longitude === null
          ? null
          : haversineDistanceKm(latitude, longitude, entry.latitude, entry.longitude);

      return {
        id: entry.id,
        name: entry.name,
        slug: entry.slug,
        location: entry.location,
        mapUrl: buildGoogleMapsDirectionsUrl(entry.latitude, entry.longitude, entry.mapUrl),
        latitude: entry.latitude,
        longitude: entry.longitude,
        distanceKm,
      };
    })
    .sort((a, b) => {
      if (a.distanceKm === null && b.distanceKm === null) {
        return a.name.localeCompare(b.name);
      }

      if (a.distanceKm === null) {
        return 1;
      }

      if (b.distanceKm === null) {
        return -1;
      }

      return a.distanceKm - b.distanceKm;
    });

  return NextResponse.json({ conjuntos });
}
