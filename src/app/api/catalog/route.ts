import { NextRequest, NextResponse } from "next/server";
import { buildGoogleMapsDirectionsUrl, haversineDistanceKm } from "@/lib/google-maps";
import { canViewProduct, getSessionUser, readDb } from "@/lib/urbis-store";
import { PRODUCT_CATEGORIES } from "@/config/product-categories";

export const runtime = "nodejs";

function safeNumber(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildRatingsByProductId(
  reviews: Array<{ productId: string; rating: number; status: string }>,
): Map<string, { average: number; total: number }> {
  const summary = new Map<string, { sum: number; total: number }>();
  for (const review of reviews) {
    if (review.status !== "visible") {
      continue;
    }

    const current = summary.get(review.productId);
    if (current) {
      current.sum += review.rating;
      current.total += 1;
    } else {
      summary.set(review.productId, { sum: review.rating, total: 1 });
    }
  }

  const result = new Map<string, { average: number; total: number }>();
  for (const [productId, entry] of summary.entries()) {
    result.set(productId, {
      average: Number((entry.sum / entry.total).toFixed(1)),
      total: entry.total,
    });
  }

  return result;
}

export async function GET(request: NextRequest) {
  const db = await readDb();
  const viewer = await getSessionUser(request);

  const search = request.nextUrl.searchParams.get("search")?.toLowerCase() ?? "";
  const category = request.nextUrl.searchParams.get("category") ?? "all";
  const conjuntoSlug = request.nextUrl.searchParams.get("conjunto") ?? "all";
  const sort = request.nextUrl.searchParams.get("sort") ?? "recent";
  const onSaleOnly = request.nextUrl.searchParams.get("onSale") === "1";
  const scope = request.nextUrl.searchParams.get("scope") ?? "all";
  const minPrice = safeNumber(request.nextUrl.searchParams.get("minPrice"));
  const maxPrice = safeNumber(request.nextUrl.searchParams.get("maxPrice"));
  const offset = safeNumber(request.nextUrl.searchParams.get("offset")) ?? 0;
  const parsedLimit = safeNumber(request.nextUrl.searchParams.get("limit")) ?? 12;
  const latitude = safeNumber(request.nextUrl.searchParams.get("latitude"));
  const longitude = safeNumber(request.nextUrl.searchParams.get("longitude"));
  const limit = Math.min(Math.max(parsedLimit, 1), 24);
  const safeOffset = offset < 0 ? 0 : offset;

  const emprendimientoById = new Map(
    db.emprendimientos.map((entry) => [entry.id, entry] as const),
  );
  const conjuntoById = new Map(db.conjuntos.map((entry) => [entry.id, entry] as const));
  const userById = new Map(db.users.map((entry) => [entry.id, entry] as const));
  const ratingByProductId = buildRatingsByProductId(db.reviews);

  const items = db.products.flatMap((product) => {
    const emprendimiento = emprendimientoById.get(product.emprendimientoId);
    if (!emprendimiento) {
      return [];
    }

    const conjunto = conjuntoById.get(emprendimiento.conjuntoId);
    if (!conjunto) {
      return [];
    }

    if (!canViewProduct(product, emprendimiento, conjunto, viewer)) {
      return [];
    }

    const rating = ratingByProductId.get(product.id) ?? { average: 0, total: 0 };
    const isIndependentSeller = conjunto.slug === "emprendedores-independientes";
    const verificationStatus = isIndependentSeller ? "unverified" : "verified";
    const owner = userById.get(product.ownerId);
    const ownerIsPlus = Boolean(
      owner &&
        owner.status === "active" &&
        owner.subscriptionPlan === "plus" &&
        owner.subscriptionStatus === "active",
    );
    const specialPrice =
      typeof product.specialPrice === "number" ? product.specialPrice : null;
    const onSale = specialPrice !== null && specialPrice < product.price;
    const finalPrice = onSale ? specialPrice : product.price;
    const discountPercent = onSale
      ? Math.round(((product.price - specialPrice) / product.price) * 100)
      : 0;

    return [{
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      specialPrice,
      finalPrice,
      onSale,
      discountPercent,
      category: product.category,
      image: product.imageUrls[0] ?? "/images/hero-market.jpg",
      status: product.status,
      viewCount: product.viewCount,
      createdAt: product.createdAt,
      stock: product.stock,
      emprendimiento: {
        id: emprendimiento.id,
        name: emprendimiento.name,
        logoUrl: emprendimiento.logoUrl,
        contactEmail: emprendimiento.contactEmail,
        contactPhone: emprendimiento.contactPhone,
        visibility: emprendimiento.visibility,
        status: emprendimiento.status,
        verificationStatus,
        verificationWarning:
          verificationStatus === "unverified"
            ? "Este emprendimiento no esta verificado por un conjunto. Compra bajo tu propio criterio."
            : null,
      },
      conjunto: {
        id: conjunto.id,
        name: conjunto.name,
        slug: conjunto.slug,
        location: conjunto.location,
        mapUrl: buildGoogleMapsDirectionsUrl(conjunto.latitude, conjunto.longitude, conjunto.mapUrl),
        latitude: conjunto.latitude,
        longitude: conjunto.longitude,
      },
      distanceKm:
        latitude === null || longitude === null
          ? null
          : haversineDistanceKm(latitude, longitude, conjunto.latitude, conjunto.longitude),
      rating,
      ownerIsPlus,
    }];
  });

  const filtered = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search) ||
      item.description.toLowerCase().includes(search) ||
      item.emprendimiento.name.toLowerCase().includes(search);

    const matchesCategory = category === "all" || item.category === category;
    const matchesConjunto = conjuntoSlug === "all" || item.conjunto.slug === conjuntoSlug;
    const matchesScope =
      scope !== "my_conjunto" ||
      (viewer !== null && viewer.conjuntoId !== null && item.conjunto.id === viewer.conjuntoId);
    const matchesOffer = !onSaleOnly || item.onSale;
    const matchesMin = minPrice === null || item.finalPrice >= minPrice;
    const matchesMax = maxPrice === null || item.finalPrice <= maxPrice;

    return (
      matchesSearch &&
      matchesCategory &&
      matchesConjunto &&
      matchesScope &&
      matchesOffer &&
      matchesMin &&
      matchesMax
    );
  });

  const sorted = filtered.sort((a, b) => {
    if (a.ownerIsPlus !== b.ownerIsPlus) {
      return a.ownerIsPlus ? -1 : 1;
    }

    if (sort === "price_asc") {
      return a.finalPrice - b.finalPrice;
    }

    if (sort === "price_desc") {
      return b.finalPrice - a.finalPrice;
    }

    if (sort === "popular") {
      return b.viewCount - a.viewCount;
    }

    if (sort === "rating") {
      return b.rating.average - a.rating.average;
    }

    if (sort === "nearest") {
      if (a.distanceKm === null && b.distanceKm === null) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

      if (a.distanceKm === null) {
        return 1;
      }

      if (b.distanceKm === null) {
        return -1;
      }

      return a.distanceKm - b.distanceKm;
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const categories = [
    ...new Set([...PRODUCT_CATEGORIES, ...items.map((item) => item.category)]),
  ];
  const conjuntos = [
    ...new Map(
      items.map((item) => [item.conjunto.slug, { slug: item.conjunto.slug, name: item.conjunto.name }]),
    ).values(),
  ];

  const products = sorted.slice(safeOffset, safeOffset + limit);
  const hasMore = safeOffset + limit < sorted.length;

  return NextResponse.json({
    products,
    total: sorted.length,
    hasMore,
    offset: safeOffset,
    limit,
    categories,
    conjuntos,
    viewer: viewer
      ? {
          id: viewer.id,
          role: viewer.role,
          conjuntoId: viewer.conjuntoId,
        }
      : null,
  });
}
