"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { getMyId } from "@/lib/client";
import { ArrowRight, Heart } from "./icons";

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

export function NavLinks() {
  const hasProfile = useSyncExternalStore(subscribe, () => Boolean(getMyId()), () => false);
  const path = usePathname();
  if (path === "/start") return null;
  return hasProfile ? (
    <Link href="/me" className={`btn text-sm py-2 px-4 ${path === "/me" ? "btn-primary" : "btn-ghost"}`}>
      <Heart size={15} filled={path === "/me"} /> My agent
    </Link>
  ) : (
    <Link href="/start" className="btn btn-grad text-sm py-2 px-4">
      Get started <ArrowRight size={15} />
    </Link>
  );
}
