"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "No se pudo iniciar sesión.");
        return;
      }

      router.push("/productos?scope=my_conjunto");
      router.refresh();
    } catch {
      setError("Ocurrió un error al iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070b10] px-6 py-16 text-zinc-100">
      <div className="w-full max-w-xl border border-white/10 bg-black/40 p-8 backdrop-blur-sm sm:p-10 fade-up">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Acceso URBIS</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-semibold sm:text-5xl">
          Iniciar sesión
        </h1>
        <p className="mt-4 text-zinc-300">
          Ingresa con tu cuenta para gestionar URBIS.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm uppercase tracking-wider text-zinc-300">Email</span>
            <input
              type="email"
              suppressHydrationWarning
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
              suppressHydrationWarning
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full border border-white/20 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
              required
            />
          </label>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <button
            type="submit"
            suppressHydrationWarning
            disabled={loading}
            className="w-full bg-zinc-100 px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-black transition hover:bg-white disabled:opacity-70"
          >
            {loading ? "Ingresando..." : "Entrar"}
          </button>
        </form>

        <div className="mt-8 flex flex-wrap gap-4 text-sm uppercase tracking-[0.12em] text-zinc-300">
          <Link href="/auth/register" className="hover:text-white">
            Crear cuenta
          </Link>
          <Link href="/" className="hover:text-white">
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
