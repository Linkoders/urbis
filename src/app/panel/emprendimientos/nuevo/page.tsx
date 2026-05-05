"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { uploadImageFiles } from "@/lib/upload-client";

interface SessionUser {
  id: string;
  role: "resident" | "admin_conjunto" | "superadmin";
}

export default function NewEmprendimientoPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<1 | 2>(1);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("/images/market-woman.jpg");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [visibility, setVisibility] = useState<"public" | "internal">("public");

  useEffect(() => {
    async function loadSession() {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      if (!response.ok) {
        setUser(null);
        return;
      }

      const data = (await response.json()) as { authenticated: boolean; user: SessionUser };
      setUser(data.user);
    }

    void loadSession();
  }, []);

async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nativeEvent = event.nativeEvent as SubmitEvent;
    const submitter = nativeEvent.submitter as HTMLElement | null;
    const isExplicitCreate = submitter?.getAttribute("data-action") === "create-emprendimiento";
    if (step !== 2 || !isExplicitCreate) {
      return;
    }

    setError("");
    setLoading(true);

    let logoUrl = "/images/market-woman.jpg";
    if (logoFile) {
      try {
        const [uploadedUrl] = await uploadImageFiles([logoFile]);
        logoUrl = uploadedUrl ?? logoUrl;
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : "No se pudo subir el logo.");
        setLoading(false);
        return;
      }
    }

    const response = await fetch("/api/platform/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_emprendimiento",
        data: {
          name,
          description,
          logoUrl,
          contactEmail,
          contactPhone,
          visibility,
        },
      }),
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "No se pudo crear el emprendimiento.");
      setLoading(false);
      return;
    }

    router.push("/panel");
    router.refresh();
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070b10] px-6 text-zinc-100">
        <div className="max-w-xl border border-white/10 bg-black/30 p-8">
          <p className="text-zinc-300">Inicia sesión para crear emprendimientos.</p>
          <Link href="/auth/login" className="mt-4 inline-block text-emerald-300 hover:text-emerald-200">
            Ir a login
          </Link>
        </div>
      </main>
    );
  }

  if (user.role !== "resident") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070b10] px-6 text-zinc-100">
        <div className="max-w-xl border border-white/10 bg-black/30 p-8">
          <p className="text-zinc-300">Solo residentes pueden crear emprendimientos.</p>
          <Link href="/panel" className="mt-4 inline-block text-emerald-300 hover:text-emerald-200">
            Volver al panel
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070b10] px-6 py-10 text-zinc-100 lg:px-12 urbis-watermark">
      <section className="mx-auto max-w-3xl space-y-6">
        <header className="border-b border-white/10 pb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Nuevo emprendimiento</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-5xl font-semibold text-white">
            Crea tu emprendimiento
          </h1>
        </header>

        <div className="grid grid-cols-2 gap-2">
          {[1, 2].map((entry) => (
            <div key={entry} className={`h-1.5 ${step >= entry ? "bg-emerald-300" : "bg-white/20"}`} />
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4 border border-white/10 bg-black/25 p-6">
          {step === 1 ? (
            <>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nombre del emprendimiento"
                className="w-full border border-white/20 bg-black/40 px-4 py-3"
                required
              />
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Descripción"
                rows={4}
                className="w-full border border-white/20 bg-black/40 px-4 py-3"
                required
              />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setLogoFile(file);
                    if (!file) {
                      setLogoPreview("/images/market-woman.jpg");
                      return;
                    }
                    setLogoPreview(URL.createObjectURL(file));
                  }}
                  className="w-full border border-white/20 bg-black/40 px-4 py-3"
                />
                <div className="flex items-center gap-3 border border-white/15 bg-black/30 px-3 py-2">
                  <div
                    className="h-10 w-10 rounded-full border border-white/20 bg-cover bg-center"
                    style={{ backgroundImage: `url(${logoPreview})` }}
                  />
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">Vista previa del logo</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  placeholder="Email de contacto"
                  className="w-full border border-white/20 bg-black/40 px-4 py-3"
                />
                <input
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                  placeholder="Teléfono de contacto"
                  className="w-full border border-white/20 bg-black/40 px-4 py-3"
                />
              </div>
              <select
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as "public" | "internal")}
                className="w-full border border-white/20 bg-black/40 px-4 py-3"
              >
                <option value="public">Visible para todos</option>
                <option value="internal">Solo visible en mi conjunto</option>
              </select>
            </>
          ) : null}

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <div className="flex flex-wrap gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="border border-white/30 px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] hover:border-white"
              >
                Atrás
              </button>
            ) : null}
            {step === 1 ? (
              <button
                type="button"
                onClick={() => {
                  if (!name.trim() || !description.trim()) {
                    setError("Completa nombre y descripción para continuar.");
                    return;
                  }
                  setError("");
                  setStep(2);
                }}
                className="bg-zinc-100 px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-black hover:bg-white"
              >
                Continuar
              </button>
            ) : (
              <button
                type="submit"
                data-action="create-emprendimiento"
                disabled={loading}
                className="bg-zinc-100 px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-black hover:bg-white disabled:opacity-60"
              >
                {loading ? "Guardando..." : "Crear emprendimiento"}
              </button>
            )}
            <Link
              href="/panel"
              className="border border-white/30 px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] hover:border-white"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
