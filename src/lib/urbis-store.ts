import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import type {
  Conjunto,
  Emprendimiento,
  Notification,
  Producto,
  SessionUser,
  UrbisDb,
  User,
  UserRole,
} from "./urbis-types";
import { prisma } from "./prisma";
import { toClientAssetUrl } from "./blob-utils";

const DB_DIR = join(process.cwd(), "data");
const DB_PATH = join(DB_DIR, "urbis-db.json");
export const SESSION_COOKIE = "urbis_session";
const RELATIONAL_CACHE_TTL_MS = (() => {
  const raw = Number(process.env.URBIS_DB_CACHE_TTL_MS ?? "1500");
  return Number.isFinite(raw) && raw >= 0 ? raw : 1500;
})();

let relationalSeedChecked = false;
let relationalCache: { db: UrbisDb; timestamp: number } | null = null;
let relationalReadPromise: Promise<UrbisDb> | null = null;

const now = () => new Date().toISOString();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, packed: string): boolean {
  const [salt, storedHash] = packed.split(":");
  if (!salt || !storedHash) {
    return false;
  }

  const computed = scryptSync(password, salt, 64);
  const stored = Buffer.from(storedHash, "hex");

  if (stored.length !== computed.length) {
    return false;
  }

  return timingSafeEqual(stored, computed);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function createSeedDb(): UrbisDb {
  const timestamp = now();
  const superId = randomUUID();

  const users: User[] = [
    {
      id: superId,
      name: "Super Admin URBIS",
      email: "super@urbis.local",
      phone: null,
      passwordHash: hashPassword("Super123!"),
      role: "superadmin",
      conjuntoId: null,
      avatarUrl: null,
      status: "active",
      subscriptionPlan: "plus",
      subscriptionStatus: "active",
      subscriptionPaymentMethod: "system_seed",
      subscriptionUpdatedAt: timestamp,
      emailVerifiedAt: timestamp,
      emailVerificationCode: null,
      acceptedTermsAt: timestamp,
      createdAt: timestamp,
    },
  ];

  return {
    users,
    conjuntos: [],
    conjuntoRequests: [],
    emprendimientos: [],
    products: [],
    reviews: [],
    notifications: [],
    feedbackMessages: [],
  };
}

function normalizeDb(rawDb: UrbisDb): UrbisDb {
  rawDb.users = rawDb.users.map((user) => ({
    ...user,
    avatarUrl: user.avatarUrl ? toClientAssetUrl(user.avatarUrl) : null,
    phone: user.phone ?? null,
    subscriptionPlan: user.subscriptionPlan === "plus" ? "plus" : "basic",
    subscriptionStatus:
      user.subscriptionStatus === "active"
        ? "active"
        : user.subscriptionStatus === "pending"
          ? "pending"
          : "inactive",
    subscriptionPaymentMethod: user.subscriptionPaymentMethod ?? null,
    subscriptionUpdatedAt: user.subscriptionUpdatedAt ?? null,
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    emailVerificationCode: user.emailVerificationCode ?? null,
    acceptedTermsAt: user.acceptedTermsAt ?? null,
  }));

  rawDb.conjuntos = rawDb.conjuntos.map((conjunto) => ({
    ...conjunto,
    mapUrl: conjunto.mapUrl ?? null,
    latitude: typeof conjunto.latitude === "number" ? conjunto.latitude : null,
    longitude: typeof conjunto.longitude === "number" ? conjunto.longitude : null,
    logoUrl: conjunto.logoUrl ? toClientAssetUrl(conjunto.logoUrl) : "/images/owner-1.jpg",
  }));

  rawDb.conjuntoRequests = rawDb.conjuntoRequests.map((request) => ({
    ...request,
    mapUrl: request.mapUrl ?? null,
    latitude: typeof request.latitude === "number" ? request.latitude : null,
    longitude: typeof request.longitude === "number" ? request.longitude : null,
    logoUrl: request.logoUrl ? toClientAssetUrl(request.logoUrl) : null,
    requestedByUserId: request.requestedByUserId ?? null,
  }));

  rawDb.emprendimientos = rawDb.emprendimientos.map((emprendimiento) => ({
    ...emprendimiento,
    logoUrl: emprendimiento.logoUrl
      ? toClientAssetUrl(emprendimiento.logoUrl)
      : "/images/market-woman.jpg",
    contactEmail: emprendimiento.contactEmail ?? null,
    contactPhone: emprendimiento.contactPhone ?? null,
  }));

  rawDb.notifications = rawDb.notifications.map((notification) => ({
    ...notification,
    status: notification.status ?? "queued",
    metadata: notification.metadata ?? {},
  }));

  rawDb.feedbackMessages = (rawDb.feedbackMessages ?? []).map((entry) => ({
    ...entry,
    category: entry.category ?? "mejora",
    status: entry.status ?? "new",
  }));

  const hasExplicitSpecial = rawDb.products.some(
    (product) =>
      typeof product.specialPrice === "number" && product.specialPrice > 0,
  );

  const topPublishedIds = new Set(
    rawDb.products
      .filter((product) => product.status === "published")
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 2)
      .map((product) => product.id),
  );

  rawDb.products = rawDb.products.map((product) => {
    const explicitSpecial =
      typeof product.specialPrice === "number" ? product.specialPrice : null;

    if (explicitSpecial !== null) {
      return {
        ...product,
        imageUrls: product.imageUrls.map((url) => toClientAssetUrl(url)),
        specialPrice: explicitSpecial,
      };
    }

    if (!hasExplicitSpecial && topPublishedIds.has(product.id)) {
      return {
        ...product,
        imageUrls: product.imageUrls.map((url) => toClientAssetUrl(url)),
        specialPrice: Number((product.price * 0.85).toFixed(2)),
      };
    }

    return {
      ...product,
      imageUrls: product.imageUrls.map((url) => toClientAssetUrl(url)),
      specialPrice: null,
    };
  });

  return rawDb;
}

