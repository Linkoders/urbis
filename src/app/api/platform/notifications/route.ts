import { NextRequest, NextResponse } from "next/server";
import { createId, getSessionUser, readDb, writeDb } from "@/lib/urbis-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
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
