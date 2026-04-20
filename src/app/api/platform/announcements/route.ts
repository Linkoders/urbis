import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sendEmailNotification } from "@/lib/email-service";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireRole } from "@/lib/urbis-store";

export const runtime = "nodejs";

type AudienceType =
  | "ALL_USERS"
  | "BY_ROLE"
  | "BY_CONJUNTO"
  | "BY_EMPRENDIMIENTO"
  | "CUSTOM_USERS";

async function resolveRecipients(input: {
  audienceType: AudienceType;
  targetRole?: string | null;
  targetConjuntoId?: string | null;
  targetEmprendimientoId?: string | null;
  customUserIds?: string[];
}) {
  if (input.audienceType === "ALL_USERS") {
    const users = await prisma.userRecord.findMany({
      where: { status: "active" },
      select: { id: true, email: true, name: true },
    });
    return users;
  }

  if (input.audienceType === "BY_ROLE") {
    if (!input.targetRole) return [];
    return prisma.userRecord.findMany({
      where: {
        status: "active",
        role: input.targetRole,
      },
      select: { id: true, email: true, name: true },
    });
  }

  if (input.audienceType === "BY_CONJUNTO") {
    if (!input.targetConjuntoId) return [];
    return prisma.userRecord.findMany({
      where: {
        status: "active",
        conjuntoId: input.targetConjuntoId,
      },
      select: { id: true, email: true, name: true },
    });
  }

  if (input.audienceType === "BY_EMPRENDIMIENTO") {
    if (!input.targetEmprendimientoId) return [];

    const [emprendimiento, followers] = await Promise.all([
      prisma.emprendimientoRecord.findUnique({
        where: { id: input.targetEmprendimientoId },
        select: { ownerId: true },
      }),
      prisma.emprendimientoFollowRecord.findMany({
        where: { emprendimientoId: input.targetEmprendimientoId },
        select: { userId: true },
      }),
    ]);

    const ids = new Set(followers.map((entry) => entry.userId));
    if (emprendimiento?.ownerId) {
      ids.add(emprendimiento.ownerId);
    }

    if (ids.size === 0) return [];
    return prisma.userRecord.findMany({
      where: {
        id: { in: Array.from(ids) },
        status: "active",
      },
      select: { id: true, email: true, name: true },
    });
  }

  const filteredUserIds = (input.customUserIds ?? []).filter(Boolean);
  if (filteredUserIds.length === 0) return [];

  return prisma.userRecord.findMany({
    where: {
      id: { in: filteredUserIds },
      status: "active",
    },
    select: { id: true, email: true, name: true },
  });
}

