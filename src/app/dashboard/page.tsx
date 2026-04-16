"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/panel");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070b10] text-zinc-100">
      <p className="text-zinc-300">Redirigiendo al panel...</p>
    </main>
  );
}