async function ensureDbFile(): Promise<void> {
  await mkdir(DB_DIR, { recursive: true });

  try {
    await readFile(DB_PATH, "utf-8");
  } catch {
    const seed = createSeedDb();
    await writeFile(DB_PATH, JSON.stringify(seed, null, 2), "utf-8");
  }
}

function shouldUseDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function cloneDb(db: UrbisDb): UrbisDb {
  return JSON.parse(JSON.stringify(db)) as UrbisDb;
}

function primeRelationalCache(db: UrbisDb): void {
  relationalCache = {
    db: cloneDb(db),
    timestamp: Date.now(),
  };
}

function parseDate(
  value: string | null | undefined,
  fallback: Date | null = null,
): Date | null {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return parsed;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function toStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      typeof entry === "string" ? entry : String(entry ?? ""),
    ]),
  );
}

async function readRelationalDb(): Promise<UrbisDb> {
  const [
    users,
    conjuntos,
    conjuntoRequests,
    emprendimientos,
    products,
    reviews,
    notifications,
    feedbackMessages,
  ] = await prisma.$transaction([
    prisma.userRecord.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.conjuntoRecord.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.conjuntoRequestRecord.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.emprendimientoRecord.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.productRecord.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.reviewRecord.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.notificationRecord.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.feedbackMessageRecord.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return normalizeDb({
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      passwordHash: user.passwordHash,
      role: user.role as UserRole,
      conjuntoId: user.conjuntoId,
      avatarUrl: user.avatarUrl,
      status: user.status as User["status"],
      subscriptionPlan: user.subscriptionPlan === "plus" ? "plus" : "basic",
      subscriptionStatus:
        user.subscriptionStatus === "active"
          ? "active"
          : user.subscriptionStatus === "pending"
            ? "pending"
            : "inactive",
      subscriptionPaymentMethod: user.subscriptionPaymentMethod ?? null,
      subscriptionUpdatedAt: user.subscriptionUpdatedAt?.toISOString() ?? null,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      emailVerificationCode: user.emailVerificationCode ?? null,
      acceptedTermsAt: user.acceptedTermsAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    })),
    conjuntos: conjuntos.map((conjunto) => ({
      id: conjunto.id,
      name: conjunto.name,
      slug: conjunto.slug,
      location: conjunto.location,
      mapUrl: conjunto.mapUrl,
      latitude: conjunto.latitude,
      longitude: conjunto.longitude,
      description: conjunto.description,
      logoUrl: conjunto.logoUrl,
      status: conjunto.status as Conjunto["status"],
      createdBy: conjunto.createdBy,
      createdAt: conjunto.createdAt.toISOString(),
    })),
    conjuntoRequests: conjuntoRequests.map((request) => ({
      id: request.id,
      nameRequested: request.nameRequested,
      location: request.location,
      mapUrl: request.mapUrl,
      latitude: request.latitude,
      longitude: request.longitude,
      description: request.description,
      logoUrl: request.logoUrl,
      contactEmail: request.contactEmail,
      requestedByUserId: request.requestedByUserId,
      status: request.status as "pending" | "approved" | "rejected",
      reviewedBy: request.reviewedBy,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    })),
    emprendimientos: emprendimientos.map((emprendimiento) => ({
      id: emprendimiento.id,
      conjuntoId: emprendimiento.conjuntoId,
      ownerId: emprendimiento.ownerId,
      name: emprendimiento.name,
      description: emprendimiento.description,
      logoUrl: emprendimiento.logoUrl,
      contactEmail: emprendimiento.contactEmail,
      contactPhone: emprendimiento.contactPhone,
      visibility: emprendimiento.visibility as Emprendimiento["visibility"],
      status: emprendimiento.status as Emprendimiento["status"],
      createdAt: emprendimiento.createdAt.toISOString(),
      updatedAt: emprendimiento.updatedAt.toISOString(),
    })),
    products: products.map((product) => ({
      id: product.id,
      emprendimientoId: product.emprendimientoId,
      ownerId: product.ownerId,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      specialPrice: product.specialPrice,
      category: product.category,
      stock: product.stock,
      imageUrls: toStringArray(product.imageUrls),
      status: product.status as Producto["status"],
      viewCount: product.viewCount,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    })),
    reviews: reviews.map((review) => ({
      id: review.id,
      productId: review.productId,
      authorId: review.authorId,
      rating: review.rating,
      comment: review.comment,
      status: review.status as "visible" | "hidden",
      createdAt: review.createdAt.toISOString(),
    })),
    notifications: notifications.map((notification) => ({
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      channel: notification.channel as "email" | "in_app",
      status: notification.status as "queued" | "sent" | "read" | "failed",
      metadata: toStringRecord(notification.metadata),
      createdAt: notification.createdAt.toISOString(),
    })),
    feedbackMessages: feedbackMessages.map((feedback) => ({
      id: feedback.id,
      name: feedback.name,
      email: feedback.email,
      message: feedback.message,
      category: feedback.category as "mejora" | "apoyo",
      status: feedback.status as "new" | "reviewed",
      createdAt: feedback.createdAt.toISOString(),
    })),
  });
}

