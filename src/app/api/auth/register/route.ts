import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  createId,
  createPasswordHash,
  pushInAppNotification,
  readDb,
  writeDb,
} from "@/lib/urbis-store";
import type { UserRole } from "@/lib/urbis-types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      name?: string;
      email?: string;
      password?: string;
      conjuntoSlug?: string;
      avatarUrl?: string;
      acceptedTerms?: boolean;
      role?: UserRole;
      requestedConjuntoName?: string;
      requestedConjuntoLocation?: string;
      requestedConjuntoDescription?: string;
      requestedConjuntoLogoUrl?: string;
    };

    const name = payload.name?.trim();
    const email = payload.email?.trim().toLowerCase();
    const password = payload.password?.trim();
    const role = payload.role === "admin_conjunto" ? "admin_conjunto" : "resident";
    const conjuntoSlug = payload.conjuntoSlug?.trim().toLowerCase() || null;
    const avatarUrl = String(payload.avatarUrl ?? "").trim();
    const acceptedTerms = payload.acceptedTerms === true;
    const requestedConjuntoName = String(payload.requestedConjuntoName ?? "").trim();
    const requestedConjuntoLocation = String(payload.requestedConjuntoLocation ?? "").trim();
    const requestedConjuntoDescription = String(payload.requestedConjuntoDescription ?? "").trim();
    const requestedConjuntoLogoUrl = String(payload.requestedConjuntoLogoUrl ?? "").trim();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Nombre, email y contraseña son obligatorios." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
    }

    if (!avatarUrl || !avatarUrl.startsWith("/uploads/")) {
      return NextResponse.json(
        { error: "Debes subir una foto de perfil (rostro) válida." },
        { status: 400 },
      );
    }

    if (!acceptedTerms) {
      return NextResponse.json(
        { error: "Debes aceptar los términos y condiciones para continuar." },
        { status: 400 },
      );
    }

    const db = await readDb();
    const exists = db.users.some((user) => user.email === email);
    if (exists) {
      return NextResponse.json({ error: "Ese email ya está registrado." }, { status: 409 });
    }

    const conjunto = db.conjuntos.find((entry) => entry.slug === conjuntoSlug && entry.status === "approved");

    if (role === "resident" && !conjunto) {
      return NextResponse.json(
        { error: "Debes seleccionar un conjunto válido para registrarte." },
        { status: 400 },
      );
    }

    if (role === "admin_conjunto" && (!requestedConjuntoName || !requestedConjuntoLocation)) {
      return NextResponse.json(
        { error: "Para crear cuenta como administrador debes enviar datos del conjunto." },
        { status: 400 },
      );
    }

    const userId = createId();
    const createdAt = new Date().toISOString();

    db.users.push({
      id: userId,
      name,
      email,
      passwordHash: createPasswordHash(password),
      role,
      conjuntoId: role === "resident" ? conjunto?.id ?? null : null,
      avatarUrl,
      status: "active",
      acceptedTermsAt: createdAt,
      createdAt,
    });

    if (role === "admin_conjunto") {
      db.conjuntoRequests.push({
        id: createId(),
        nameRequested: requestedConjuntoName,
        location: requestedConjuntoLocation,
        description: requestedConjuntoDescription,
        logoUrl: requestedConjuntoLogoUrl || null,
        contactEmail: email,
        requestedByUserId: userId,
        status: "pending",
        reviewedBy: null,
        createdAt,
        updatedAt: createdAt,
      });

      const superadmins = db.users.filter((entry) => entry.role === "superadmin");
      for (const superadmin of superadmins) {
        pushInAppNotification(
          db,
          superadmin.id,
          "new_conjunto_request",
          `Nueva solicitud de conjunto: ${requestedConjuntoName}`,
          {
            requesterEmail: email,
          },
        );
      }

      pushInAppNotification(
        db,
        userId,
        "conjunto_request_created",
        "Tu solicitud de conjunto fue enviada y está pendiente de revisión.",
      );
    } else {
      pushInAppNotification(
        db,
        userId,
        "welcome",
        "Bienvenido a URBIS. Ya puedes explorar y publicar en tu conjunto.",
      );
    }

    await writeDb(db);

    const response = NextResponse.json({
      ok: true,
      message:
        role === "admin_conjunto"
          ? "Cuenta creada. Tu solicitud de conjunto fue enviada."
          : "Cuenta creada correctamente.",
      user: {
        id: userId,
        name,
        email,
        role,
        conjuntoId: role === "resident" ? conjunto?.id ?? null : null,
        avatarUrl,
      },
    });

    response.cookies.set(SESSION_COOKIE, userId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "No se pudo crear la cuenta." }, { status: 500 });
  }
}
