type SpinnerSize = "sm" | "md" | "lg";

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}

function spinnerSizeClass(size: SpinnerSize): string {
  if (size === "sm") return "h-4 w-4 border-2";
  if (size === "lg") return "h-10 w-10 border-4";
  return "h-6 w-6 border-2";
}

export function Spinner({ size = "md", className = "", label }: SpinnerProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`${spinnerSizeClass(size)} animate-spin rounded-full border-white/20 border-t-emerald-300`}
        aria-hidden="true"
      />
      {label ? <span className="text-sm text-zinc-300">{label}</span> : null}
    </span>
  );
}

export function FullScreenSpinner({ label }: { label: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070b10] text-zinc-100">
      <Spinner size="lg" label={label} />
    </main>
  );
}

