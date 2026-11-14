"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Chats never scroll on their own (that yanked people away from what they were reading).
 * Instead, when new messages arrive below the visible area, a "New messages" button appears.
 * It scrolls only when clicked.
 */
export function useNewBelow(scroller: React.RefObject<HTMLDivElement | null>, count: number) {
  const [hasNew, setHasNew] = useState(false);
  const prev = useRef(count);

  useEffect(() => {
    const before = prev.current;
    prev.current = count;
    const el = scroller.current;
    // Ignore the first load (e.g. opening a finished date): that's not "new".
    if (!el || before === 0 || count <= before) return;
    const below = el.scrollHeight - el.scrollTop - el.clientHeight;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to new content measured in the DOM
    if (below > 40) setHasNew(true);
  }, [count, scroller]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight <= 40) setHasNew(false);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scroller]);

  function jump() {
    const el = scroller.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      // Finish at the true bottom even if a message arrived during the animation.
      setTimeout(() => el.scrollTo({ top: el.scrollHeight }), 450);
    }
    setHasNew(false);
  }

  return { hasNew, jump };
}

/** Put this as the LAST child inside the scrolling chat container. */
export function NewMessagesButton({ show, onClick }: { show: boolean; onClick: () => void }) {
  if (!show) return null;
  return (
    <div className="sticky bottom-1 flex justify-center pointer-events-none !mt-0">
      <button
        type="button"
        onClick={onClick}
        className="pointer-events-auto pop inline-flex items-center gap-1.5 rounded-full bg-plum text-white text-xs font-semibold px-3.5 py-2 shadow-md hover:bg-ink"
      >
        ↓ New messages
      </button>
    </div>
  );
}
