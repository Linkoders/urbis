import { NextRequest, NextResponse } from "next/server";
import {
  canViewProduct,
  computeRating,
  getSessionUser,
  readDb,
  writeDb,
} from "@/lib/urbis-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get("productId");
  const slug = request.nextUrl.searchParams.get("slug");

  if (!productId && !slug) {
    return NextResponse.json({ error: "productId o slug es requerido." }, { status: 400 });
  }

  const db = await readDb();
  const viewer = await getSessionUser(request);

  const product = db.products.find((entry) => {
    if (productId) {
      return entry.id === productId;
    }

    return entry.slug === slug;
  });
  if (!product) {
    return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });
  }

  const emprendimiento = db.emprendimientos.find(
    (entry) => entry.id === product.emprendimientoId,
  );
  if (!emprendimiento) {
    return NextResponse.json({ error: "Emprendimiento no encontrado." }, { status: 404 });
  }

  const conjunto = db.conjuntos.find((entry) => entry.id === emprendimiento.conjuntoId);
  if (!conjunto || !canViewProduct(product, emprendimiento, conjunto, viewer)) {
    return NextResponse.json({ error: "No autorizado para ver este producto." }, { status: 403 });
  }

  product.viewCount += 1;
  product.updatedAt = new Date().toISOString();
  await writeDb(db);

  const rating = computeRating(product.id, db);
  const specialPrice =
    typeof product.specialPrice === "number" ? product.specialPrice : null;
  const onSale = specialPrice !== null && specialPrice < product.price;
  const finalPrice = onSale ? specialPrice : product.price;
  const discountPercent = onSale
    ? Math.round(((product.price - specialPrice) / product.price) * 100)
    : 0;
  const reviews = db.reviews
    .filter((review) => review.productId === product.id && review.status === "visible")
    .map((review) => {
      const author = db.users.find((user) => user.id === review.authorId);
      return {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        author: author ? author.name : "Usuario",
      };
    });

  return NextResponse.json({
    product: {
      ...product,
      specialPrice,
      finalPrice,
      onSale,
      discountPercent,
      emprendimiento: {
        id: emprendimiento.id,
        name: emprendimiento.name,
        logoUrl: emprendimiento.logoUrl,
        contactEmail: emprendimiento.contactEmail,
        contactPhone: emprendimiento.contactPhone,
        visibility: emprendimiento.visibility,
      },
      conjunto: {
        id: conjunto.id,
        name: conjunto.name,
        slug: conjunto.slug,
      },
      rating,
      reviews,
    },
  });
}