async function sendAnnouncementNow(input: {
  announcementId: string;
  title: string;
  body: string;
  recipients: { id: string; name: string; email: string }[];
}) {
  if (input.recipients.length === 0) {
    await prisma.announcementRecord.update({
      where: { id: input.announcementId },
      data: {
        status: "SENT",
        sentAt: new Date(),
      },
    });
    return;
  }

  const uniqueRecipients = Array.from(
    new Map(input.recipients.map((entry) => [entry.id, entry])).values(),
  );

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.announcementDeliveryRecord.createMany({
      data: uniqueRecipients.map((entry) => ({
        announcementId: input.announcementId,
        userId: entry.id,
        channel: "IN_APP",
        status: "SENT",
        sentAt: now,
      })),
      skipDuplicates: true,
    });

    await tx.notificationRecord.createMany({
      data: uniqueRecipients.map((entry) => ({
        id: randomUUID(),
        userId: entry.id,
        type: "announcement",
        channel: "in_app",
        status: "queued",
        metadata: {
          message: input.title,
          announcementId: input.announcementId,
          body: input.body,
        },
        createdAt: now,
      })),
    });
  });

  const preferences = await prisma.notificationPreferenceRecord.findMany({
    where: {
      userId: { in: uniqueRecipients.map((entry) => entry.id) },
      wantsAnnouncementNotifications: true,
      wantsEmail: true,
    },
    select: { userId: true },
  });
  const emailEnabledUserIds = new Set(preferences.map((entry) => entry.userId));

  const emailNotifications: Array<{
    id: string;
    userId: string;
    type: string;
    channel: "email";
    status: "sent" | "failed";
    metadata: Record<string, string>;
    createdAt: Date;
  }> = [];

  for (const recipient of uniqueRecipients) {
    if (!emailEnabledUserIds.has(recipient.id)) {
      continue;
    }

    const result = await sendEmailNotification({
      to: recipient.email,
      subject: input.title,
      html: `<p>Hola ${recipient.name},</p><p>${input.body}</p>`,
      text: `${input.title}\n\n${input.body}`,
    });

    emailNotifications.push({
      id: randomUUID(),
      userId: recipient.id,
      type: "announcement_email",
      channel: "email",
      status: result.ok ? "sent" : "failed",
      metadata: {
        message: input.title,
        announcementId: input.announcementId,
        result: result.ok ? "sent" : "failed",
        detail: result.error ?? "OK",
      },
      createdAt: new Date(),
    });
  }

  await prisma.$transaction(async (tx) => {
    if (emailNotifications.length > 0) {
      await tx.notificationRecord.createMany({
        data: emailNotifications,
      });
    }

    await tx.announcementRecord.update({
      where: { id: input.announcementId },
      data: {
        status: "SENT",
        sentAt: new Date(),
      },
    });
  });
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!requireRole(user, ["admin_conjunto", "superadmin"])) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const where =
    user.role === "superadmin"
      ? {}
      : {
          OR: [
            { targetConjuntoId: user.conjuntoId },
            { createdBy: user.id },
          ],
        };

  const announcements = await prisma.announcementRecord.findMany({
    where,
    include: {
      _count: { select: { deliveries: true } },
      createdByUser: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return NextResponse.json({
    announcements: announcements.map((entry) => ({
      id: entry.id,
      title: entry.title,
      body: entry.body,
      status: entry.status,
      audienceType: entry.audienceType,
      targetRole: entry.targetRole,
      targetConjuntoId: entry.targetConjuntoId,
      targetEmprendimientoId: entry.targetEmprendimientoId,
      scheduledAt: entry.scheduledAt?.toISOString() ?? null,
      sentAt: entry.sentAt?.toISOString() ?? null,
      createdAt: entry.createdAt.toISOString(),
      createdBy: entry.createdByUser,
      deliveries: entry._count.deliveries,
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!requireRole(user, ["admin_conjunto", "superadmin"])) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const payload = (await request.json()) as {
    title?: string;
    body?: string;
    audienceType?: AudienceType;
    targetRole?: string;
    targetConjuntoId?: string;
    targetEmprendimientoId?: string;
    userIds?: string[];
    sendNow?: boolean;
    scheduledAt?: string;
  };

  const title = String(payload.title ?? "").trim();
  const body = String(payload.body ?? "").trim();
  const audienceType = (payload.audienceType ?? "ALL_USERS") as AudienceType;
  const validAudienceTypes = new Set([
    "ALL_USERS",
    "BY_ROLE",
    "BY_CONJUNTO",
    "BY_EMPRENDIMIENTO",
    "CUSTOM_USERS",
  ]);

  if (!title || !body) {
    return NextResponse.json({ error: "Título y mensaje son requeridos." }, { status: 400 });
  }
  if (!validAudienceTypes.has(audienceType)) {
    return NextResponse.json({ error: "audienceType inválido." }, { status: 400 });
  }

  let targetConjuntoId = String(payload.targetConjuntoId ?? "").trim() || null;
  if (user.role === "admin_conjunto") {
    if (!user.conjuntoId) {
      return NextResponse.json({ error: "Tu usuario no tiene conjunto asignado." }, { status: 400 });
    }
    targetConjuntoId = user.conjuntoId;
  }

  if (user.role === "admin_conjunto" && audienceType !== "BY_CONJUNTO") {
    return NextResponse.json(
      { error: "Los administradores de conjunto solo pueden anunciar a su conjunto." },
      { status: 403 },
    );
  }

  const sendNow = payload.sendNow === true;
  const scheduledAtRaw = String(payload.scheduledAt ?? "").trim();
  const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: "scheduledAt inválido." }, { status: 400 });
  }

  const announcement = await prisma.announcementRecord.create({
    data: {
      title,
      body,
      createdBy: user.id,
      audienceType,
      targetRole: String(payload.targetRole ?? "").trim() || null,
      targetConjuntoId,
      targetEmprendimientoId: String(payload.targetEmprendimientoId ?? "").trim() || null,
      status: sendNow ? "SENT" : scheduledAt ? "SCHEDULED" : "DRAFT",
      scheduledAt,
      sentAt: sendNow ? new Date() : null,
    },
  });

  if (!sendNow) {
    return NextResponse.json({
      ok: true,
      announcement: {
        id: announcement.id,
        status: announcement.status,
      },
    });
  }

  const recipients = await resolveRecipients({
    audienceType,
    targetRole: announcement.targetRole,
    targetConjuntoId: announcement.targetConjuntoId,
    targetEmprendimientoId: announcement.targetEmprendimientoId,
    customUserIds: payload.userIds ?? [],
  });

  await sendAnnouncementNow({
    announcementId: announcement.id,
    title: announcement.title,
    body: announcement.body,
    recipients,
  });

  return NextResponse.json({
    ok: true,
    announcement: {
      id: announcement.id,
      status: "SENT",
      recipients: recipients.length,
    },
  });
}

