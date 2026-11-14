"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { getMyId } from "@/lib/client";
import { ArrowRight } from "./icons";

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

export function StartCTA({ light = false }: { light?: boolean }) {
  const hasProfile = useSyncExternalStore(subscribe, () => Boolean(getMyId()), () => false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href={hasProfile ? "/me" : "/start"}
        className={`btn text-base sm:text-lg px-6 sm:px-7 py-3.5 ${light ? "bg-white text-plum hover:bg-cream shadow-lg" : "btn-grad"}`}
      >
        {hasProfile ? "Back to my agent" : "Create my agent"} <ArrowRight size={18} />
      </Link>
      {hasProfile ? (
        <Link href="/start" className={`btn ${light ? "text-white/90 hover:text-white" : "btn-ghost"}`}>
          Start over as someone new
        </Link>
      ) : (
        <span className={`text-sm ${light ? "text-white/80" : "text-muted"}`}>2 minutes · no sign-up · no swiping</span>
      )}
    </div>
  );
}
