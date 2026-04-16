import { NextRequest, NextResponse } from "next/server";
import { canViewProduct, computeRating, getSessionUser, readDb } from "@/lib/urbis-store";
import { PRODUCT_CATEGORIES } from "@/config/product-categories";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const db = await readDb();
  const viewer = await getSessionUser(request);

  const search = request.nextUrl.searchParams.get("search")?.toLowerCase() ?? "";
  const category = request.nextUrl.searchParams.get("category") ?? "all";
  const conjuntoSlug = request.nextUrl.searchParams.get("conjunto") ?? "all";
  const sort = request.nextUrl.searchParams.get("sort") ?? "recent";
  const onSaleOnly = request.nextUrl.searchParams.get("onSale") === "1";
  const scope = request.nextUrl.searchParams.get("scope") ?? "all";
  const minPriceRaw = request.nextUrl.searchParams.get("minPrice");
  const maxPriceRaw = request.nextUrl.searchParams.get("maxPrice");
  const offsetRaw = request.nextUrl.searchParams.get("offset");
  const limitRaw = request.nextUrl.searchParams.get("limit");

  const minPrice = minPriceRaw ? Number(minPriceRaw) : null;
  const maxPrice = maxPriceRaw ? Number(maxPriceRaw) : null;
  const offset = offsetRaw ? Number(offsetRaw) : 0;
  const parsedLimit = limitRaw ? Number(limitRaw) : 12;
  const limit = Math.min(Math.max(parsedLimit, 1), 24);
  const safeOffset = Number.isNaN(offset) || offset < 0 ? 0 : offset;

  const items = db.products.flatMap((product) => {
    const emprendimiento = db.emprendimientos.find(
      (entry) => entry.id === product.emprendimientoId,
    );

    if (!emprendimiento) {
      return [];
    }

    const conjunto = db.conjuntos.find((entry) => entry.id === emprendimiento.conjuntoId);
    if (!conjunto) {
      return [];
    }

    if (!canViewProduct(product, emprendimiento, conjunto, viewer)) {
      return [];
    }

    const rating = computeRating(product.id, db);
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
      },
      conjunto: {
        id: conjunto.id,
        name: conjunto.name,
        slug: conjunto.slug,
        location: conjunto.location,
      },
      rating,
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
