import { NextResponse } from "next/server";
import { readDb } from "@/lib/urbis-store";

export const runtime = "nodejs";

export async function GET() {
  const db = await readDb();

  const approvedConjuntos = db.conjuntos.filter((entry) => entry.status === "approved");
  const approvedEmprendimientos = db.emprendimientos.filter(
    (entry) => entry.status === "approved",
  );
  const publishedProducts = db.products.filter((entry) => entry.status === "published");
  const visibleReviews = db.reviews.filter((entry) => entry.status === "visible");

  const totalViews = publishedProducts.reduce((acc, entry) => acc + entry.viewCount, 0);

  const conjuntos = approvedConjuntos.map((conjunto) => {
    const emprendimientos = approvedEmprendimientos.filter(
      (entry) => entry.conjuntoId === conjunto.id,
    );
    const emprendimientoIds = new Set(emprendimientos.map((entry) => entry.id));
    const products = publishedProducts.filter((entry) =>
      emprendimientoIds.has(entry.emprendimientoId),
    );

    const productIds = new Set(products.map((entry) => entry.id));
    const reviews = visibleReviews.filter((entry) => productIds.has(entry.productId));
    const averageRating =
      reviews.length === 0
        ? 0
        : Number(
            (
              reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length
            ).toFixed(1),
          );

    return {
      id: conjunto.id,
      name: conjunto.name,
      slug: conjunto.slug,
      location: conjunto.location,
      logoUrl: conjunto.logoUrl ?? "/images/owner-1.jpg",
      emprendimientos: emprendimientos.length,
      products: products.length,
      reviews: reviews.length,
      averageRating,
    };
  });

  return NextResponse.json({
    stats: {
      conjuntos: approvedConjuntos.length,
      emprendimientos: approvedEmprendimientos.length,
      productos: publishedProducts.length,
      resenas: visibleReviews.length,
      visitas: totalViews,
    },
    conjuntos,
  });
}
