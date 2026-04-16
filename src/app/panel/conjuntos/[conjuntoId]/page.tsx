"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface SessionUser {
  id: string;
  role: "resident" | "admin_conjunto" | "superadmin";
  conjuntoId: string | null;
}

interface ConjuntoData {
  id: string;
  name: string;
  slug: string;
  location: string;
  logoUrl: string | null;
}

interface EmprendimientoCard {
  id: string;
  name: string;
  description: string;
  logoUrl: string | null;
  visibility: "public" | "internal";
  status: string;
  ownerId: string;
  contactEmail: string | null;
  contactPhone: string | null;
  productsCount: number;
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

export default function ConjuntoPanelPage() {
  const params = useParams<{ conjuntoId: string }>();
  const conjuntoId = String(params?.conjuntoId ?? "");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [conjunto, setConjunto] = useState<ConjuntoData | null>(null);
  const [emprendimientos, setEmprendimientos] = useState<EmprendimientoCard[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{
    kind: "conjunto" | "emprendimiento";
    id: string;
    name: string;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    const response = await fetch(`/api/platform/hierarchy?conjuntoId=${conjuntoId}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "No se pudo cargar el conjunto.");
      setLoading(false);
      return;
    }

    const data = (await response.json()) as {
      user: SessionUser;
      conjunto: ConjuntoData;
      emprendimientos: EmprendimientoCard[];
    };

    setUser(data.user);
    setConjunto(data.conjunto);
    setEmprendimientos(data.emprendimientos ?? []);
    setLoading(false);
  }, [conjuntoId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  async function removeConjunto() {
    if (!conjunto) {
      return;
    }

    setMessage("");
    setError("");
    try {
      const result = await callAction("delete_conjunto", { conjuntoId: conjunto.id });
      setMessage(result);
      setTimeout(() => {
        window.location.href = "/panel";
      }, 350);
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

  async function confirmDeleteAction() {
    if (!confirmDelete) {
      return;
    }

    setConfirmLoading(true);
    if (confirmDelete.kind === "conjunto") {
      await removeConjunto();
    } else {
      await removeEmprendimiento(confirmDelete.id);
    }
    setConfirmLoading(false);
    setConfirmDelete(null);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070b10] text-zinc-100">
        <p className="text-zinc-300">Cargando emprendimientos...</p>
      </main>
    );
  }

  if (!conjunto || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070b10] px-6 text-zinc-100">
        <div className="max-w-2xl border border-white/10 bg-black/30 p-8">
          <p className="text-red-300">{error || "No autorizado."}</p>
          <Link href="/panel" className="mt-4 inline-block text-emerald-300 hover:text-emerald-200">
            Volver al panel
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070b10] px-6 py-10 text-zinc-100 lg:px-12 urbis-watermark">
      <section className="mx-auto max-w-[1320px] space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <div
              className="h-16 w-16 rounded-full border border-white/20 bg-cover bg-center"
              style={{
                backgroundImage: `url(${conjunto.logoUrl || "/images/owner-1.jpg"})`,
              }}
            />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Conjunto</p>
              <h1 className="mt-1 font-[family-name:var(--font-display)] text-5xl font-semibold text-white">
                {conjunto.name}
              </h1>
              <p className="mt-1 text-zinc-300">{conjunto.location}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/panel"
              className="border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white"
            >
              Volver
            </Link>
            {(user.role === "superadmin" || user.role === "admin_conjunto") ? (
              <Link
                href={`/panel/conjuntos/${conjunto.id}/editar`}
                className="border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white"
              >
                Editar conjunto
              </Link>
            ) : null}
            {user.role === "superadmin" ? (
              <button
                type="button"
                onClick={() =>
                  setConfirmDelete({
                    kind: "conjunto",
                    id: conjunto.id,
                    name: conjunto.name,
                  })
                }
                className="border border-red-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-red-200 hover:bg-red-500/10"
              >
                Eliminar conjunto
              </button>
            ) : null}
          </div>
        </header>

        {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {emprendimientos.map((emprendimiento) => (
            <article key={emprendimiento.id} className="border border-white/10 bg-black/25 p-5">
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
                  className="border border-white/30 px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] hover:border-white"
                >
                  Ver productos
                </Link>
                {(user.role === "admin_conjunto" || user.role === "superadmin") ? (
                  <>
                    {emprendimiento.status !== "approved" ? (
                      <button
                        type="button"
                        onClick={() => void processEmprendimientoStatus(emprendimiento.id, "approved")}
                        className="border border-emerald-300 px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200 hover:bg-emerald-500/10"
                      >
                        Aprobar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void processEmprendimientoStatus(emprendimiento.id, "suspended")}
                        className="border border-amber-300 px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-amber-200 hover:bg-amber-500/10"
                      >
                        Suspender
                      </button>
                    )}
                    {emprendimiento.status !== "rejected" ? (
                      <button
                        type="button"
                        onClick={() => void processEmprendimientoStatus(emprendimiento.id, "rejected")}
                        className="border border-red-300 px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-red-200 hover:bg-red-500/10"
                      >
                        Rechazar
                      </button>
                    ) : null}
                  </>
                ) : null}
                <Link
                  href={`/panel/emprendimientos/${emprendimiento.id}/editar`}
                  className="border border-white/30 px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] hover:border-white"
                >
                  Editar
                </Link>
                <button
                  type="button"
                  onClick={() =>
                    setConfirmDelete({
                      kind: "emprendimiento",
                      id: emprendimiento.id,
                      name: emprendimiento.name,
                    })
                  }
                  className="col-span-2 border border-red-300 px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-red-200 hover:bg-red-500/10"
                >
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Seguro que deseas eliminar?"
        description={
          confirmDelete
            ? `Se eliminara "${confirmDelete.name}" y su informacion relacionada.`
            : ""
        }
        loading={confirmLoading}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => void confirmDeleteAction()}
      />
    </main>
  );
}
