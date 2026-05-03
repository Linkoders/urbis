"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BellIcon } from "@/components/ui-icons";

interface SessionData {
  authenticated: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: "resident" | "admin_conjunto" | "superadmin";
    conjuntoId: string | null;
    avatarUrl: string | null;
    emailVerifiedAt: string | null;
  };
}

interface HeaderNotification {
  id: string;
  type: string;
  message: string;
  status: "queued" | "sent" | "read";
  createdAt: string;
  metadata?: Record<string, string>;
}

function roleLabel(role?: "resident" | "admin_conjunto" | "superadmin"): string {
  if (role === "superadmin") {
    return "Superadmin";
  }
  if (role === "admin_conjunto") {
    return "Admin conjunto";
  }
  if (role === "resident") {
    return "Residente";
  }
  return "Usuario";
}

function notificationLink(notification: HeaderNotification): string | null {
  if (notification.metadata?.productSlug) {
    return `/productos/${notification.metadata.productSlug}`;
  }

  if (notification.metadata?.productId) {
    return `/productos/${notification.metadata.productId}`;
  }

  if (notification.metadata?.emprendimientoId) {
    return `/panel/emprendimientos/${notification.metadata.emprendimientoId}`;
  }

  if (notification.metadata?.conjuntoId) {
    return `/panel/conjuntos/${notification.metadata.conjuntoId}`;
  }

  if (notification.type.includes("emprendimiento")) {
    return "/panel";
  }

  if (notification.type.includes("conjunto")) {
    return "/panel";
  }

  return null;
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const notificationsRef = useRef<HTMLDivElement | null>(null);

  const [session, setSession] = useState<SessionData>({ authenticated: false });
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const profileRole = useMemo(() => roleLabel(session.user?.role), [session.user?.role]);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      if (!mounted) {
        return;
      }

      if (!response.ok) {
        setSession({ authenticated: false });
        setLoading(false);
        return;
      }

      const data = (await response.json()) as SessionData;
      setSession(data);
      if (data.authenticated) {
        const notificationsResponse = await fetch("/api/platform/notifications", {
          cache: "no-store",
        });

        if (notificationsResponse.ok) {
          const notificationsData = (await notificationsResponse.json()) as {
            notifications: HeaderNotification[];
            unreadCount: number;
          };

          setNotifications(notificationsData.notifications ?? []);
          setUnreadCount(notificationsData.unreadCount ?? 0);
        }
      } else {
        setNotifications([]);
        setUnreadCount(0);
      }
      setLoading(false);
    }

    void loadSession();

    return () => {
      mounted = false;
    };
  }, [pathname]);

  useEffect(() => {
    if (!notificationsOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const root = notificationsRef.current;
      if (!root) {
        return;
      }

      if (!root.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [notificationsOpen]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession({ authenticated: false });
    setMobileOpen(false);
    router.push("/");
    router.refresh();
  }

  async function callNotificationsAction(action: string, notificationId?: string) {
    const response = await fetch("/api/platform/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, notificationId }),
    });

    return response.ok;
  }

  async function markAllNotificationsRead() {
    if (!session.authenticated || unreadCount === 0) {
      return;
    }

    setNotificationsLoading(true);
    const ok = await callNotificationsAction("mark_all_read");
    if (ok) {
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((entry) => ({
          ...entry,
          status: "sent",
        })),
      );
    }
    setNotificationsLoading(false);
  }

  async function clearReadNotifications() {
    setNotificationsLoading(true);
    const ok = await callNotificationsAction("delete_read");
    if (ok) {
      setNotifications((prev) => prev.filter((entry) => entry.status === "queued"));
    }
    setNotificationsLoading(false);
  }

  async function deleteNotification(notificationId: string) {
    const ok = await callNotificationsAction("delete_one", notificationId);
    if (!ok) {
      return;
    }

    setNotifications((prev) => prev.filter((entry) => entry.id !== notificationId));
  }

  async function openNotification(notification: HeaderNotification) {
    if (notification.status === "queued") {
      await callNotificationsAction("mark_read", notification.id);
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setNotifications((prev) =>
        prev.map((entry) =>
          entry.id === notification.id
            ? {
                ...entry,
                status: "sent",
              }
            : entry,
        ),
      );
    }

    const href = notificationLink(notification);
    setNotificationsOpen(false);
    if (href) {
      router.push(href);
    }
  }

  const showAdminPanel =
    session.authenticated &&
    (session.user?.role === "admin_conjunto" || session.user?.role === "superadmin");
  const hasConjunto = session.user?.conjuntoId;

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-sm">
      <div className="mx-auto flex h-20 max-w-[1320px] items-center justify-between gap-3 px-6 lg:px-12">
        <Link
          href="/"
          onClick={() => setMobileOpen(false)}
          className="flex shrink-0 items-center gap-3 text-white"
        >
          <Image src="/images/urbis-logo.svg" alt="Urbis" width={34} height={34} className="h-8 w-8" />
          <span className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-wide">
            URBIS
          </span>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-6 text-[11px] uppercase tracking-[0.17em] text-zinc-300 md:flex">
          <Link href="/" className="transition hover:text-white">
            Inicio
          </Link>
          <Link href="/productos" className="transition hover:text-white">
            Productos
          </Link>
          {session.authenticated && hasConjunto ? (
            <Link href="/productos?scope=my_conjunto" className="transition hover:text-white">
              Mi conjunto
            </Link>
          ) : null}
          {session.authenticated ? (
            <Link href="/panel/reportes" className="transition hover:text-white">
              Reportes
            </Link>
          ) : null}
          {session.authenticated ? (
            <Link href="/panel/perfil" className="transition hover:text-white">
              Mi perfil
            </Link>
          ) : null}
          {session.authenticated && session.user?.role === "resident" ? (
            <Link href="/panel" className="transition hover:text-white">
              Gestionar emprendimientos
            </Link>
          ) : null}
          {showAdminPanel ? (
            <Link href="/panel" className="transition hover:text-white">
              Gestión de comunidad
            </Link>
          ) : null}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {session.authenticated ? (
            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                onClick={() => setNotificationsOpen((prev) => !prev)}
                className="relative border border-white/30 px-3 py-2 text-white hover:border-white"
              >
                <BellIcon className="h-5 w-5" />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-400 px-1 text-[10px] font-bold text-black">
                    {unreadCount}
                  </span>
                ) : null}
              </button>
              {notificationsOpen ? (
                <div className="absolute right-0 mt-2 w-[420px] border border-white/15 bg-[#0b1016] p-3 shadow-2xl">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-300">Notificaciones</p>
                    <div className="flex gap-3 text-[10px] uppercase tracking-[0.12em]">
                      <button
                        type="button"
                        onClick={() => void markAllNotificationsRead()}
                        disabled={notificationsLoading}
                        className="text-emerald-300 hover:text-emerald-200 disabled:opacity-60"
                      >
                        Marcar leídas
                      </button>
                      <button
                        type="button"
                        onClick={() => void clearReadNotifications()}
                        disabled={notificationsLoading}
                        className="text-zinc-300 hover:text-white disabled:opacity-60"
                      >
                        Limpiar leídas
                      </button>
                    </div>
                  </div>
                  <div className="max-h-96 space-y-2 overflow-auto pr-1">
                    {notifications.length === 0 ? (
                      <p className="text-sm text-zinc-400">No tienes notificaciones.</p>
                    ) : (
                      notifications.map((notification) => (
                        <article
                          key={notification.id}
                          className={`border p-2 ${notification.status === "queued" ? "border-emerald-300/30 bg-emerald-300/5" : "border-white/10 bg-black/25"}`}
                        >
                          <button
                            type="button"
                            onClick={() => void openNotification(notification)}
                            className="w-full text-left"
                          >
                            <p className="text-sm text-zinc-200">{notification.message}</p>
                            <p className="mt-1 text-[11px] text-zinc-400">
                              {new Date(notification.createdAt).toLocaleString("es-EC")}
                            </p>
                          </button>
                          <div className="mt-2 flex justify-end">
                            <button
                              type="button"
                              onClick={() => void deleteNotification(notification.id)}
                              className="text-[10px] uppercase tracking-[0.12em] text-red-300 hover:text-red-200"
                            >
                              Eliminar
                            </button>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {loading ? (
            <div className="h-9 w-44 animate-pulse bg-white/10" />
          ) : session.authenticated ? (
            <>
              <div className="flex items-center gap-2 border border-white/15 bg-black/30 px-2 py-1">
                <div
                  className="h-8 w-8 rounded-full border border-white/20 bg-cover bg-center"
                  style={{ backgroundImage: `url(${session.user?.avatarUrl || "/images/owner-1.jpg"})` }}
                />
                <div className="max-w-36">
                  <span className="block truncate text-xs text-zinc-100">{session.user?.name}</span>
                  <span className="block text-[10px] uppercase tracking-[0.12em] text-emerald-300">
                    Perfil: {profileRole}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                className="border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white hover:border-white"
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white hover:border-white"
              >
                Log in
              </Link>
              <Link
                href="/auth/register"
                className="bg-zinc-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-black hover:bg-white"
              >
                Crear cuenta
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="border border-white/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white md:hidden"
        >
          {mobileOpen ? "Cerrar" : "Menú"}
        </button>
      </div>

      {mobileOpen ? (
        <div className="border-t border-white/10 bg-black/95 px-6 py-5 md:hidden">
          <nav className="grid gap-3 text-xs uppercase tracking-[0.14em] text-zinc-200">
            <Link href="/" className="hover:text-white" onClick={() => setMobileOpen(false)}>
              Inicio
            </Link>
            <Link href="/productos" className="hover:text-white" onClick={() => setMobileOpen(false)}>
              Productos
            </Link>
            {session.authenticated && hasConjunto ? (
              <Link
                href="/productos?scope=my_conjunto"
                className="hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                Mi conjunto
              </Link>
            ) : null}
            {session.authenticated ? (
              <Link href="/panel/reportes" className="hover:text-white" onClick={() => setMobileOpen(false)}>
                Reportes
              </Link>
            ) : null}
            {session.authenticated ? (
              <Link href="/panel/perfil" className="hover:text-white" onClick={() => setMobileOpen(false)}>
                Mi perfil
              </Link>
            ) : null}
            {session.authenticated ? (
              <Link href="/panel" className="hover:text-white" onClick={() => setMobileOpen(false)}>
                Mi panel
              </Link>
            ) : null}
          </nav>

          <div className="mt-4 flex flex-wrap gap-2">
            {session.authenticated ? (
              <>
                <div className="mb-2 flex w-full items-center gap-2 border border-white/15 bg-black/30 p-2">
                  <div
                    className="h-8 w-8 rounded-full border border-white/20 bg-cover bg-center"
                    style={{ backgroundImage: `url(${session.user?.avatarUrl || "/images/owner-1.jpg"})` }}
                  />
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-zinc-200">{session.user?.name}</p>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-emerald-300">
                      Perfil: {profileRole}
                    </p>
                  </div>
                </div>
                <p className="w-full text-xs uppercase tracking-[0.14em] text-zinc-400">
                  Notificaciones pendientes: {unreadCount}
                </p>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white"
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  onClick={() => setMobileOpen(false)}
                  className="border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white"
                >
                  Log in
                </Link>
                <Link
                  href="/auth/register"
                  onClick={() => setMobileOpen(false)}
                  className="bg-zinc-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-black"
                >
                  Crear cuenta
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
