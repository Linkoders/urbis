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

  const recentInterest = await prisma.productInterestRecord.findFirst({
    where: {
      userId: user.id,
      productId,
      source: "manual_interest",
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
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
    action?: "interest";
  };
  const productId = String(payload.productId ?? "").trim();
  const action = payload.action;
  if (!productId || action !== "interest") {
    return NextResponse.json({ error: "Datos invalidos." }, { status: 400 });
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

  await prisma.emprendimientoFollowRecord.upsert({
    where: {
      userId_emprendimientoId: {
        userId: user.id,
        emprendimientoId: emprendimiento.id,
      },
    },
    update: {
      notifyNewProducts: true,
      updatedAt: new Date(),
    },
    create: {
      userId: user.id,
      emprendimientoId: emprendimiento.id,
      notifyNewProducts: true,
    },
  });

  await prisma.notificationPreferenceRecord.upsert({
    where: { userId: user.id },
    update: {
      wantsProductNotifications: true,
      wantsEmail: true,
      respondedAt: new Date(),
    },
    create: {
      userId: user.id,
      wantsProductNotifications: true,
      wantsAnnouncementNotifications: true,
      wantsPersonalizedRecommendations: true,
      wantsEmail: true,
      wantsPush: false,
      askedAt: new Date(),
      respondedAt: new Date(),
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
          message: `${user.name} marco interes en "${product.name}" y activo alertas de nuevos productos.`,
          productId: product.id,
          productSlug: product.slug,
          emprendimientoId: emprendimiento.id,
        },
        createdAt: new Date(),
      },
    });
  }

  return NextResponse.json({ ok: true, interested: true, subscribed: true });
}
