import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/urbis-store";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const VALID_FREQUENCIES = new Set(["INSTANT", "DAILY", "WEEKLY"]);

async function ensurePreference(userId: string) {
  return prisma.notificationPreferenceRecord.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      wantsProductNotifications: false,
      wantsAnnouncementNotifications: true,
      wantsPersonalizedRecommendations: true,
      wantsEmail: false,
      wantsPush: false,
      askedAt: new Date(),
    },
  });
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const preference = await ensurePreference(user.id);
  return NextResponse.json({
    preference: {
      wantsProductNotifications: preference.wantsProductNotifications,
      wantsAnnouncementNotifications: preference.wantsAnnouncementNotifications,
      wantsPersonalizedRecommendations: preference.wantsPersonalizedRecommendations,
      wantsEmail: preference.wantsEmail,
      wantsPush: preference.wantsPush,
      productNotificationFrequency: preference.productNotificationFrequency,
      askedAt: preference.askedAt?.toISOString() ?? null,
      respondedAt: preference.respondedAt?.toISOString() ?? null,
      needsProductConsent: !preference.respondedAt,
    },
  });
}

export async function PUT(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const payload = (await request.json()) as {
    wantsProductNotifications?: boolean;
    wantsAnnouncementNotifications?: boolean;
    wantsPersonalizedRecommendations?: boolean;
    wantsEmail?: boolean;
    wantsPush?: boolean;
    productNotificationFrequency?: string;
    markPromptShown?: boolean;
  };

  const current = await ensurePreference(user.id);
  const now = new Date();
  const updates: Record<string, unknown> = {};

  if (typeof payload.wantsProductNotifications === "boolean") {
    updates.wantsProductNotifications = payload.wantsProductNotifications;
    updates.respondedAt = now;
    if (!current.askedAt) {
      updates.askedAt = now;
    }
  }

  if (typeof payload.wantsAnnouncementNotifications === "boolean") {
    updates.wantsAnnouncementNotifications = payload.wantsAnnouncementNotifications;
  }

  if (typeof payload.wantsPersonalizedRecommendations === "boolean") {
    updates.wantsPersonalizedRecommendations = payload.wantsPersonalizedRecommendations;
  }

  if (typeof payload.wantsEmail === "boolean") {
    updates.wantsEmail = payload.wantsEmail;
  }

  if (typeof payload.wantsPush === "boolean") {
    updates.wantsPush = payload.wantsPush;
  }

  if (
    typeof payload.productNotificationFrequency === "string" &&
    VALID_FREQUENCIES.has(payload.productNotificationFrequency)
  ) {
    updates.productNotificationFrequency = payload.productNotificationFrequency;
  }

  if (payload.markPromptShown === true && !current.askedAt) {
    updates.askedAt = now;
  }

  const preference =
    Object.keys(updates).length === 0
      ? current
      : await prisma.notificationPreferenceRecord.update({
          where: { userId: user.id },
          data: updates,
        });

  return NextResponse.json({
    ok: true,
    preference: {
      wantsProductNotifications: preference.wantsProductNotifications,
      wantsAnnouncementNotifications: preference.wantsAnnouncementNotifications,
      wantsPersonalizedRecommendations: preference.wantsPersonalizedRecommendations,
      wantsEmail: preference.wantsEmail,
      wantsPush: preference.wantsPush,
      productNotificationFrequency: preference.productNotificationFrequency,
      askedAt: preference.askedAt?.toISOString() ?? null,
      respondedAt: preference.respondedAt?.toISOString() ?? null,
      needsProductConsent: !preference.respondedAt,
    },
  });
}

