import { NextResponse } from "next/server";
import {
  createId,
  createPasswordHash,
  pushInAppNotification,
  readDb,
  writeDb,
} from "@/lib/urbis-store";
import { prisma } from "@/lib/prisma";
import { isBlobStorageUrl } from "@/lib/blob-utils";
import { parseGoogleMapsLocation } from "@/lib/google-maps";
import { sendEmailNotification } from "@/lib/email-service";
import type { UserRole } from "@/lib/urbis-types";

export const runtime = "nodejs";

function createVerificationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isValidAvatarUrl(value: string): boolean {
  if (!value) return false;

  if (value.startsWith("/uploads/")) {
    return true;
  }
  if (value.startsWith("/api/blob?url=")) {
    return true;
  }

  return isBlobStorageUrl(value);
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      name?: string;
      email?: string;
      phone?: string;
      password?: string;
      conjuntoSlug?: string;
      avatarUrl?: string;
      acceptedTerms?: boolean;
      role?: UserRole;
      requestedConjuntoName?: string;
      requestedConjuntoLocation?: string;
      requestedConjuntoMapUrl?: string;
      requestedConjuntoDescription?: string;
      requestedConjuntoLogoUrl?: string;
      isEntrepreneur?: boolean;
      isIndependent?: boolean;
    };

    const name = payload.name?.trim();
    const email = payload.email?.trim().toLowerCase();
    const phone = String(payload.phone ?? "").trim();
    const password = payload.password?.trim();
    const role = payload.role === "admin_conjunto" ? "admin_conjunto" : "resident";
    const conjuntoSlug = payload.conjuntoSlug?.trim().toLowerCase() || null;
    const avatarUrl = String(payload.avatarUrl ?? "").trim();
    const acceptedTerms = payload.acceptedTerms === true;
    const requestedConjuntoName = String(payload.requestedConjuntoName ?? "").trim();
    const requestedConjuntoLocation = String(payload.requestedConjuntoLocation ?? "").trim();
    const requestedConjuntoMapUrl = String(payload.requestedConjuntoMapUrl ?? "").trim();
    const requestedConjuntoDescription = String(payload.requestedConjuntoDescription ?? "").trim();
    const requestedConjuntoLogoUrl = String(payload.requestedConjuntoLogoUrl ?? "").trim();
    const isEntrepreneur = payload.isEntrepreneur === true || payload.isIndependent === true;
    const isIndependentResident = role === "resident" && !conjuntoSlug;

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Nombre, email y contraseña son obligatorios." }, { status: 400 });
    }

    if (!phone) {
      return NextResponse.json({ error: "El número de teléfono es obligatorio." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
    }

    if (!isValidAvatarUrl(avatarUrl)) {
      return NextResponse.json(
        { error: "Debes subir una foto de perfil válida (local o Vercel Blob)." },
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

    if (
      role === "admin_conjunto" &&
      (!requestedConjuntoName || !requestedConjuntoLocation || !requestedConjuntoMapUrl)
    ) {
      return NextResponse.json(
        { error: "Para crear cuenta como administrador debes enviar nombre, ubicación y enlace de Google Maps del conjunto." },
        { status: 400 },
      );
    }

    const parsedMapsLocation =
      role === "admin_conjunto"
        ? parseGoogleMapsLocation(requestedConjuntoMapUrl)
        : null;

    if (role === "admin_conjunto" && !parsedMapsLocation) {
      return NextResponse.json(
        { error: "El enlace de Google Maps del conjunto no es válido." },
        { status: 400 },
      );
    }

    const userId = createId();
    const createdAt = new Date().toISOString();
    const emailVerificationCode = createVerificationCode();

    db.users.push({
      id: userId,
      name,
      email,
      phone,
      passwordHash: createPasswordHash(password),
      role,
      conjuntoId: role === "resident" ? conjunto?.id ?? null : null,
      avatarUrl,
      status: "active",
      subscriptionPlan: "basic",
      subscriptionStatus: "inactive",
      subscriptionPaymentMethod: null,
      subscriptionUpdatedAt: createdAt,
      emailVerifiedAt: null,
      emailVerificationCode,
      acceptedTermsAt: createdAt,
      createdAt,
    });

    if (role === "admin_conjunto") {
      db.conjuntoRequests.push({
        id: createId(),
        nameRequested: requestedConjuntoName,
        location: requestedConjuntoLocation,
        mapUrl: parsedMapsLocation?.mapUrl ?? null,
        latitude: parsedMapsLocation?.latitude ?? null,
        longitude: parsedMapsLocation?.longitude ?? null,
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
        isIndependentResident
          ? "Bienvenido a URBIS. Puedes publicar como emprendedor no verificado mientras te vinculas a un conjunto."
          : "Bienvenido a URBIS. Ya puedes explorar y publicar en tu conjunto.",
      );
    }

    await writeDb(db);

    const emailResult = await sendEmailNotification({
      to: email,
      subject: "Verifica tu correo en URBIS",
      html: `<p>Hola ${name},</p>
<p>Tu código de verificación es:</p>
<p style="font-size:24px;font-weight:700;letter-spacing:3px">${emailVerificationCode}</p>
<p>Ingresa este código en URBIS para activar tu cuenta.</p>`,
      text: `Hola ${name}. Tu código de verificación de URBIS es ${emailVerificationCode}.`,
    });

    await prisma.notificationPreferenceRecord.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        wantsProductNotifications: false,
        wantsAnnouncementNotifications: true,
        wantsPersonalizedRecommendations: true,
        wantsEmail: false,
        wantsPush: false,
      },
    });

    if (isEntrepreneur || role === "admin_conjunto" || isIndependentResident) {
      await prisma.entrepreneurProfileRecord.upsert({
        where: { userId },
        update: {
          isIndependent: role === "resident" && !conjunto,
          defaultConjuntoId: conjunto?.id ?? null,
        },
        create: {
          userId,
          isIndependent: role === "resident" && !conjunto,
          defaultConjuntoId: conjunto?.id ?? null,
          approvalStatus: "active",
        },
      });
    }

    const response = NextResponse.json({
      ok: true,
      message: emailResult.ok
        ? "Cuenta creada. Revisa tu correo e ingresa el código de verificación."
        : "Cuenta creada. No se pudo enviar correo, pero puedes verificar con el código de respaldo.",
      requiresEmailVerification: true,
      verificationFallbackCode:
        !emailResult.ok && process.env.NODE_ENV !== "production"
          ? emailVerificationCode
          : undefined,
      onboardingMessage:
        role === "admin_conjunto"
          ? "Cuenta creada. Tu solicitud de conjunto fue enviada."
          : "Cuenta creada correctamente.",
      user: {
        id: userId,
        name,
        email,
        phone,
        role,
        conjuntoId: role === "resident" ? conjunto?.id ?? null : null,
        avatarUrl,
        subscriptionPlan: "basic",
        subscriptionStatus: "inactive",
        subscriptionPaymentMethod: null,
        subscriptionUpdatedAt: createdAt,
      },
    });

    return response;
  } catch {
    return NextResponse.json({ error: "No se pudo crear la cuenta." }, { status: 500 });
  }
}
