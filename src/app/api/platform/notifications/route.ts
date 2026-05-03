import { NextRequest, NextResponse } from "next/server";
import { createId, getSessionUser, readDb, writeDb } from "@/lib/urbis-store";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function shouldUseDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function toStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      typeof entry === "string" ? entry : String(entry ?? ""),
    ]),
  );
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (shouldUseDatabase()) {
    const notifications = await prisma.notificationRecord.findMany({
      where: {
        userId: user.id,
        channel: "in_app",
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    });

    const unreadCount = notifications.filter((entry) => entry.status === "queued").length;

    return NextResponse.json({
      notifications: notifications.map((entry) => ({
        id: entry.id,
        type: entry.type,
        status: entry.status,
        message: toStringRecord(entry.metadata).message ?? "Nueva notificacion",
        createdAt: entry.createdAt.toISOString(),
        metadata: toStringRecord(entry.metadata),
      })),
      unreadCount,
    });
  }

  const db = await readDb();
  const notifications = db.notifications
    .filter((entry) => entry.userId === user.id && entry.channel === "in_app")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 12);

  const unreadCount = notifications.filter((entry) => entry.status === "queued").length;

  return NextResponse.json({
    notifications: notifications.map((entry) => ({
      id: entry.id,
      type: entry.type,
      status: entry.status,
      message: entry.metadata.message ?? "Nueva notificacion",
      createdAt: entry.createdAt,
      metadata: entry.metadata,
    })),
    unreadCount,
  });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = (await request.json()) as { action?: string; notificationId?: string };
  const action = body.action ?? "";

  if (shouldUseDatabase()) {
    if (action === "mark_all_read") {
      await prisma.notificationRecord.updateMany({
        where: {
          userId: user.id,
          channel: "in_app",
          status: "queued",
        },
        data: { status: "sent" },
      });

      return NextResponse.json({ ok: true });
    }

    if (action === "mark_read") {
      const notificationId = String(body.notificationId ?? "").trim();
      if (!notificationId) {
        return NextResponse.json({ error: "notificationId requerido." }, { status: 400 });
      }

      const result = await prisma.notificationRecord.updateMany({
        where: {
          id: notificationId,
          userId: user.id,
          channel: "in_app",
        },
        data: { status: "sent" },
      });
      if (result.count === 0) {
        return NextResponse.json({ error: "Notificacion no encontrada." }, { status: 404 });
      }

      return NextResponse.json({ ok: true });
    }

    if (action === "delete_one") {
      const notificationId = String(body.notificationId ?? "").trim();
      if (!notificationId) {
        return NextResponse.json({ error: "notificationId requerido." }, { status: 400 });
      }

      const result = await prisma.notificationRecord.deleteMany({
        where: {
          id: notificationId,
          userId: user.id,
          channel: "in_app",
        },
      });
      if (result.count === 0) {
        return NextResponse.json({ error: "Notificacion no encontrada." }, { status: 404 });
      }

      return NextResponse.json({ ok: true });
    }

    if (action === "delete_read") {
      await prisma.notificationRecord.deleteMany({
        where: {
          userId: user.id,
          channel: "in_app",
          NOT: { status: "queued" },
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "seed_demo") {
      await prisma.notificationRecord.create({
        data: {
          id: createId(),
          userId: user.id,
          type: "demo",
          channel: "in_app",
          status: "queued",
          metadata: {
            message: "Esta es una notificacion de prueba.",
          },
          createdAt: new Date(),
        },
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Accion no soportada." }, { status: 400 });
  }

  const db = await readDb();

  if (action === "mark_all_read") {
    db.notifications = db.notifications.map((entry) => {
      if (entry.userId !== user.id || entry.channel !== "in_app") {
        return entry;
      }

      if (entry.status === "queued") {
        return {
          ...entry,
          status: "sent",
        };
      }

      return entry;
    });

    await writeDb(db);
    return NextResponse.json({ ok: true });
  }

  if (action === "mark_read") {
    const notificationId = String(body.notificationId ?? "").trim();
    if (!notificationId) {
      return NextResponse.json({ error: "notificationId requerido." }, { status: 400 });
    }

    const target = db.notifications.find(
      (entry) => entry.id === notificationId && entry.userId === user.id,
    );
    if (!target) {
      return NextResponse.json({ error: "Notificacion no encontrada." }, { status: 404 });
    }

    target.status = "sent";
    await writeDb(db);
    return NextResponse.json({ ok: true });
  }

  if (action === "delete_one") {
    const notificationId = String(body.notificationId ?? "").trim();
    if (!notificationId) {
      return NextResponse.json({ error: "notificationId requerido." }, { status: 400 });
    }

    const existing = db.notifications.find(
      (entry) => entry.id === notificationId && entry.userId === user.id,
    );
    if (!existing) {
      return NextResponse.json({ error: "Notificacion no encontrada." }, { status: 404 });
    }

    db.notifications = db.notifications.filter((entry) => entry.id !== notificationId);
    await writeDb(db);
    return NextResponse.json({ ok: true });
  }

  if (action === "delete_read") {
    db.notifications = db.notifications.filter(
      (entry) =>
        entry.userId !== user.id ||
        entry.channel !== "in_app" ||
        entry.status === "queued",
    );
    await writeDb(db);
    return NextResponse.json({ ok: true });
  }

  if (action === "seed_demo") {
    db.notifications.unshift({
      id: createId(),
      userId: user.id,
      type: "demo",
      channel: "in_app",
      status: "queued",
      metadata: {
        message: "Esta es una notificacion de prueba.",
      },
      createdAt: new Date().toISOString(),
    });

    await writeDb(db);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Accion no soportada." }, { status: 400 });
}
