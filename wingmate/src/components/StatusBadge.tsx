"use client";

import { useEffect, useState } from "react";

export function StatusBadge() {
  const [mock, setMock] = useState(false);
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((s: { mock: boolean }) => setMock(s.mock))
      .catch(() => {});
  }, []);
  if (!mock) return null;
  return (
    <span
      title="No GEMINI_API_KEY set: the conversations are placeholders. Add a key for real AI."
      className="inline-flex items-center gap-1.5 rounded-full bg-amber/15 text-amber px-2.5 py-1 text-[11px] font-semibold tracking-wide"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber" />
      MOCK<span className="hidden sm:inline"> MODE</span>
    </span>
  );
}