async function replaceRelationalDb(nextDb: UrbisDb): Promise<void> {
  const db = normalizeDb(cloneDb(nextDb));
  const requiredSeed = createSeedDb();

  if (db.users.length === 0) {
    db.users = requiredSeed.users;
  }

  const userIds = new Set(db.users.map((user) => user.id));

  db.conjuntos = db.conjuntos.filter((conjunto) => userIds.has(conjunto.createdBy));
  const conjuntoIds = new Set(db.conjuntos.map((conjunto) => conjunto.id));

  db.conjuntoRequests = db.conjuntoRequests.map((request) => ({
    ...request,
    requestedByUserId:
      request.requestedByUserId && userIds.has(request.requestedByUserId)
        ? request.requestedByUserId
        : null,
    reviewedBy:
      request.reviewedBy && userIds.has(request.reviewedBy)
        ? request.reviewedBy
        : null,
  }));

  db.emprendimientos = db.emprendimientos.filter(
    (emprendimiento) =>
      userIds.has(emprendimiento.ownerId) &&
      conjuntoIds.has(emprendimiento.conjuntoId),
  );
  const emprendimientoIds = new Set(db.emprendimientos.map((entry) => entry.id));

  db.products = db.products.filter(
    (product) =>
      userIds.has(product.ownerId) &&
      emprendimientoIds.has(product.emprendimientoId),
  );
  const productIds = new Set(db.products.map((product) => product.id));

  db.reviews = db.reviews.filter(
    (review) => userIds.has(review.authorId) && productIds.has(review.productId),
  );
  db.notifications = db.notifications.filter((notification) =>
    userIds.has(notification.userId),
  );

  await prisma.$transaction(async (tx) => {
    const [
      preservedProfiles,
      preservedPreferences,
      preservedAnnouncements,
      preservedAnnouncementDeliveries,
      preservedProductInterests,
      preservedProductVisits,
      preservedEmprendimientoVisits,
      preservedFavorites,
      preservedFollows,
    ] = await Promise.all([
      tx.entrepreneurProfileRecord.findMany(),
      tx.notificationPreferenceRecord.findMany(),
      tx.announcementRecord.findMany(),
      tx.announcementDeliveryRecord.findMany(),
      tx.productInterestRecord.findMany(),
      tx.userProductVisitRecord.findMany(),
      tx.emprendimientoVisitRecord.findMany(),
      tx.userFavoriteProductRecord.findMany(),
      tx.emprendimientoFollowRecord.findMany(),
    ]);

    await tx.reviewRecord.deleteMany();
    await tx.productRecord.deleteMany();
    await tx.emprendimientoRecord.deleteMany();
    await tx.conjuntoRequestRecord.deleteMany();
    await tx.notificationRecord.deleteMany();
    await tx.feedbackMessageRecord.deleteMany();
    await tx.conjuntoRecord.deleteMany();
    await tx.userRecord.deleteMany();

    if (db.users.length > 0) {
      await tx.userRecord.createMany({
        data: db.users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          passwordHash: user.passwordHash,
          role: user.role,
          conjuntoId: user.conjuntoId,
          avatarUrl: user.avatarUrl,
          status: user.status,
          subscriptionPlan: user.subscriptionPlan,
          subscriptionStatus: user.subscriptionStatus,
          subscriptionPaymentMethod: user.subscriptionPaymentMethod,
          subscriptionUpdatedAt: parseDate(user.subscriptionUpdatedAt),
          emailVerifiedAt: parseDate(user.emailVerifiedAt),
          emailVerificationCode: user.emailVerificationCode,
          acceptedTermsAt: parseDate(user.acceptedTermsAt),
          createdAt: parseDate(user.createdAt, new Date())!,
        })),
      });
    }

    if (db.conjuntos.length > 0) {
      await tx.conjuntoRecord.createMany({
        data: db.conjuntos.map((conjunto) => ({
          id: conjunto.id,
          name: conjunto.name,
          slug: conjunto.slug,
          location: conjunto.location,
          mapUrl: conjunto.mapUrl,
          latitude: conjunto.latitude,
          longitude: conjunto.longitude,
          description: conjunto.description,
          logoUrl: conjunto.logoUrl,
          status: conjunto.status,
          createdBy: conjunto.createdBy,
          createdAt: parseDate(conjunto.createdAt, new Date())!,
        })),
      });
    }

    if (db.conjuntoRequests.length > 0) {
      await tx.conjuntoRequestRecord.createMany({
        data: db.conjuntoRequests.map((request) => ({
          id: request.id,
          nameRequested: request.nameRequested,
          location: request.location,
          mapUrl: request.mapUrl,
          latitude: request.latitude,
          longitude: request.longitude,
          description: request.description,
          logoUrl: request.logoUrl,
          contactEmail: request.contactEmail,
          requestedByUserId: request.requestedByUserId,
          status: request.status,
          reviewedBy: request.reviewedBy,
          createdAt: parseDate(request.createdAt, new Date())!,
          updatedAt: parseDate(request.updatedAt, new Date())!,
        })),
      });
    }

    if (db.emprendimientos.length > 0) {
      await tx.emprendimientoRecord.createMany({
        data: db.emprendimientos.map((emprendimiento) => ({
          id: emprendimiento.id,
          conjuntoId: emprendimiento.conjuntoId,
          ownerId: emprendimiento.ownerId,
          name: emprendimiento.name,
          description: emprendimiento.description,
          logoUrl: emprendimiento.logoUrl,
          contactEmail: emprendimiento.contactEmail,
          contactPhone: emprendimiento.contactPhone,
          visibility: emprendimiento.visibility,
          status: emprendimiento.status,
          createdAt: parseDate(emprendimiento.createdAt, new Date())!,
          updatedAt: parseDate(emprendimiento.updatedAt, new Date())!,
        })),
      });
    }

    if (db.products.length > 0) {
      await tx.productRecord.createMany({
        data: db.products.map((product) => ({
          id: product.id,
          emprendimientoId: product.emprendimientoId,
          ownerId: product.ownerId,
          name: product.name,
          slug: product.slug,
          description: product.description,
          price: product.price,
          specialPrice: product.specialPrice,
          category: product.category,
          stock: product.stock,
          imageUrls: product.imageUrls as unknown as Prisma.InputJsonValue,
          status: product.status,
          viewCount: product.viewCount,
          createdAt: parseDate(product.createdAt, new Date())!,
          updatedAt: parseDate(product.updatedAt, new Date())!,
        })),
      });
    }

    if (db.reviews.length > 0) {
      await tx.reviewRecord.createMany({
        data: db.reviews.map((review) => ({
          id: review.id,
          productId: review.productId,
          authorId: review.authorId,
          rating: review.rating,
          comment: review.comment,
          status: review.status,
          createdAt: parseDate(review.createdAt, new Date())!,
        })),
      });
    }

    if (db.notifications.length > 0) {
      await tx.notificationRecord.createMany({
        data: db.notifications.map((notification) => ({
          id: notification.id,
          userId: notification.userId,
          type: notification.type,
          channel: notification.channel,
          status: notification.status,
          metadata: notification.metadata as unknown as Prisma.InputJsonValue,
          createdAt: parseDate(notification.createdAt, new Date())!,
        })),
      });
    }

    if (db.feedbackMessages.length > 0) {
      await tx.feedbackMessageRecord.createMany({
        data: db.feedbackMessages.map((entry) => ({
          id: entry.id,
          name: entry.name,
          email: entry.email,
          message: entry.message,
          category: entry.category,
          status: entry.status,
          createdAt: parseDate(entry.createdAt, new Date())!,
        })),
      });
    }

    const validUserIds = new Set(db.users.map((entry) => entry.id));
    const validConjuntoIds = new Set(db.conjuntos.map((entry) => entry.id));
    const validEmprendimientoIds = new Set(db.emprendimientos.map((entry) => entry.id));
    const validProductIds = new Set(db.products.map((entry) => entry.id));

    const profilesToRestore = preservedProfiles.filter(
      (entry) =>
        validUserIds.has(entry.userId) &&
        (!entry.defaultConjuntoId || validConjuntoIds.has(entry.defaultConjuntoId)),
    );
    if (profilesToRestore.length > 0) {
      await tx.entrepreneurProfileRecord.createMany({
        data: profilesToRestore.map((entry) => ({
          userId: entry.userId,
          displayName: entry.displayName,
          bio: entry.bio,
          isIndependent: entry.isIndependent,
          defaultConjuntoId: entry.defaultConjuntoId,
          approvalStatus: entry.approvalStatus,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        })),
      });
    }

    const preferencesToRestore = preservedPreferences.filter((entry) =>
      validUserIds.has(entry.userId),
    );
    if (preferencesToRestore.length > 0) {
      await tx.notificationPreferenceRecord.createMany({
        data: preferencesToRestore.map((entry) => ({
          userId: entry.userId,
          wantsProductNotifications: entry.wantsProductNotifications,
          wantsAnnouncementNotifications: entry.wantsAnnouncementNotifications,
          wantsPersonalizedRecommendations: entry.wantsPersonalizedRecommendations,
          wantsEmail: entry.wantsEmail,
          wantsPush: entry.wantsPush,
          productNotificationFrequency: entry.productNotificationFrequency,
          askedAt: entry.askedAt,
          respondedAt: entry.respondedAt,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        })),
      });
    }

    const announcementsToRestore = preservedAnnouncements.filter(
      (entry) =>
        validUserIds.has(entry.createdBy) &&
        (!entry.targetConjuntoId || validConjuntoIds.has(entry.targetConjuntoId)) &&
        (!entry.targetEmprendimientoId ||
          validEmprendimientoIds.has(entry.targetEmprendimientoId)),
    );
    if (announcementsToRestore.length > 0) {
      await tx.announcementRecord.createMany({
        data: announcementsToRestore.map((entry) => ({
          id: entry.id,
          title: entry.title,
          body: entry.body,
          createdBy: entry.createdBy,
          status: entry.status,
          audienceType: entry.audienceType,
          targetRole: entry.targetRole,
          targetConjuntoId: entry.targetConjuntoId,
          targetEmprendimientoId: entry.targetEmprendimientoId,
          scheduledAt: entry.scheduledAt,
          sentAt: entry.sentAt,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        })),
      });
    }

    const validAnnouncementIds = new Set(
      announcementsToRestore.map((entry) => entry.id),
    );
    const deliveriesToRestore = preservedAnnouncementDeliveries.filter(
      (entry) =>
        validAnnouncementIds.has(entry.announcementId) &&
        validUserIds.has(entry.userId),
    );
    if (deliveriesToRestore.length > 0) {
      await tx.announcementDeliveryRecord.createMany({
        data: deliveriesToRestore.map((entry) => ({
          id: entry.id,
          announcementId: entry.announcementId,
          userId: entry.userId,
          channel: entry.channel,
          status: entry.status,
          errorMessage: entry.errorMessage,
          sentAt: entry.sentAt,
          readAt: entry.readAt,
          clickedAt: entry.clickedAt,
          createdAt: entry.createdAt,
        })),
      });
    }

    const interestsToRestore = preservedProductInterests.filter(
      (entry) =>
        validUserIds.has(entry.userId) &&
        (!entry.productId || validProductIds.has(entry.productId)),
    );
    if (interestsToRestore.length > 0) {
      await tx.productInterestRecord.createMany({
        data: interestsToRestore.map((entry) => ({
          id: entry.id,
          userId: entry.userId,
          productId: entry.productId,
          category: entry.category,
          tag: entry.tag,
          weight: entry.weight,
          source: entry.source,
          lastInteractedAt: entry.lastInteractedAt,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        })),
      });
    }

    const productVisitsToRestore = preservedProductVisits.filter(
      (entry) =>
        validProductIds.has(entry.productId) &&
        validEmprendimientoIds.has(entry.emprendimientoId) &&
        (!entry.userId || validUserIds.has(entry.userId)),
    );
    if (productVisitsToRestore.length > 0) {
      await tx.userProductVisitRecord.createMany({
        data: productVisitsToRestore.map((entry) => ({
          id: entry.id,
          userId: entry.userId,
          productId: entry.productId,
          emprendimientoId: entry.emprendimientoId,
          sessionId: entry.sessionId,
          referrer: entry.referrer,
          dwellSeconds: entry.dwellSeconds,
          visitedAt: entry.visitedAt,
        })),
      });
    }

    const emprendimientoVisitsToRestore = preservedEmprendimientoVisits.filter(
      (entry) =>
        validEmprendimientoIds.has(entry.emprendimientoId) &&
        (!entry.userId || validUserIds.has(entry.userId)),
    );
    if (emprendimientoVisitsToRestore.length > 0) {
      await tx.emprendimientoVisitRecord.createMany({
        data: emprendimientoVisitsToRestore.map((entry) => ({
          id: entry.id,
          userId: entry.userId,
          emprendimientoId: entry.emprendimientoId,
          sessionId: entry.sessionId,
          referrer: entry.referrer,
          visitedAt: entry.visitedAt,
        })),
      });
    }

    const favoritesToRestore = preservedFavorites.filter(
      (entry) =>
        validUserIds.has(entry.userId) && validProductIds.has(entry.productId),
    );
    if (favoritesToRestore.length > 0) {
      await tx.userFavoriteProductRecord.createMany({
        data: favoritesToRestore.map((entry) => ({
          userId: entry.userId,
          productId: entry.productId,
          createdAt: entry.createdAt,
        })),
      });
    }

    const followsToRestore = preservedFollows.filter(
      (entry) =>
        validUserIds.has(entry.userId) &&
        validEmprendimientoIds.has(entry.emprendimientoId),
    );
    if (followsToRestore.length > 0) {
      await tx.emprendimientoFollowRecord.createMany({
        data: followsToRestore.map((entry) => ({
          userId: entry.userId,
          emprendimientoId: entry.emprendimientoId,
          notifyNewProducts: entry.notifyNewProducts,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        })),
      });
    }
  }, {
    maxWait: 10_000,
    timeout: 60_000,
  });
}

