import { nextDjTrack, type DjMood, type MusicTrack } from "./dj";

const FADE_SECONDS = 2.5;
type Deck = { player: HTMLAudioElement; gain: GainNode; filter: BiquadFilterNode; source: MediaElementAudioSourceNode };

/** Two independently unlocked media decks; Web Audio gain also works on mobile. */
export class DjMixer {
  readonly played = new Set<string>();
  private failed = new Set<string>();
  private context: AudioContext;
  private master: GainNode;
  private decks: Deck[];
  private active = -1;
  private current?: MusicTrack;
  private started = false;
  private loading = false;
  private mixing = false;
  private changedAt = 0;
  private fadeTimer?: ReturnType<typeof setTimeout>;
  private timer: ReturnType<typeof setInterval>;
  private operation?: AbortController;
  private tracks: MusicTrack[] = [];
  private mood: DjMood = "groove";
  private adaptive = true;
  private unlocked = false;
  constructor(private onTrack: (track?: MusicTrack) => void, private onError: (message: string) => void) {
    this.context = new AudioContext();
    this.master = this.context.createGain(); this.master.gain.value = 0;
    this.master.connect(this.context.destination);
    this.decks = [0, 1].map(() => {
      const player = new Audio(); player.preload = "auto";
      const gain = this.context.createGain(); gain.gain.value = 0;
      const filter = this.context.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 20000;
      const source = this.context.createMediaElementSource(player);
      source.connect(filter); filter.connect(gain); gain.connect(this.master);
      return { player, gain, filter, source };
    });
    this.timer = setInterval(() => this.tick(), 250);
  }
  async unlock() {
    const resume = this.context.resume();
    if (this.unlocked) { await resume; return; }
    // Unlock both HTML media elements within the initiating user gesture.
    const bytes = new Uint8Array(844), view = new DataView(bytes.buffer);
    const put = (at: number, value: string) => [...value].forEach((c, i) => bytes[at + i] = c.charCodeAt(0));
    put(0, "RIFF"); view.setUint32(4, 836, true); put(8, "WAVEfmt "); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 8000, true); view.setUint32(28, 16000, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); put(36, "data"); view.setUint32(40, 800, true);
    const url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
    try {
      await Promise.all([resume, ...this.decks.map(async ({ player }) => { player.src = url; await player.play(); player.pause(); })]);
      this.unlocked = true;
    } finally { URL.revokeObjectURL(url); }
  }
  configure(tracks: MusicTrack[], mood: DjMood, adaptive: boolean, level: number, duck: boolean) {
    this.tracks = tracks; this.mood = mood; this.adaptive = adaptive;
    if (this.current) this.current = tracks.find(track => track.id === this.current?.id) || this.current;
    this.master.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * (duck ? 0.16 : 1), this.context.currentTime, duck ? 0.08 : 0.45);
    const frequency = !adaptive ? 20000 : mood === "chill" ? 6500 : mood === "banter" ? 12000 : mood === "drama" ? 3000 : 20000;
    for (const deck of this.decks) deck.filter.frequency.setTargetAtTime(frequency, this.context.currentTime, 0.6);
  }
  start() { this.started = true; this.tick(); }
  async next() { const track = nextDjTrack(this.tracks, this.unavailable(), this.mood); return track ? this.play(track) : false; }
  private unavailable() { return new Set([...this.played, ...this.failed]); }
  private tick() {
    if (!this.started || this.loading || this.mixing || this.context.state !== "running") return;
    const player = this.decks[this.active]?.player;
    const ending = !!player && (player.ended || (Number.isFinite(player.duration) && player.duration - player.currentTime <= FADE_SECONDS));
    const broken = !!player?.error;
    if (broken && this.current) this.failed.add(this.current.id);
    const moodChange = this.adaptive && this.current && this.current.mood !== this.mood && this.current.mood !== "any" && Date.now() - this.changedAt >= 30000;
    if (!this.current || ending || broken || moodChange) {
      const next = nextDjTrack(this.tracks, this.unavailable(), this.mood, !!moodChange && !ending && !broken);
      if (next) void this.play(next);
      else if (player?.ended || broken) { player.pause(); this.current = undefined; this.active = -1; this.onTrack(); }
    }
  }
  async play(track: MusicTrack): Promise<boolean> {
    if (this.loading || this.mixing || this.played.has(track.id) || this.failed.has(track.id)) return false;
    this.started = true;
    const controller = new AbortController(); this.operation = controller; this.loading = true;
    const old = this.active, index = old === 0 ? 1 : 0, deck = this.decks[index];
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    try {
      const now = this.context.currentTime;
      deck.gain.gain.cancelScheduledValues(now); deck.gain.gain.setValueAtTime(0, now);
      deck.player.src = track.url;
      await Promise.race([
        deck.player.play(),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener("abort", () => reject(new DOMException("Stopped", "AbortError")), { once: true });
          watchdog = setTimeout(() => reject(new Error("Audio timeout")), 10000);
        }),
      ]);
      controller.signal.throwIfAborted();
      this.started = true; this.active = index; this.current = track; this.changedAt = Date.now(); this.played.add(track.id);
      const at = this.context.currentTime, duration = old < 0 || this.decks[old].player.paused ? 0.35 : FADE_SECONDS;
      deck.gain.gain.linearRampToValueAtTime(1, at + duration);
      if (old >= 0) {
        const oldGain = this.decks[old].gain.gain;
        oldGain.cancelScheduledValues(at); oldGain.setValueAtTime(oldGain.value, at); oldGain.linearRampToValueAtTime(0, at + duration);
      }
      this.mixing = true; this.onTrack(track);
      this.fadeTimer = setTimeout(() => {
        if (old >= 0) this.decks[old].player.pause();
        this.mixing = false;
      }, duration * 1000);
      return true;
    } catch (error) {
      deck.player.pause();
      if (!controller.signal.aborted) { this.failed.add(track.id); this.onError(`A(z) ${track.title} nem játszható le; másik zenével folytatjuk.`); }
      return false;
    } finally {
      clearTimeout(watchdog);
      if (this.operation === controller) { this.operation = undefined; this.loading = false; }
    }
  }
  stop() {
    this.started = false; this.operation?.abort(); clearTimeout(this.fadeTimer); this.mixing = false;
    for (const deck of this.decks) { deck.player.pause(); deck.gain.gain.cancelScheduledValues(this.context.currentTime); deck.gain.gain.setValueAtTime(0, this.context.currentTime); }
    this.current = undefined; this.active = -1; this.onTrack();
  }
  dispose() { this.stop(); clearInterval(this.timer); for (const deck of this.decks) { deck.player.removeAttribute("src"); deck.player.load(); deck.source.disconnect(); } void this.context.close(); }
}
