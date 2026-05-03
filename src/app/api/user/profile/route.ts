import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSessionUser, pushInAppNotification, readDb, writeDb } from "@/lib/urbis-store";

export const runtime = "nodejs";

type PaymentMethod = "kushki" | "paypal";
type SubscriptionPlan = "basic" | "plus";

const allowedPaymentMethods = new Set<PaymentMethod>(["kushki", "paypal"]);

function shouldUseDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function donationOptions() {
  return {
    kushkiUrl: process.env.NEXT_PUBLIC_DONATION_KUSHKI_URL?.trim() ?? "",
    paypalUrl: process.env.NEXT_PUBLIC_DONATION_PAYPAL_URL?.trim() ?? "",
    supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ?? "",
    supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() ?? "",
    supportPhoneAlt: process.env.NEXT_PUBLIC_SUPPORT_PHONE_ALT?.trim() ?? "",
  };
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
        subscriptionUpdatedAt: profile.subscriptionUpdatedAt?.toISOString() ?? null,
      },
      paymentOptions: donationOptions(),
    });
  }

  const db = await readDb();
  const localUser = db.users.find((entry) => entry.id === user.id);
  if (!localUser) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

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
      subscriptionPaymentMethod: localUser.subscriptionPaymentMethod,
      subscriptionUpdatedAt: localUser.subscriptionUpdatedAt,
    },
    paymentOptions: donationOptions(),
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
    paymentMethod?: PaymentMethod;
  };

  const name = String(payload.name ?? "").trim();
  const phoneRaw = String(payload.phone ?? "").trim();
  const phone = phoneRaw.length > 0 ? phoneRaw : null;
  const targetPlan = payload.subscriptionPlan === "plus" ? "plus" : "basic";
  const paymentMethod = payload.paymentMethod;

  if (!name) {
    return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
  }

  if (targetPlan === "plus") {
    if (!paymentMethod || !allowedPaymentMethods.has(paymentMethod)) {
      return NextResponse.json(
        { error: "Debes seleccionar un método de pago para activar Plus." },
        { status: 400 },
      );
    }
  }

  const updatedAt = new Date();

  if (shouldUseDatabase()) {
    const nextStatus = targetPlan === "plus" ? "pending" : "inactive";
    const updatedUser = await prisma.userRecord.update({
      where: { id: user.id },
      data: {
        name,
        phone,
        subscriptionPlan: targetPlan,
        subscriptionStatus: nextStatus,
        subscriptionPaymentMethod: targetPlan === "plus" ? paymentMethod : null,
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
              message: `${updatedUser.name} solicitó cambio a plan Plus.`,
              requesterId: updatedUser.id,
              paymentMethod: paymentMethod ?? "",
            },
            createdAt: new Date(),
          })),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      message:
        targetPlan === "plus"
          ? "Solicitud Plus guardada. Completa el pago y espera validación."
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
        subscriptionUpdatedAt: updatedUser.subscriptionUpdatedAt?.toISOString() ?? null,
      },
      paymentOptions: donationOptions(),
    });
  }

  const db = await readDb();
  const localUser = db.users.find((entry) => entry.id === user.id);
  if (!localUser) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  localUser.name = name;
  localUser.phone = phone;
  localUser.subscriptionPlan = targetPlan;
  localUser.subscriptionStatus = targetPlan === "plus" ? "pending" : "inactive";
  localUser.subscriptionPaymentMethod = targetPlan === "plus" ? paymentMethod ?? null : null;
  localUser.subscriptionUpdatedAt = updatedAt.toISOString();

  if (targetPlan === "plus") {
    for (const admin of db.users.filter(
      (entry) => entry.role === "superadmin" && entry.status === "active",
    )) {
      pushInAppNotification(
        db,
        admin.id,
        "subscription_upgrade_request",
        `${localUser.name} solicitó cambio a plan Plus.`,
        {
          requesterId: localUser.id,
          paymentMethod: paymentMethod ?? "",
        },
      );
    }
  }

  await writeDb(db);

  return NextResponse.json({
    ok: true,
    message:
      targetPlan === "plus"
        ? "Solicitud Plus guardada. Completa el pago y espera validación."
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
      subscriptionPaymentMethod: localUser.subscriptionPaymentMethod,
      subscriptionUpdatedAt: localUser.subscriptionUpdatedAt,
    },
    paymentOptions: donationOptions(),
  });
}