async function ensureRelationalDbSeeded(): Promise<void> {
  if (relationalSeedChecked) {
    return;
  }

  const counts = await prisma.$transaction([
    prisma.userRecord.count(),
    prisma.conjuntoRecord.count(),
    prisma.conjuntoRequestRecord.count(),
    prisma.emprendimientoRecord.count(),
    prisma.productRecord.count(),
    prisma.reviewRecord.count(),
    prisma.notificationRecord.count(),
    prisma.feedbackMessageRecord.count(),
  ]);

  const hasAnyData = counts.some((count) => count > 0);
  if (hasAnyData) {
    relationalSeedChecked = true;
    return;
  }

  const seed = createSeedDb();
  await replaceRelationalDb(seed);
  primeRelationalCache(normalizeDb(cloneDb(seed)));
  relationalSeedChecked = true;
}

export async function readDb(): Promise<UrbisDb> {
  if (shouldUseDatabase()) {
    await ensureRelationalDbSeeded();

    if (relationalCache && Date.now() - relationalCache.timestamp <= RELATIONAL_CACHE_TTL_MS) {
      return cloneDb(relationalCache.db);
    }

    if (relationalReadPromise) {
      return cloneDb(await relationalReadPromise);
    }

    relationalReadPromise = readRelationalDb()
      .then((db) => {
        primeRelationalCache(db);
        return db;
      })
      .finally(() => {
        relationalReadPromise = null;
      });

    return cloneDb(await relationalReadPromise);
  }

  await ensureDbFile();
  const raw = await readFile(DB_PATH, "utf-8");
  const db = JSON.parse(raw) as UrbisDb;
  return normalizeDb(db);
}

