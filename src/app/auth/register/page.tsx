"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ShieldIcon, StoreIcon, UserGroupIcon } from "@/components/ui-icons";
import { uploadImageFiles } from "@/lib/upload-client";

interface ConjuntoOption {
  id: string;
  name: string;
  slug: string;
  location: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<"resident" | "admin_conjunto">("resident");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");

  const [conjuntoSlug, setConjuntoSlug] = useState("");
  const [requestedConjuntoName, setRequestedConjuntoName] = useState("");
  const [requestedConjuntoLocation, setRequestedConjuntoLocation] = useState("");
  const [requestedConjuntoDescription, setRequestedConjuntoDescription] = useState("");
  const [requestedConjuntoLogoFile, setRequestedConjuntoLogoFile] = useState<File | null>(null);
  const [requestedConjuntoLogoPreview, setRequestedConjuntoLogoPreview] = useState("");

  const [conjuntos, setConjuntos] = useState<ConjuntoOption[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadConjuntos() {
      const response = await fetch("/api/public/conjuntos", { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as { conjuntos: ConjuntoOption[] };
      setConjuntos(data.conjuntos ?? []);
    }

    void loadConjuntos();
  }, []);

  useEffect(() => {
    return () => {
      if (avatarPreview.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreview);
      }
      if (requestedConjuntoLogoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(requestedConjuntoLogoPreview);
      }
    };
  }, [avatarPreview, requestedConjuntoLogoPreview]);

  function updateAvatarFile(file: File | null) {
    if (avatarPreview.startsWith("blob:")) {
      URL.revokeObjectURL(avatarPreview);
    }

    setAvatarFile(file);
    setAvatarPreview(file ? URL.createObjectURL(file) : "");
  }

  function updateConjuntoLogoFile(file: File | null) {
    if (requestedConjuntoLogoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(requestedConjuntoLogoPreview);
    }

    setRequestedConjuntoLogoFile(file);
    setRequestedConjuntoLogoPreview(file ? URL.createObjectURL(file) : "");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!avatarFile) {
        setError("Debes subir una foto de perfil (rostro) para crear la cuenta.");
        setLoading(false);
        return;
      }

      const [uploadedAvatarUrl] = await uploadImageFiles([avatarFile]);
      const avatarUrl = uploadedAvatarUrl ?? "";
      if (!avatarUrl) {
        setError("No se pudo guardar tu foto de perfil.");
        setLoading(false);
        return;
      }

