import { NextResponse } from "next/server";
import { readDb } from "@/lib/urbis-store";

export const runtime = "nodejs";

export async function GET() {
  const db = await readDb();
  const conjuntos = db.conjuntos
    .filter((entry) => entry.status === "approved")
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      slug: entry.slug,
      location: entry.location,
    }));

  return NextResponse.json({ conjuntos });
}