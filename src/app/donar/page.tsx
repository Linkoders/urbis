import Link from "next/link";

const donationPichinchaAccountNumber =
  process.env.NEXT_PUBLIC_PICHINCHA_ACCOUNT_NUMBER?.trim() ?? "";
const donationPichinchaAccountType =
  process.env.NEXT_PUBLIC_PICHINCHA_ACCOUNT_TYPE?.trim() ?? "Cuenta de ahorros";
const donationPichinchaAccountHolder =
  process.env.NEXT_PUBLIC_PICHINCHA_ACCOUNT_HOLDER?.trim() ?? "URBIS / Linekoders";

export default function DonarPage() {
  return (
    <main className="min-h-screen bg-[#080b0f] px-6 py-14 text-zinc-100 lg:px-12">
      <section className="mx-auto max-w-[1100px] space-y-8">
        <div className="space-y-4">
          <Link
            href="/#apoyo"
            className="inline-block text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300 hover:text-emerald-200"
          >
            Volver a apoyo
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Donaciones URBIS
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-5xl font-semibold leading-tight text-white sm:text-6xl">
            Ayuda a que URBIS siga creciendo
          </h1>
          <p className="max-w-3xl text-lg leading-relaxed text-zinc-300">
            Tu aporte nos ayuda a mantener la infraestructura, sostener servicios y acelerar mejoras para comunidades y
            emprendedores locales.
          </p>
        </div>

        <article className="border border-white/20 bg-black/30 p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Depósito Banco Pichincha</p>
          <p className="mt-3 text-sm leading-7 text-zinc-300">
            Por ahora los aportes y pagos se realizan únicamente por depósito o transferencia a la cuenta de Pichincha.
          </p>
          <div className="mt-4 grid gap-3 text-sm text-zinc-200 sm:grid-cols-3">
            <p>
              <span className="font-semibold">Titular:</span> {donationPichinchaAccountHolder}
            </p>
            <p>
              <span className="font-semibold">Tipo:</span> {donationPichinchaAccountType}
            </p>
            <p>
              <span className="font-semibold">Cuenta:</span>{" "}
              {donationPichinchaAccountNumber || "Pendiente de configurar"}
            </p>
          </div>
        </article>
      </section>
    </main>
  );
}