      let requestedConjuntoLogoUrl = "";
      if (role === "admin_conjunto" && requestedConjuntoLogoFile) {
        const [uploadedUrl] = await uploadImageFiles([requestedConjuntoLogoFile]);
        requestedConjuntoLogoUrl = uploadedUrl ?? "";
      }

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          name,
          email,
          password,
          avatarUrl,
          conjuntoSlug,
          acceptedTerms,
          requestedConjuntoName,
          requestedConjuntoLocation,
          requestedConjuntoDescription,
          requestedConjuntoLogoUrl,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "No se pudo crear la cuenta.");
        return;
      }

      router.push("/productos?scope=my_conjunto");
      router.refresh();
    } catch {
      setError("Ocurrió un error al crear la cuenta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="urbis-watermark flex min-h-screen items-center justify-center bg-[#070b10] px-6 py-16 text-zinc-100">
      <div className="fade-up w-full max-w-2xl border border-white/10 bg-black/35 p-8 backdrop-blur-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Registro URBIS</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-semibold sm:text-5xl">
          Crear cuenta
        </h1>
        <p className="mt-4 text-zinc-300">Elige el tipo de cuenta y completa los datos para empezar en URBIS.</p>

        <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setRole("resident")}
              className={`border p-4 text-left transition ${role === "resident" ? "border-emerald-300 bg-emerald-300/10" : "border-white/20 bg-black/25 hover:border-white/40"}`}
            >
              <UserGroupIcon className="h-6 w-6 text-emerald-300" />
              <p className="mt-3 text-sm font-semibold uppercase tracking-[0.12em] text-white">Residente</p>
              <p className="mt-1 text-sm text-zinc-300">Compra, publica y vende en tu conjunto.</p>
            </button>
            <button
              type="button"
              onClick={() => setRole("admin_conjunto")}
              className={`border p-4 text-left transition ${role === "admin_conjunto" ? "border-emerald-300 bg-emerald-300/10" : "border-white/20 bg-black/25 hover:border-white/40"}`}
            >
              <ShieldIcon className="h-6 w-6 text-cyan-300" />
              <p className="mt-3 text-sm font-semibold uppercase tracking-[0.12em] text-white">Administrador de conjunto</p>
              <p className="mt-1 text-sm text-zinc-300">Solicita el alta de tu conjunto y luego gestiona su comunidad.</p>
            </button>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm uppercase tracking-wider text-zinc-300">Nombre completo</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full border border-white/20 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm uppercase tracking-wider text-zinc-300">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full border border-white/20 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm uppercase tracking-wider text-zinc-300">Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full border border-white/20 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
              required
            />
          </label>

          <div className="space-y-3 border border-white/10 bg-black/20 p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white">Foto de perfil (rostro real)</p>
            <p className="text-xs text-zinc-400">
              Esta imagen es obligatoria para crear la cuenta y mejorar la confianza entre vecinos.
            </p>
            <input
              type="file"
              accept="image/*"
              capture="user"
              onChange={(event) => updateAvatarFile(event.target.files?.[0] ?? null)}
              className="w-full border border-white/20 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
              required
            />
            <div className="flex items-center gap-3 border border-white/20 bg-black/25 px-3 py-2">
              <div
                className="h-12 w-12 rounded-full border border-white/20 bg-cover bg-center"
                style={{
                  backgroundImage: `url(${avatarPreview || "/images/owner-1.jpg"})`,
                }}
              />
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Vista previa del perfil</p>
            </div>
          </div>

          {role === "resident" ? (
            <label className="block">
              <span className="mb-2 block text-sm uppercase tracking-wider text-zinc-300">Conjunto (obligatorio)</span>
              <select
                value={conjuntoSlug}
                onChange={(event) => setConjuntoSlug(event.target.value)}
                className="w-full border border-white/20 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
                required
              >
                <option value="">Selecciona tu conjunto</option>
                {conjuntos.map((conjunto) => (
                  <option key={conjunto.id} value={conjunto.slug}>
                    {conjunto.name} - {conjunto.location}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="space-y-3 border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-sm text-zinc-300">
                <StoreIcon className="h-5 w-5 text-cyan-300" />
                <span>Datos del conjunto a registrar</span>
              </div>
              <input
                value={requestedConjuntoName}
                onChange={(event) => setRequestedConjuntoName(event.target.value)}
                placeholder="Nombre del conjunto"
                className="w-full border border-white/20 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
                required
              />
              <input
                value={requestedConjuntoLocation}
                onChange={(event) => setRequestedConjuntoLocation(event.target.value)}
                placeholder="Ubicación"
                className="w-full border border-white/20 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
                required
              />
              <input
                type="file"
                accept="image/*"
                onChange={(event) => updateConjuntoLogoFile(event.target.files?.[0] ?? null)}
                className="w-full border border-white/20 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
              />
              <div className="flex items-center gap-3 border border-white/20 bg-black/25 px-3 py-2">
                <div
                  className="h-10 w-10 rounded-full border border-white/20 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${requestedConjuntoLogoPreview || "/images/owner-1.jpg"})`,
                  }}
                />
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Vista previa del logo</p>
              </div>
              <textarea
                value={requestedConjuntoDescription}
                onChange={(event) => setRequestedConjuntoDescription(event.target.value)}
                placeholder="Descripción breve del conjunto"
                rows={3}
                className="w-full border border-white/20 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
              />
            </div>
          )}

          <label className="flex items-start gap-3 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              className="mt-1 h-4 w-4 accent-emerald-400"
              required
            />
            <span>
              Acepto los{" "}
              <Link href="/terminos-y-condiciones" className="text-emerald-300 hover:text-emerald-200">
                términos y condiciones
              </Link>{" "}
              de URBIS.
            </span>
          </label>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-zinc-100 px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-black transition hover:bg-white disabled:opacity-70"
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        <div className="mt-8 flex flex-wrap gap-4 text-sm uppercase tracking-[0.12em] text-zinc-300">
          <Link href="/auth/login" className="hover:text-white">
            Ya tengo cuenta
          </Link>
          <Link href="/" className="hover:text-white">
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
