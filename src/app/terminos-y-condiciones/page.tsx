import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#070b10] px-6 py-16 text-zinc-100 lg:px-12 urbis-watermark">
      <section className="mx-auto max-w-4xl border border-white/10 bg-black/30 p-8 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
          Términos y condiciones
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-semibold text-white sm:text-5xl">
          Reglas de uso de URBIS
        </h1>
        <p className="mt-6 text-zinc-300">
          Al usar URBIS, aceptas que esta plataforma conecta compradores y vendedores de comunidades,
          pero no actúa como parte de la transacción comercial.
        </p>

        <div className="mt-8 space-y-5 text-zinc-300">
          <section>
            <h2 className="text-xl font-semibold text-white">1. Responsabilidad de publicaciones</h2>
            <p className="mt-2">
              Cada usuario es responsable del contenido, calidad, entrega, garantía y cumplimiento de lo que publica o vende.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">2. Límite de responsabilidad de Linekoders</h2>
            <p className="mt-2">
              Linekoders y URBIS no se responsabilizan por estafas, pérdidas económicas, incumplimientos,
              conflictos entre usuarios, daños indirectos o reseñas negativas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">3. Prohibiciones</h2>
            <p className="mt-2">
              Está prohibido publicar productos o servicios ilegales, actividades en contra de la ley,
              contenido fraudulento, suplantación de identidad, lavado de activos o cualquier actividad delictiva.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">4. Reportes y acciones</h2>
            <p className="mt-2">
              URBIS puede suspender o bloquear cuentas, retirar publicaciones y conservar evidencia cuando existan
              indicios de incumplimiento. Si se detectan posibles delitos, se notificará a autoridades competentes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">5. Marco legal referencial (Ecuador)</h2>
            <p className="mt-2">
              Estas reglas se aplican junto con la legislación vigente en Ecuador, incluyendo el COIP,
              la Ley de Comercio Electrónico, Firmas Electrónicas y Mensajes de Datos, y la Ley Orgánica
              de Protección de Datos Personales, según corresponda.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">6. Aceptación</h2>
            <p className="mt-2">
              Al crear una cuenta y marcar aceptación, confirmas que leíste y aceptas estos términos.
            </p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-4 text-sm uppercase tracking-[0.12em]">
          <Link href="/auth/register" className="bg-zinc-100 px-5 py-3 font-semibold text-black hover:bg-white">
            Volver a registro
          </Link>
          <Link href="/" className="border border-white/30 px-5 py-3 font-semibold text-white hover:border-white">
            Ir al inicio
          </Link>
        </div>
      </section>
    </main>
  );
}
