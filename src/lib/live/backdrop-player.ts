/** A play request may reject after pause/unmount. Only the current run owns errors. */
export function runBackdropPlayer(video: HTMLVideoElement, page: Document, onError: (message: string) => void) {
  let disposed = false, pending = false, retries = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const visible = () => page.visibilityState !== "hidden";
  const schedule = () => {
    if (disposed || !visible() || timer) return;
    timer = setTimeout(() => { timer = undefined; void play(); }, 350);
  };
  const fail = (message: string) => { if (!disposed) { disposed = true; clearTimeout(timer); onError(message); } };
  async function play() {
    if (disposed || pending || !visible() || !video.paused) return;
    pending = true;
    video.muted = true;
    try { await video.play(); }
    catch (error) {
      if (disposed || !visible()) return;
      const name = error instanceof Error ? error.name : "";
      if (name === "AbortError") {
        if (retries++ < 3) schedule();
        else fail("A böngésző ismételten megszakította az alapvideó indítását. A mentett alapvideó próbájával újraindíthatod.");
        return;
      }
      if (name === "NotAllowedError") {
        fail("A böngésző nem engedte elindulni az alapvideót. Érintsd meg az alapvideó indítógombját.");
      } else if (video.error) {
        mediaError();
      } else {
        fail("Az alapvideó nem indult el ezen a böngészőn. A mentett alapvideó próbájával új generálás nélkül újraindíthatod.");
      }
    } finally { pending = false; }
  }
  const mediaError = () => {
    if (disposed || !visible()) return;
    if (video.error?.code === 1) { schedule(); return; }
    if (video.error?.code === 2 && retries++ < 2) { video.load(); schedule(); return; }
    fail(video.error?.code === 3 || video.error?.code === 4
      ? "A böngésző nem tudja dekódolni az alapvideót. Próbáld meg a Chrome-ban megnyitni a stúdiót."
      : "Az alapvideó betöltése nem sikerült. A mentett alapvideó próbájával új generálás nélkül újraindíthatod.");
  };
  video.addEventListener("error", mediaError);
  video.addEventListener("pause", schedule);
  video.addEventListener("canplay", schedule);
  page.addEventListener("visibilitychange", schedule);
  page.defaultView?.addEventListener("pageshow", schedule);
  void play();
  return () => {
    disposed = true; clearTimeout(timer);
    video.removeEventListener("error", mediaError);
    video.removeEventListener("pause", schedule);
    video.removeEventListener("canplay", schedule);
    page.removeEventListener("visibilitychange", schedule);
    page.defaultView?.removeEventListener("pageshow", schedule);
    video.pause();
  };
}
