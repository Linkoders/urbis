import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/urbis-store";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const follows = await prisma.emprendimientoFollowRecord.findMany({
    where: { userId: user.id },
    include: {
      emprendimiento: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          status: true,
          conjunto: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    follows: follows.map((entry) => ({
      emprendimientoId: entry.emprendimientoId,
      notifyNewProducts: entry.notifyNewProducts,
      createdAt: entry.createdAt.toISOString(),
      emprendimiento: {
        id: entry.emprendimiento.id,
        name: entry.emprendimiento.name,
        logoUrl: entry.emprendimiento.logoUrl,
        status: entry.emprendimiento.status,
        conjunto: entry.emprendimiento.conjunto,
      },
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const payload = (await request.json()) as {
    emprendimientoId?: string;
    notifyNewProducts?: boolean;
  };
  const emprendimientoId = String(payload.emprendimientoId ?? "").trim();
  const notifyNewProducts = payload.notifyNewProducts !== false;
  if (!emprendimientoId) {
    return NextResponse.json({ error: "emprendimientoId requerido." }, { status: 400 });
  }

  const emprendimiento = await prisma.emprendimientoRecord.findUnique({
    where: { id: emprendimientoId },
    select: { id: true, name: true, status: true, ownerId: true },
  });
  if (!emprendimiento || emprendimiento.status !== "approved") {
    return NextResponse.json({ error: "Emprendimiento no disponible." }, { status: 404 });
  }

  await prisma.emprendimientoFollowRecord.upsert({
    where: {
      userId_emprendimientoId: {
        userId: user.id,
        emprendimientoId,
      },
    },
    update: {
      notifyNewProducts,
      updatedAt: new Date(),
    },
    create: {
      userId: user.id,
      emprendimientoId,
      notifyNewProducts,
    },
  });

  if (notifyNewProducts) {
    await prisma.notificationPreferenceRecord.upsert({
      where: { userId: user.id },
      update: {
        wantsProductNotifications: true,
        respondedAt: new Date(),
        askedAt: new Date(),
      },
      create: {
        userId: user.id,
        wantsProductNotifications: true,
        wantsAnnouncementNotifications: true,
        wantsPersonalizedRecommendations: true,
        wantsEmail: false,
        wantsPush: false,
        askedAt: new Date(),
        respondedAt: new Date(),
      },
    });
  }

  if (emprendimiento.ownerId !== user.id) {
    await prisma.notificationRecord.create({
      data: {
        id: randomUUID(),
        userId: emprendimiento.ownerId,
        type: "new_follower",
        channel: "in_app",
        status: "queued",
        metadata: {
          message: `${user.name} empezó a seguir tu emprendimiento "${emprendimiento.name}".`,
          followerUserId: user.id,
          emprendimientoId: emprendimiento.id,
        },
        createdAt: new Date(),
      },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const payload = (await request.json()) as {
    emprendimientoId?: string;
    notifyNewProducts?: boolean;
  };
  const emprendimientoId = String(payload.emprendimientoId ?? "").trim();
  if (!emprendimientoId || typeof payload.notifyNewProducts !== "boolean") {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const updated = await prisma.emprendimientoFollowRecord.updateMany({
    where: {
      userId: user.id,
      emprendimientoId,
    },
    data: {
      notifyNewProducts: payload.notifyNewProducts,
      updatedAt: new Date(),
    },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Seguimiento no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const payload = (await request.json()) as { emprendimientoId?: string };
  const emprendimientoId = String(payload.emprendimientoId ?? "").trim();
  if (!emprendimientoId) {
    return NextResponse.json({ error: "emprendimientoId requerido." }, { status: 400 });
  }

  const deleted = await prisma.emprendimientoFollowRecord.deleteMany({
    where: {
      userId: user.id,
      emprendimientoId,
    },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Seguimiento no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

