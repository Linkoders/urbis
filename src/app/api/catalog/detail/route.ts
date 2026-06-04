import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  canViewProduct,
  computeRating,
  getSessionUser,
  readDb,
  writeDb,
} from "@/lib/urbis-store";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get("productId");
  const slug = request.nextUrl.searchParams.get("slug");

  if (!productId && !slug) {
    return NextResponse.json({ error: "productId o slug es requerido." }, { status: 400 });
  }

  const db = await readDb();
  const viewer = await getSessionUser(request);
  const visitorSessionId =
    request.cookies.get("urbis_visitor_id")?.value?.trim() || randomUUID();

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
  const canManageAsOwnerOrAdmin = Boolean(
    viewer &&
      (viewer.id === product.ownerId ||
        viewer.role === "superadmin" ||
        (viewer.role === "admin_conjunto" && viewer.conjuntoId === emprendimiento.conjuntoId)),
  );

  if (
    !canManageAsOwnerOrAdmin &&
    (!conjunto || !canViewProduct(product, emprendimiento, conjunto, viewer))
  ) {
    return NextResponse.json({ error: "No autorizado para ver este producto." }, { status: 403 });
  }

  if (!conjunto) {
    return NextResponse.json({ error: "Conjunto no encontrado." }, { status: 404 });
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

  try {
    await prisma.userProductVisitRecord.create({
      data: {
        userId: viewer?.id ?? null,
        productId: product.id,
        emprendimientoId: emprendimiento.id,
        sessionId: visitorSessionId,
        referrer: request.headers.get("referer") || null,
      },
    });

    await prisma.emprendimientoVisitRecord.create({
      data: {
        userId: viewer?.id ?? null,
        emprendimientoId: emprendimiento.id,
        sessionId: visitorSessionId,
        referrer: request.headers.get("referer") || null,
      },
    });

    if (viewer) {
      await prisma.productInterestRecord.create({
        data: {
          userId: viewer.id,
          productId: product.id,
          category: product.category,
          source: "product_view",
          weight: 1,
          lastInteractedAt: new Date(),
        },
      });
    }
  } catch {
    // Keep product endpoint resilient even if personalization tracking fails.
  }

  const response = NextResponse.json({
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
        verificationStatus:
          conjunto.slug === "emprendedores-independientes" ? "unverified" : "verified",
        verificationWarning:
          conjunto.slug === "emprendedores-independientes"
            ? "Este emprendimiento no esta verificado por un conjunto. No podemos garantizar su confiabilidad."
            : null,
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

  response.cookies.set("urbis_visitor_id", visitorSessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
