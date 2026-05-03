import { NextResponse } from "next/server";
import { SESSION_COOKIE, readDb, verifyPassword } from "@/lib/urbis-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      email?: string;
      password?: string;
    };

    const email = payload.email?.trim().toLowerCase();
    const password = payload.password?.trim();

    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña son obligatorios." }, { status: 400 });
    }

    const db = await readDb();
    const user = db.users.find((entry) => entry.email === email);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Credenciales inválidas." }, { status: 401 });
    }

    if (user.status !== "active") {
      return NextResponse.json({ error: "Tu cuenta no está activa." }, { status: 403 });
    }

    if (!user.emailVerifiedAt) {
      return NextResponse.json(
        { error: "Debes verificar tu correo electrónico antes de iniciar sesión." },
        { status: 403 },
      );
    }

    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        conjuntoId: user.conjuntoId,
        avatarUrl: user.avatarUrl,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionPaymentMethod: user.subscriptionPaymentMethod,
        subscriptionUpdatedAt: user.subscriptionUpdatedAt,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    });

    response.cookies.set(SESSION_COOKIE, user.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "No se pudo iniciar sesión." }, { status: 500 });
  }
}
