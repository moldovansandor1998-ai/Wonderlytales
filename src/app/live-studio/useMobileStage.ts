"use client";
import { useEffect, useRef, useState } from "react";

/** Keep the same media elements mounted when switching to the broadcast view. */
export function useMobileStage() {
  const container = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [controls, setControls] = useState(false);
  const usedFullscreen = useRef(false);
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let lock: WakeLockSentinel | undefined;
    let stopped = false;
    const keepAwake = async () => {
      if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
      try { const next = await navigator.wakeLock.request("screen"); if (stopped) await next.release(); else lock = next; } catch { /* Optional; the screen remains usable without it. */ }
    };
    const changed = () => {
      if (document.fullscreenElement === container.current) usedFullscreen.current = true;
      else if (usedFullscreen.current) { usedFullscreen.current = false; setActive(false); }
    };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setActive(false); };
    void keepAwake();
    document.addEventListener("visibilitychange", keepAwake);
    document.addEventListener("fullscreenchange", changed);
    document.addEventListener("keydown", key);
    return () => {
      stopped = true; document.body.style.overflow = previous;
      void lock?.release().catch(() => {});
      document.removeEventListener("visibilitychange", keepAwake);
      document.removeEventListener("fullscreenchange", changed);
      document.removeEventListener("keydown", key);
    };
  }, [active]);
  useEffect(() => {
    if (!active || !controls) return;
    const timer = setTimeout(() => setControls(false), 6000);
    return () => clearTimeout(timer);
  }, [active, controls]);
  function open() {
    setActive(true); setControls(true);
    const target = container.current;
    if (target?.requestFullscreen && !document.fullscreenElement) {
      void target.requestFullscreen({ navigationUI: "hide" }).then(async () => {
        usedFullscreen.current = true;
        // Android screen broadcasts should stay portrait instead of shrinking into a landscape canvas.
        const orientation = screen.orientation as ScreenOrientation & { lock?: (orientation: string) => Promise<void> };
        await orientation?.lock?.("portrait").catch(() => {});
      }).catch(() => {});
    }
  }
  function close() {
    usedFullscreen.current = false; setActive(false); setControls(false);
    screen.orientation?.unlock?.();
    if (document.fullscreenElement === container.current) void document.exitFullscreen().catch(() => {});
  }
  return { container, active, controls, setControls, open, close };
}
