import { NextResponse } from "next/server";
import { canViewProduct, computeRating, readDb } from "@/lib/urbis-store";

export const runtime = "nodejs";

export async function GET() {
  const db = await readDb();

  const ofertas = db.products
    .flatMap((product) => {
      const specialPrice =
        typeof product.specialPrice === "number" ? product.specialPrice : null;

      if (specialPrice === null || specialPrice >= product.price) {
        return [];
      }

      const emprendimiento = db.emprendimientos.find(
        (entry) => entry.id === product.emprendimientoId,
      );
      if (!emprendimiento) {
        return [];
      }

      const conjunto = db.conjuntos.find((entry) => entry.id === emprendimiento.conjuntoId);
      if (!conjunto || !canViewProduct(product, emprendimiento, conjunto, null)) {
        return [];
      }

      const discountPercent = Math.round(
        ((product.price - specialPrice) / product.price) * 100,
      );

      return [{
        id: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        image: product.imageUrls[0] ?? "/images/hero-market.jpg",
        category: product.category,
        regularPrice: product.price,
        specialPrice,
        discountPercent,
        rating: computeRating(product.id, db),
        viewCount: product.viewCount,
        conjuntoName: conjunto.name,
      }];
    })
    .sort((a, b) => b.discountPercent - a.discountPercent)
    .slice(0, 8);

  return NextResponse.json({ ofertas });
}
