import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/urbis-store";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const [recentVisits, interests, follows, ownedEmprendimientos] = await Promise.all([
    prisma.userProductVisitRecord.findMany({
      where: { userId: user.id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            category: true,
            imageUrls: true,
          },
        },
        emprendimiento: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          },
        },
      },
      orderBy: { visitedAt: "desc" },
      take: 25,
    }),
    prisma.productInterestRecord.findMany({
      where: { userId: user.id },
      orderBy: [{ weight: "desc" }, { lastInteractedAt: "desc" }],
      take: 40,
    }),
    prisma.emprendimientoFollowRecord.findMany({
      where: { userId: user.id },
      include: {
        emprendimiento: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.emprendimientoRecord.findMany({
      where: { ownerId: user.id },
      select: {
        id: true,
        name: true,
        logoUrl: true,
      },
    }),
  ]);

  const categoryAffinity = new Map<string, number>();
  for (const entry of interests) {
    if (entry.category) {
      categoryAffinity.set(
        entry.category,
        (categoryAffinity.get(entry.category) ?? 0) + entry.weight,
      );
    }
  }

  const topCategories = Array.from(categoryAffinity.entries())
    .map(([category, score]) => ({ category, score: Number(score.toFixed(2)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const emprendimientoIds = ownedEmprendimientos.map((entry) => entry.id);
  const [ownedProducts, reviewsByProduct, visitsByEmprendimiento] =
    emprendimientoIds.length === 0
      ? [[], [], []]
      : await Promise.all([
          prisma.productRecord.findMany({
            where: { emprendimientoId: { in: emprendimientoIds } },
            select: { id: true, emprendimientoId: true, viewCount: true },
          }),
          prisma.reviewRecord.groupBy({
            by: ["productId"],
            where: {
              productId: {
                in: (
                  await prisma.productRecord.findMany({
                    where: { emprendimientoId: { in: emprendimientoIds } },
                    select: { id: true },
                  })
                ).map((entry) => entry.id),
              },
            },
            _count: { _all: true },
          }),
          prisma.emprendimientoVisitRecord.groupBy({
            by: ["emprendimientoId"],
            where: { emprendimientoId: { in: emprendimientoIds } },
            _count: { _all: true },
          }),
        ]);

  const reviewsByProductId = new Map(
    reviewsByProduct.map((entry) => [entry.productId, entry._count._all]),
  );
  const visitsByEmprendimientoId = new Map(
    visitsByEmprendimiento.map((entry) => [entry.emprendimientoId, entry._count._all]),
  );

  const entrepreneurInsights = ownedEmprendimientos.map((emprendimiento) => {
    const products = ownedProducts.filter(
      (product) => product.emprendimientoId === emprendimiento.id,
    );
    const totalProductViews = products.reduce((acc, product) => acc + product.viewCount, 0);
    const totalReviews = products.reduce(
      (acc, product) => acc + (reviewsByProductId.get(product.id) ?? 0),
      0,
    );
    return {
      emprendimientoId: emprendimiento.id,
      name: emprendimiento.name,
      logoUrl: emprendimiento.logoUrl,
      visits: visitsByEmprendimientoId.get(emprendimiento.id) ?? 0,
      totalProductViews,
      totalReviews,
      products: products.length,
    };
  });

  return NextResponse.json({
    recentVisits: recentVisits.map((entry) => ({
      visitedAt: entry.visitedAt.toISOString(),
      product: {
        id: entry.product.id,
        name: entry.product.name,
        slug: entry.product.slug,
        category: entry.product.category,
        image:
          Array.isArray(entry.product.imageUrls) &&
          entry.product.imageUrls.length > 0 &&
          typeof entry.product.imageUrls[0] === "string"
            ? entry.product.imageUrls[0]
            : "/images/hero-market.jpg",
      },
      emprendimiento: entry.emprendimiento,
    })),
    topCategories,
    follows: follows.map((entry) => ({
      emprendimientoId: entry.emprendimientoId,
      notifyNewProducts: entry.notifyNewProducts,
      createdAt: entry.createdAt.toISOString(),
      emprendimiento: entry.emprendimiento,
    })),
    entrepreneurInsights,
  });
}

