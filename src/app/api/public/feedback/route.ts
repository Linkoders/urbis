import { NextResponse } from "next/server";
import { createId, pushInAppNotification, readDb, writeDb } from "@/lib/urbis-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      name?: string;
      email?: string;
      message?: string;
      category?: "mejora" | "apoyo";
    };

    const name = String(payload.name ?? "").trim();
    const email = String(payload.email ?? "").trim().toLowerCase();
    const message = String(payload.message ?? "").trim();
    const category = payload.category === "apoyo" ? "apoyo" : "mejora";

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Nombre, email y mensaje son obligatorios." },
        { status: 400 },
      );
    }

    if (message.length < 10) {
      return NextResponse.json(
        { error: "Tu mensaje es muy corto. Cuéntanos un poco más." },
        { status: 400 },
      );
    }

    if (message.length > 1200) {
      return NextResponse.json(
        { error: "Tu mensaje es muy largo. Máximo 1200 caracteres." },
        { status: 400 },
      );
    }

    const db = await readDb();
    const createdAt = new Date().toISOString();

    db.feedbackMessages.unshift({
      id: createId(),
      name,
      email,
      message,
      category,
      status: "new",
      createdAt,
    });

    const superadmins = db.users.filter((user) => user.role === "superadmin");
    for (const superadmin of superadmins) {
      pushInAppNotification(
        db,
        superadmin.id,
        "feedback_message",
        category === "apoyo"
          ? `Nuevo mensaje de apoyo de ${name}`
          : `Nueva sugerencia de mejora de ${name}`,
        {
          email,
        },
      );
    }

    await writeDb(db);

    return NextResponse.json({
      ok: true,
      message:
        category === "apoyo"
          ? "Gracias por ofrecer tu apoyo. Te contactaremos pronto."
          : "Gracias por tu sugerencia. La revisaremos para mejorar URBIS.",
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudo enviar tu mensaje en este momento." },
      { status: 500 },
    );
  }
}

