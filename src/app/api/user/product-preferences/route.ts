import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { canViewProduct, getSessionUser, readDb } from "@/lib/urbis-store";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const productId = String(request.nextUrl.searchParams.get("productId") ?? "").trim();
  if (!productId) {
    return NextResponse.json({ error: "productId requerido." }, { status: 400 });
  }

  const favorite = await prisma.userFavoriteProductRecord.findUnique({
    where: {
      userId_productId: {
        userId: user.id,
        productId,
      },
    },
  });

  const recentInterest = await prisma.productInterestRecord.findFirst({
    where: {
      userId: user.id,
      productId,
      source: "manual_interest",
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    favorite: Boolean(favorite),
    interested: Boolean(recentInterest),
  });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const payload = (await request.json()) as {
    productId?: string;
    action?: "favorite" | "unfavorite" | "interest";
  };
  const productId = String(payload.productId ?? "").trim();
  const action = payload.action;
  if (!productId || !action) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const db = await readDb();
  const product = db.products.find((entry) => entry.id === productId);
  if (!product) {
    return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });
  }

  const emprendimiento = db.emprendimientos.find((entry) => entry.id === product.emprendimientoId);
  const conjunto = emprendimiento
    ? db.conjuntos.find((entry) => entry.id === emprendimiento.conjuntoId)
    : null;

  if (!emprendimiento || !conjunto || !canViewProduct(product, emprendimiento, conjunto, user)) {
    return NextResponse.json({ error: "No autorizado para este producto." }, { status: 403 });
  }

  if (action === "favorite") {
    await prisma.userFavoriteProductRecord.upsert({
      where: {
        userId_productId: {
          userId: user.id,
          productId,
        },
      },
      update: {},
      create: {
        userId: user.id,
        productId,
      },
    });

    if (product.ownerId !== user.id) {
      await prisma.notificationRecord.create({
        data: {
          id: randomUUID(),
          userId: product.ownerId,
          type: "new_favorite",
          channel: "in_app",
          status: "queued",
          metadata: {
            message: `${user.name} agregó tu producto "${product.name}" a favoritos.`,
            productId: product.id,
            productSlug: product.slug,
          },
          createdAt: new Date(),
        },
      });
    }

    return NextResponse.json({ ok: true, favorite: true });
  }

  if (action === "unfavorite") {
    await prisma.userFavoriteProductRecord.deleteMany({
      where: {
        userId: user.id,
        productId,
      },
    });
    return NextResponse.json({ ok: true, favorite: false });
  }

  await prisma.productInterestRecord.create({
    data: {
      userId: user.id,
      productId,
      category: product.category,
      source: "manual_interest",
      weight: 2,
      lastInteractedAt: new Date(),
    },
  });

  if (product.ownerId !== user.id) {
    await prisma.notificationRecord.create({
      data: {
        id: randomUUID(),
        userId: product.ownerId,
        type: "manual_interest",
        channel: "in_app",
        status: "queued",
        metadata: {
          message: `${user.name} marcó interés en "${product.name}".`,
          productId: product.id,
          productSlug: product.slug,
        },
        createdAt: new Date(),
      },
    });
  }

  return NextResponse.json({ ok: true, interested: true });
}
