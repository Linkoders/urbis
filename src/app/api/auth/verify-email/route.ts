import { NextResponse } from "next/server";
import { SESSION_COOKIE, readDb, writeDb } from "@/lib/urbis-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      email?: string;
      code?: string;
    };

    const email = String(payload.email ?? "").trim().toLowerCase();
    const code = String(payload.code ?? "").trim();

    if (!email || !code) {
      return NextResponse.json({ error: "Email y código son obligatorios." }, { status: 400 });
    }

    const db = await readDb();
    const user = db.users.find((entry) => entry.email === email);
    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    if (user.emailVerifiedAt) {
      const alreadyVerified = NextResponse.json({
        ok: true,
        message: "Tu correo ya estaba verificado.",
      });
      alreadyVerified.cookies.set(SESSION_COOKIE, user.id, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
      return alreadyVerified;
    }

    if (!user.emailVerificationCode || user.emailVerificationCode !== code) {
      return NextResponse.json({ error: "Código de verificación inválido." }, { status: 400 });
    }

    user.emailVerifiedAt = new Date().toISOString();
    user.emailVerificationCode = null;
    await writeDb(db);

    const response = NextResponse.json({
      ok: true,
      message: "Correo verificado correctamente.",
    });
    response.cookies.set(SESSION_COOKIE, user.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "No se pudo verificar el correo." }, { status: 500 });
  }
}