export async function writeDb(db: UrbisDb): Promise<void> {
  if (shouldUseDatabase()) {
    await ensureRelationalDbSeeded();
    await replaceRelationalDb(db);
    primeRelationalCache(normalizeDb(cloneDb(db)));
    relationalSeedChecked = true;
    return;
  }

  await writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

export function createId(): string {
  return randomUUID();
}

export function pushInAppNotification(
  db: UrbisDb,
  userId: string,
  type: string,
  message: string,
  metadata: Record<string, string> = {},
): Notification {
  const notification: Notification = {
    id: createId(),
    userId,
    type,
    channel: "in_app",
    status: "queued",
    metadata: {
      message,
      ...metadata,
    },
    createdAt: now(),
  };

  db.notifications.unshift(notification);
  return notification;
}

export function createPasswordHash(password: string): string {
  return hashPassword(password);
}

export function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    conjuntoId: user.conjuntoId,
    avatarUrl: user.avatarUrl ?? null,
    status: user.status,
    subscriptionPlan: user.subscriptionPlan,
    subscriptionStatus: user.subscriptionStatus,
    subscriptionPaymentMethod: user.subscriptionPaymentMethod,
    subscriptionUpdatedAt: user.subscriptionUpdatedAt,
    emailVerifiedAt: user.emailVerifiedAt ?? null,
  };
}

