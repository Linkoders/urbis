"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FullScreenSpinner } from "@/components/spinner";

interface SessionUser {
  id: string;
  role: "resident" | "admin_conjunto" | "superadmin";
  conjuntoId: string | null;
}

interface ConjuntoCard {
  id: string;
  name: string;
  slug: string;
  location: string;
  description: string;
  logoUrl: string | null;
  status: string;
  emprendimientosCount: number;
  productsCount: number;
}

interface EmprendimientoCard {
  id: string;
  name: string;
  description: string;
  logoUrl: string | null;
  visibility: "public" | "internal";
  status: string;
  productsCount: number;
}

interface PendingConjuntoRequest {
  id: string;
  nameRequested: string;
  location: string;
  description: string;
  logoUrl: string | null;
  contactEmail: string;
  createdAt: string;
}

interface PendingPlusRequest {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  proofUrl: string | null;
  amountUsd: number;
  requestedAt: string;
}

async function callAction(action: string, data: Record<string, unknown>) {
  const response = await fetch("/api/platform/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, data }),
  });

  const result = (await response.json()) as { message?: string; error?: string };
  if (!response.ok) {
    throw new Error(result.error ?? "No se pudo ejecutar la accion.");
  }

  return result.message ?? "Operacion completada.";
}

export default function PanelPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [conjuntos, setConjuntos] = useState<ConjuntoCard[]>([]);
  const [emprendimientos, setEmprendimientos] = useState<EmprendimientoCard[]>([]);
  const [pendingConjuntoRequests, setPendingConjuntoRequests] = useState<PendingConjuntoRequest[]>([]);
  const [pendingPlusRequests, setPendingPlusRequests] = useState<PendingPlusRequest[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{
    kind: "conjunto" | "emprendimiento";
    id: string;
    name: string;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");

    const response = await fetch("/api/platform/hierarchy", { cache: "no-store" });
    if (!response.ok) {
      setError("Inicia sesión para ver este panel.");
      setLoading(false);
      return;
    }

    const data = (await response.json()) as {
      user: SessionUser;
      conjuntos?: ConjuntoCard[];
      emprendimientos?: EmprendimientoCard[];
      pendingConjuntoRequests?: PendingConjuntoRequest[];
      pendingPlusRequests?: PendingPlusRequest[];
    };

    setUser(data.user);
    setConjuntos(data.conjuntos ?? []);
    setEmprendimientos(data.emprendimientos ?? []);
    setPendingConjuntoRequests(
      data.user.role === "superadmin" ? data.pendingConjuntoRequests ?? [] : [],
    );
    setPendingPlusRequests(data.user.role === "superadmin" ? data.pendingPlusRequests ?? [] : []);

    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, []);

  async function removeConjunto(conjuntoId: string) {
    setMessage("");
    setError("");

    try {
      const result = await callAction("delete_conjunto", { conjuntoId });
      setMessage(result);
      await loadData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "No se pudo eliminar conjunto.");
    }
  }

  async function removeEmprendimiento(emprendimientoId: string) {
    setMessage("");
    setError("");

    try {
      const result = await callAction("delete_emprendimiento", { emprendimientoId });
      setMessage(result);
      await loadData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "No se pudo eliminar emprendimiento.");
    }
  }

  async function processConjuntoRequest(requestId: string, status: "approved" | "rejected") {
    setMessage("");
    setError("");

    try {
      const result = await callAction("set_conjunto_request_status", { requestId, status });
      setMessage(result);
      await loadData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "No se pudo procesar la solicitud.");
    }
  }

  async function processEmprendimientoStatus(
    emprendimientoId: string,
    status: "approved" | "rejected" | "suspended",
  ) {
    setMessage("");
    setError("");

    try {
      const result = await callAction("set_emprendimiento_status", { emprendimientoId, status });
      setMessage(result);
      await loadData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "No se pudo actualizar el estado.");
    }
  }

  async function processPlusRequest(userId: string, status: "active" | "rejected") {
    setMessage("");
    setError("");

    try {
      const result = await callAction("set_plus_status", { userId, status });
      setMessage(result);
      await loadData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "No se pudo procesar la solicitud Plus.");
    }
  }

  async function confirmDeleteAction() {
    if (!confirmDelete) {
      return;
    }

    setConfirmLoading(true);
    if (confirmDelete.kind === "conjunto") {
      await removeConjunto(confirmDelete.id);
    } else {
      await removeEmprendimiento(confirmDelete.id);
    }
    setConfirmLoading(false);
    setConfirmDelete(null);
  }

  if (loading) {
    return <FullScreenSpinner label="Cargando panel" />;
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070b10] px-6 text-zinc-100">
        <div className="max-w-2xl border border-white/10 bg-black/30 p-8">
          <p className="text-zinc-300">{error || "No autorizado."}</p>
          <Link href="/auth/login" className="mt-4 inline-block text-emerald-300 hover:text-emerald-200">
            Ir a iniciar sesión
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070b10] px-6 py-10 text-zinc-100 lg:px-12 urbis-watermark">
      <section className="mx-auto max-w-[1320px] space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Panel URBIS</p>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-5xl font-semibold text-white">
              {user.role === "superadmin"
                ? "Conjuntos registrados"
                : user.role === "admin_conjunto"
                  ? "Emprendimientos de tu comunidad"
                  : "Mis emprendimientos"}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/panel/perfil"
              className="border border-white/30 px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] hover:border-white"
            >
              Mi perfil
            </Link>
            <Link
              href="/panel/reportes"
              className="border border-white/30 px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] hover:border-white"
            >
              Ver reportes
            </Link>
            {user.role === "resident" ? (
              <Link
                href="/panel/emprendimientos/nuevo"
                className="bg-zinc-100 px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-black hover:bg-white"
              >
                Nuevo emprendimiento
              </Link>
            ) : null}
          </div>
        </header>

        {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        {user.role === "superadmin" ? (
          <div className="space-y-10">
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-white">Solicitudes pendientes de conjunto</h2>
              {pendingConjuntoRequests.length === 0 ? (
                <p className="text-sm text-zinc-400">No hay solicitudes pendientes por aprobar.</p>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {pendingConjuntoRequests.map((request) => (
                    <article key={request.id} className="border border-white/10 bg-black/25 p-5">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-14 w-14 rounded-full border border-white/20 bg-cover bg-center"
                          style={{
                            backgroundImage: `url(${request.logoUrl || "/images/owner-1.jpg"})`,
                          }}
                        />
                        <div>
                          <p className="text-sm font-semibold text-white">{request.nameRequested}</p>
                          <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">{request.location}</p>
                        </div>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm text-zinc-300">
                        {request.description || "Sin descripción"}
                      </p>
                      <p className="mt-2 text-xs text-zinc-400">{request.contactEmail}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void processConjuntoRequest(request.id, "approved")}
                          className="border border-emerald-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200 hover:bg-emerald-500/10"
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          onClick={() => void processConjuntoRequest(request.id, "rejected")}
                          className="border border-red-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-red-200 hover:bg-red-500/10"
                        >
                          Rechazar
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-white">Solicitudes Plus pendientes</h2>
              {pendingPlusRequests.length === 0 ? (
                <p className="text-sm text-zinc-400">No hay solicitudes Plus pendientes.</p>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {pendingPlusRequests.map((request) => (
                    <article key={request.userId} className="border border-white/10 bg-black/25 p-5">
                      <p className="text-sm font-semibold text-white">{request.name}</p>
                      <p className="mt-1 text-xs text-zinc-300">{request.email}</p>
                      <p className="text-xs text-zinc-400">{request.phone || "Sin teléfono"}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.12em] text-cyan-300">
                        Monto esperado: USD {request.amountUsd.toFixed(2)}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Solicitado: {new Date(request.requestedAt).toLocaleString("es-EC")}
                      </p>
                      {request.proofUrl ? (
                        <a
                          href={request.proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-block text-xs text-cyan-300 underline"
                        >
                          Ver comprobante
                        </a>
                      ) : (
                        <p className="mt-3 text-xs text-amber-300">Sin comprobante adjunto.</p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void processPlusRequest(request.userId, "active")}
                          className="border border-emerald-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200 hover:bg-emerald-500/10"
                        >
                          Aprobar Plus
                        </button>
                        <button
                          type="button"
                          onClick={() => void processPlusRequest(request.userId, "rejected")}
                          className="border border-red-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-red-200 hover:bg-red-500/10"
                        >
                          Rechazar
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-white">Conjuntos registrados</h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {conjuntos.map((conjunto) => (
                  <article key={conjunto.id} className="border border-white/10 bg-black/25 p-5">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-14 w-14 rounded-full border border-white/20 bg-cover bg-center"
                        style={{
                          backgroundImage: `url(${conjunto.logoUrl || "/images/owner-1.jpg"})`,
                        }}
                      />
                      <div>
                        <p className="text-sm font-semibold text-white">{conjunto.name}</p>
                        <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">{conjunto.location}</p>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-zinc-300">{conjunto.description}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.12em] text-zinc-400">
                      {conjunto.emprendimientosCount} emprendimientos - {conjunto.productsCount} productos
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/panel/conjuntos/${conjunto.id}`}
                        className="border border-white/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white"
                      >
                        Ver emprendimientos
                      </Link>
                      <Link
                        href={`/panel/conjuntos/${conjunto.id}/editar`}
                        className="border border-white/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white"
                      >
                        Editar
                      </Link>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDelete({
                            kind: "conjunto",
                            id: conjunto.id,
                            name: conjunto.name,
                          })
                        }
                        className="border border-red-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-red-200 hover:bg-red-500/10"
                      >
                        Eliminar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {emprendimientos.map((emprendimiento) => (
              <article
                key={emprendimiento.id}
                onClick={() => router.push(`/panel/emprendimientos/${emprendimiento.id}`)}
                className="cursor-pointer border border-white/10 bg-black/25 p-5 transition hover:border-emerald-300/60"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-14 w-14 rounded-full border border-white/20 bg-cover bg-center"
                    style={{
                      backgroundImage: `url(${emprendimiento.logoUrl || "/images/market-woman.jpg"})`,
                    }}
                  />
                  <div>
                    <p className="text-sm font-semibold text-white">{emprendimiento.name}</p>
                    <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">{emprendimiento.status}</p>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-zinc-300">{emprendimiento.description}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.12em] text-zinc-400">
                  {emprendimiento.productsCount} productos -{" "}
                  {emprendimiento.visibility === "public" ? "visible para todos" : "solo conjunto"}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link
                    href={`/panel/emprendimientos/${emprendimiento.id}`}
                    onClick={(event) => event.stopPropagation()}
                    className="border border-white/30 px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] hover:border-white"
                  >
                    Ver productos
                  </Link>
                  {user.role === "admin_conjunto" ? (
                    <>
                      {emprendimiento.status !== "approved" ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void processEmprendimientoStatus(emprendimiento.id, "approved");
                          }}
                          className="border border-emerald-300 px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200 hover:bg-emerald-500/10"
                        >
                          Aprobar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void processEmprendimientoStatus(emprendimiento.id, "suspended");
                          }}
                          className="border border-amber-300 px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-amber-200 hover:bg-amber-500/10"
                        >
                          Suspender
                        </button>
                      )}
                      {emprendimiento.status !== "rejected" ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void processEmprendimientoStatus(emprendimiento.id, "rejected");
                          }}
                          className="border border-red-300 px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-red-200 hover:bg-red-500/10"
                        >
                          Rechazar
                        </button>
                      ) : null}
                    </>
                  ) : null}
                  <Link
                    href={`/panel/emprendimientos/${emprendimiento.id}/editar`}
                    onClick={(event) => event.stopPropagation()}
                    className="border border-white/30 px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] hover:border-white"
                  >
                    Editar
                  </Link>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setConfirmDelete({
                        kind: "emprendimiento",
                        id: emprendimiento.id,
                        name: emprendimiento.name,
                      });
                    }}
                  className="col-span-2 border border-red-300 px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-red-200 hover:bg-red-500/10"
                >
                  Eliminar
                </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Seguro que deseas eliminar?"
        description={
          confirmDelete
            ? `Se eliminara "${confirmDelete.name}" y la informacion relacionada.`
            : ""
        }
        loading={confirmLoading}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => void confirmDeleteAction()}
      />
    </main>
  );
}
