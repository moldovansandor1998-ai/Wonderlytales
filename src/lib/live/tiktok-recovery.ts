/** Reconnect only transport failures, or temporary offline replies after a known suspension. */
export class TikTokRecovery {
  private attempts = 0;
  private suspendedUntil = 0;
  constructor(private now: () => number = Date.now) {}
  suspended() {
    if (!this.suspendedUntil) this.suspendedUntil = this.now() + 120000;
  }
  connected() { this.attempts = 0; this.suspendedUntil = 0; }
  retryStatus(code: unknown) {
    return this.suspendedUntil > this.now() && this.attempts < 6 &&
      ["TIKTOK_OFFLINE", "TIKTOK_TIMEOUT", "TIKTOK_CONNECT_FAILED", "TIKTOK_SESSION_BUSY"].includes(String(code));
  }
  delay(closeCode: number, received: boolean, temporaryStatus = false): number | null {
    if (this.suspendedUntil && this.now() >= this.suspendedUntil) return null;
    if (this.attempts >= (this.suspendedUntil ? 6 : 3)) return null;
    if (!temporaryStatus && closeCode !== 1012 && !(closeCode === 1006 && received)) return null;
    return Math.min(5000 * 2 ** this.attempts++, 20000);
  }
}
