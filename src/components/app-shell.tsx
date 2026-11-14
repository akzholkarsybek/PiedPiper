"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Heart,
  MessageCircle,
  SlidersHorizontal,
  ShieldCheck,
  ArrowUpRight,
  Sparkles,
  Bot,
  MessagesSquare,
} from "lucide-react";
import { Brand, PiperMark } from "./brand";
import { useDemo, getStorageError } from "@/lib/demo-store";
import { Button } from "./ui/button";
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname(),
    state = useDemo();
  const nav = [
    {
      href: "/matchmaker",
      label: "My AI Matchmaker",
      short: "Matchmaker",
      icon: Bot,
    },
    { href: "/discover", label: "Discover", short: "Discover", icon: Sparkles },
    {
      href: "/agents",
      label: "Agent Conversations",
      short: "Agents",
      icon: MessagesSquare,
    },
    {
      href: "/connections",
      label: "Connections",
      short: "Connect",
      icon: MessageCircle,
    },
    {
      href: "/profile",
      label: "My Profile",
      short: "Profile",
      icon: SlidersHorizontal,
    },
  ];
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Brand />
        <div className="sidebar-caption">A LITTLE LESS SEARCHING.</div>
        <nav aria-label="Your space">
          {nav.map((n) => (
            <Link
              href={n.href}
              key={n.href}
              className={path === n.href ? "active" : ""}
            >
              <n.icon size={19} />
              {n.label}
              {n.href === "/agents" && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <PiperMark />
          <p>
            Good things start
            <br />
            with a little curiosity.
          </p>
          <Link href="/onboarding">
            Talk to Piper <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="sidebar-bottom">
          <Link href="/privacy">
            <ShieldCheck size={17} />
            Privacy & safety
          </Link>
          <div className="sidebar-user">
            <div className="avatar-initial">
              {state.profile?.name.slice(0, 1) || "J"}
            </div>
            <div>
              <strong>{state.profile?.name || "Your space"}</strong>
              <span>
                {state.profile && state.profile.readyToConnect === false
                  ? "Paused · fictional demo"
                  : "Fictional demo profile"}
              </span>
            </div>
            <Heart size={16} />
          </div>
        </div>
      </aside>
      <div className="app-content">
        <header className="app-topbar">
          <span>
            <span className="status-dot" /> A little more possibility.
          </span>
          <span className="badge demo-badge">INTERACTIVE DEMO</span>
          <Link href="/account" className="text-link">
            Real accounts <ArrowUpRight size={14} />
          </Link>
        </header>
        <div className="mobile-brand">
          <Brand />
        </div>
        <main id="main" className="app-main">
          {getStorageError() && (
            <div className="notice error-notice">{getStorageError()}</div>
          )}
          {children}
        </main>
        <footer className="app-footer">
          <ShieldCheck size={13} />
          Fictional people. Illustrated portraits. Your demo data stays in this
          browser.
        </footer>
      </div>
      <nav className="mobile-app-nav" aria-label="Mobile navigation">
        {nav.map((n) => (
          <Link
            href={n.href}
            key={n.href}
            className={path === n.href ? "active" : ""}
          >
            <n.icon size={20} />
            {n.short}
          </Link>
        ))}
      </nav>
    </div>
  );
}
export function NoProfile() {
  return (
    <div className="empty-state">
      <PiperMark />
      <h2>Let’s start with a hello.</h2>
      <p>
        A short conversation helps us introduce people who make sense for you.
      </p>
      <Button asChild>
        <Link href="/onboarding?demo=1">
          Meet your matchmaker <ArrowUpRight size={17} />
        </Link>
      </Button>
    </div>
  );
}
