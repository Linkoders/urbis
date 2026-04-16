"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function CatalogRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const query = window.location.search;
    router.replace(query ? `/productos${query}` : "/productos");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070b10] text-zinc-100">
      <p className="text-zinc-300">Redirigiendo a productos...</p>
    </main>
  );
}
