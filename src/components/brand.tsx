import Link from "next/link";
export function PiperMark({ className = "" }: { className?: string }) {
  return (
    <span className={`piper-mark ${className}`} aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path
          d="M8 25V9c0-4 8-5 8 0v15M16 24V6c0-4 8-4 8 1v18"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M6 17h20"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      className={`brand ${light ? "brand-light" : ""}`}
      href="/"
      aria-label="Pied Piper home"
    >
      <PiperMark />
      <span>
        pied piper<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
