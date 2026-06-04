import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isBlobStorageUrl } from "@/lib/blob-utils";
import { getSessionUser, pushInAppNotification, readDb, writeDb } from "@/lib/urbis-store";
import { PLUS_BANK_TRANSFER_METHOD, PLUS_PRICE_USD } from "@/config/subscription";

export const runtime = "nodejs";

type SubscriptionPlan = "basic" | "plus";

const PAYMENT_PROOF_PREFIX = `${PLUS_BANK_TRANSFER_METHOD}|proof:`;

function shouldUseDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function paymentOptions() {
  return {
    pichinchaAccountNumber: process.env.NEXT_PUBLIC_PICHINCHA_ACCOUNT_NUMBER?.trim() ?? "",
    pichinchaAccountType:
      process.env.NEXT_PUBLIC_PICHINCHA_ACCOUNT_TYPE?.trim() ?? "Cuenta de ahorros",
    pichinchaAccountHolder:
      process.env.NEXT_PUBLIC_PICHINCHA_ACCOUNT_HOLDER?.trim() ?? "URBIS / Linekoders",
    supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ?? "",
    supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() ?? "",
    supportPhoneAlt: process.env.NEXT_PUBLIC_SUPPORT_PHONE_ALT?.trim() ?? "",
    plusPriceUsd: PLUS_PRICE_USD,
  };
}

function isValidPaymentProofUrl(value: string): boolean {
  if (!value) return false;

  if (value.startsWith("/uploads/")) {
    return true;
  }
  if (value.startsWith("/api/blob?url=")) {
    return true;
  }

  return isBlobStorageUrl(value);
}

function parsePaymentData(rawValue: string | null): {
  method: string | null;
  proofUrl: string | null;
} {
  if (!rawValue) {
    return { method: null, proofUrl: null };
  }

  if (rawValue.startsWith(PAYMENT_PROOF_PREFIX)) {
    return {
      method: PLUS_BANK_TRANSFER_METHOD,
      proofUrl: rawValue.slice(PAYMENT_PROOF_PREFIX.length) || null,
    };
  }

  if (rawValue === PLUS_BANK_TRANSFER_METHOD) {
    return { method: PLUS_BANK_TRANSFER_METHOD, proofUrl: null };
  }

  return { method: rawValue, proofUrl: null };
}

function buildPaymentStorageValue(proofUrl: string | null): string {
  if (!proofUrl) {
    return PLUS_BANK_TRANSFER_METHOD;
  }
  return `${PAYMENT_PROOF_PREFIX}${proofUrl}`;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (shouldUseDatabase()) {
    const profile = await prisma.userRecord.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionPaymentMethod: true,
        subscriptionUpdatedAt: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    const paymentData = parsePaymentData(profile.subscriptionPaymentMethod);

    return NextResponse.json({
      profile: {
        ...profile,
        subscriptionPlan: profile.subscriptionPlan === "plus" ? "plus" : "basic",
        subscriptionStatus:
          profile.subscriptionStatus === "active"
            ? "active"
            : profile.subscriptionStatus === "pending"
              ? "pending"
              : "inactive",
        subscriptionPaymentMethod: paymentData.method,
        subscriptionPaymentProofUrl: paymentData.proofUrl,
        subscriptionUpdatedAt: profile.subscriptionUpdatedAt?.toISOString() ?? null,
      },
      paymentOptions: paymentOptions(),
    });
  }

  const db = await readDb();
  const localUser = db.users.find((entry) => entry.id === user.id);
  if (!localUser) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  const paymentData = parsePaymentData(localUser.subscriptionPaymentMethod);

  return NextResponse.json({
    profile: {
      id: localUser.id,
      name: localUser.name,
      email: localUser.email,
      phone: localUser.phone,
      avatarUrl: localUser.avatarUrl,
      role: localUser.role,
      subscriptionPlan: localUser.subscriptionPlan,
      subscriptionStatus: localUser.subscriptionStatus,
      subscriptionPaymentMethod: paymentData.method,
      subscriptionPaymentProofUrl: paymentData.proofUrl,
      subscriptionUpdatedAt: localUser.subscriptionUpdatedAt,
    },
    paymentOptions: paymentOptions(),
  });
}