export async function getSessionUser(request: NextRequest): Promise<User | null> {
  const userId = request.cookies.get(SESSION_COOKIE)?.value;
  if (!userId) {
    return null;
  }

  if (shouldUseDatabase()) {
    const user = await prisma.userRecord.findUnique({
      where: { id: userId },
    });

    if (!user || user.status !== "active") {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      passwordHash: user.passwordHash,
      role: user.role as UserRole,
      conjuntoId: user.conjuntoId,
      avatarUrl: user.avatarUrl,
      status: user.status as User["status"],
      subscriptionPlan: user.subscriptionPlan === "plus" ? "plus" : "basic",
      subscriptionStatus:
        user.subscriptionStatus === "active"
          ? "active"
          : user.subscriptionStatus === "pending"
            ? "pending"
            : "inactive",
      subscriptionPaymentMethod: user.subscriptionPaymentMethod ?? null,
      subscriptionUpdatedAt: user.subscriptionUpdatedAt?.toISOString() ?? null,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      emailVerificationCode: user.emailVerificationCode ?? null,
      acceptedTermsAt: user.acceptedTermsAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  const db = await readDb();
  const user = db.users.find((entry) => entry.id === userId) ?? null;
  if (!user || user.status !== "active") {
    return null;
  }

  return user;
}

export function requireRole(user: User, allowed: UserRole[]): boolean {
  return allowed.includes(user.role);
}

export function computeRating(productId: string, db: UrbisDb): {
  average: number;
  total: number;
} {
  const related = db.reviews.filter(
    (review) => review.productId === productId && review.status === "visible",
  );

  if (related.length === 0) {
    return { average: 0, total: 0 };
  }

  const totalScore = related.reduce((acc, review) => acc + review.rating, 0);
  return {
    average: Number((totalScore / related.length).toFixed(1)),
    total: related.length,
  };
}

export function canViewProduct(
  product: Producto,
  emprendimiento: Emprendimiento,
  conjunto: Conjunto,
  viewer: User | null,
): boolean {
  if (product.status !== "published") {
    return false;
  }

  if (emprendimiento.status !== "approved") {
    return false;
  }

  if (conjunto.status !== "approved") {
    return false;
  }

  if (emprendimiento.visibility === "public") {
    return true;
  }

  return Boolean(viewer && viewer.conjuntoId === emprendimiento.conjuntoId);
}