export async function PUT(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const payload = (await request.json()) as {
    name?: string;
    phone?: string;
    subscriptionPlan?: SubscriptionPlan;
    paymentProofUrl?: string;
  };

  const name = String(payload.name ?? "").trim();
  const phoneRaw = String(payload.phone ?? "").trim();
  const phone = phoneRaw.length > 0 ? phoneRaw : null;
  const targetPlan = payload.subscriptionPlan === "plus" ? "plus" : "basic";
  const incomingPaymentProofUrl = String(payload.paymentProofUrl ?? "").trim() || null;

  if (!name) {
    return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
  }

  const updatedAt = new Date();

  if (shouldUseDatabase()) {
    const currentUser = await prisma.userRecord.findUnique({
      where: { id: user.id },
      select: {
        subscriptionPaymentMethod: true,
      },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    const currentPayment = parsePaymentData(currentUser.subscriptionPaymentMethod);
    const paymentProofUrl = incomingPaymentProofUrl || currentPayment.proofUrl;

    if (targetPlan === "plus") {
      if (!paymentProofUrl || !isValidPaymentProofUrl(paymentProofUrl)) {
        return NextResponse.json(
          {
            error:
              "Debes adjuntar una foto válida del comprobante de depósito para activar Plus.",
          },
          { status: 400 },
        );
      }
    }

    const nextStatus = targetPlan === "plus" ? "pending" : "inactive";
    const updatedUser = await prisma.userRecord.update({
      where: { id: user.id },
      data: {
        name,
        phone,
        subscriptionPlan: targetPlan,
        subscriptionStatus: nextStatus,
        subscriptionPaymentMethod:
          targetPlan === "plus" ? buildPaymentStorageValue(paymentProofUrl) : null,
        subscriptionUpdatedAt: updatedAt,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionPaymentMethod: true,
        subscriptionUpdatedAt: true,
      },
    });

    if (targetPlan === "plus") {
      const superadmins = await prisma.userRecord.findMany({
        where: {
          role: "superadmin",
          status: "active",
        },
        select: { id: true },
      });

      if (superadmins.length > 0) {
        await prisma.notificationRecord.createMany({
          data: superadmins.map((entry) => ({
            id: randomUUID(),
            userId: entry.id,
            type: "subscription_upgrade_request",
            channel: "in_app",
            status: "queued",
            metadata: {
              message: `${updatedUser.name} solicitó cambio a plan Plus por depósito en Pichincha (USD ${PLUS_PRICE_USD.toFixed(2)}).`,
              requesterId: updatedUser.id,
              paymentMethod: PLUS_BANK_TRANSFER_METHOD,
              paymentProofUrl: paymentProofUrl ?? "",
              amountUsd: String(PLUS_PRICE_USD),
            },
            createdAt: new Date(),
          })),
        });
      }
    }

    const paymentData = parsePaymentData(updatedUser.subscriptionPaymentMethod);

    return NextResponse.json({
      ok: true,
      message:
        targetPlan === "plus"
          ? `Solicitud Plus guardada por USD ${PLUS_PRICE_USD.toFixed(2)}. Tu comprobante fue enviado y está pendiente de validación.`
          : "Perfil actualizado.",
      profile: {
        ...updatedUser,
        subscriptionPlan: updatedUser.subscriptionPlan === "plus" ? "plus" : "basic",
        subscriptionStatus:
          updatedUser.subscriptionStatus === "active"
            ? "active"
            : updatedUser.subscriptionStatus === "pending"
              ? "pending"
              : "inactive",
        subscriptionPaymentMethod: paymentData.method,
        subscriptionPaymentProofUrl: paymentData.proofUrl,
        subscriptionUpdatedAt: updatedUser.subscriptionUpdatedAt?.toISOString() ?? null,
      },
      paymentOptions: paymentOptions(),
    });
  }

  const db = await readDb();
  const localUser = db.users.find((entry) => entry.id === user.id);
  if (!localUser) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  const currentPayment = parsePaymentData(localUser.subscriptionPaymentMethod);
  const paymentProofUrl = incomingPaymentProofUrl || currentPayment.proofUrl;
  if (targetPlan === "plus") {
    if (!paymentProofUrl || !isValidPaymentProofUrl(paymentProofUrl)) {
      return NextResponse.json(
        {
          error:
            "Debes adjuntar una foto válida del comprobante de depósito para activar Plus.",
        },
        { status: 400 },
      );
    }
  }

  localUser.name = name;
  localUser.phone = phone;
  localUser.subscriptionPlan = targetPlan;
  localUser.subscriptionStatus = targetPlan === "plus" ? "pending" : "inactive";
  localUser.subscriptionPaymentMethod =
    targetPlan === "plus" ? buildPaymentStorageValue(paymentProofUrl) : null;
  localUser.subscriptionUpdatedAt = updatedAt.toISOString();

  if (targetPlan === "plus") {
    for (const admin of db.users.filter(
      (entry) => entry.role === "superadmin" && entry.status === "active",
    )) {
      pushInAppNotification(
        db,
        admin.id,
        "subscription_upgrade_request",
        `${localUser.name} solicitó cambio a plan Plus por depósito en Pichincha (USD ${PLUS_PRICE_USD.toFixed(2)}).`,
        {
          requesterId: localUser.id,
          paymentMethod: PLUS_BANK_TRANSFER_METHOD,
          paymentProofUrl: paymentProofUrl ?? "",
          amountUsd: String(PLUS_PRICE_USD),
        },
      );
    }
  }

  await writeDb(db);

  const paymentData = parsePaymentData(localUser.subscriptionPaymentMethod);

  return NextResponse.json({
    ok: true,
    message:
      targetPlan === "plus"
        ? `Solicitud Plus guardada por USD ${PLUS_PRICE_USD.toFixed(2)}. Tu comprobante fue enviado y está pendiente de validación.`
        : "Perfil actualizado.",
    profile: {
      id: localUser.id,
      name: localUser.name,
      email: localUser.email,
      phone: localUser.phone,
      avatarUrl: localUser.avatarUrl,
      role: localUser.role,
      subscriptionPlan: localUser.subscriptionPlan,
      subscriptionStatus: localUser.subscriptionStatus,
      subscriptionPaymentMethod: paymentData.method,
      subscriptionPaymentProofUrl: paymentData.proofUrl,
      subscriptionUpdatedAt: localUser.subscriptionUpdatedAt,
    },
    paymentOptions: paymentOptions(),
  });
}
