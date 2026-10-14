import { MUSIC_MOODS, type MusicMood } from "./music-director";

/** Original live synthesis. Mood changes land on bar boundaries. */
export class MusicBed {
  private context = new AudioContext();
  private master = this.context.createGain();
  private dry = this.context.createGain();
  private track = this.context.createGain();
  private trackEnvelope = this.context.createGain();
  private trackFilter = this.context.createBiquadFilter();
  private source?: MediaElementAudioSourceNode;
  private nodes = new Set<AudioScheduledSourceNode>();
  private noise: AudioBuffer;
  private timer?: ReturnType<typeof setInterval>;
  private at = 0;
  private bar = 0;
  private root = 0;
  private running = false;
  private mood: MusicMood = "groove";
  private accentUntil = 0;
  constructor() {
    const ctx = this.context;
    this.master.gain.value = 0; this.track.gain.value = 0;
    const compressor = ctx.createDynamicsCompressor(); compressor.threshold.value = -16; compressor.ratio.value = 5;
    this.master.connect(compressor); this.track.connect(compressor); compressor.connect(ctx.destination);
    this.trackFilter.type = "lowpass"; this.trackFilter.frequency.value = 20000;
    this.trackFilter.connect(this.trackEnvelope); this.trackEnvelope.connect(this.track);
    this.dry.gain.value = 0.65; this.dry.connect(this.master);
    const reverb = ctx.createConvolver(), impulse = ctx.createBuffer(2, ctx.sampleRate * 1.4, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const samples = impulse.getChannelData(ch); for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / samples.length, 4); }
    reverb.buffer = impulse; const wet = ctx.createGain(); wet.gain.value = 0.12; this.dry.connect(reverb); reverb.connect(wet); wet.connect(this.master);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const samples = this.noise.getChannelData(0); for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  }
  async unlock(player?: HTMLAudioElement | null) {
    if (player && !this.source) { this.source = this.context.createMediaElementSource(player); this.source.connect(this.trackFilter); }
    await this.context.resume();
  }
  volume(level: number, duck: boolean, enabled = true) {
    const at = this.context.currentTime, amount = Math.max(0, Math.min(1, level)) * (duck ? 0.2 : 1);
    this.master.gain.setTargetAtTime(enabled ? amount : 0, at, duck ? 0.045 : 0.3);
    this.track.gain.setTargetAtTime(amount, at, duck ? 0.045 : 0.3);
  }
  fadeTrack(level: number, seconds: number) {
    const param = this.trackEnvelope.gain, at = this.context.currentTime;
    param.cancelScheduledValues(at); param.setValueAtTime(param.value, at); param.linearRampToValueAtTime(level, at + seconds);
  }
  setMood(mood: MusicMood) {
    this.mood = mood;
    if (this.context.currentTime < this.accentUntil) return;
    const param = this.trackFilter.frequency, at = this.context.currentTime;
    param.cancelScheduledValues(at); param.setTargetAtTime(mood === "chill" ? 6500 : mood === "banter" ? 12000 : 20000, at, 0.6);
  }
  start() { if (this.running) return; this.running = true; this.at = this.context.currentTime + 0.08; this.schedule(); this.timer = setInterval(() => this.schedule(), 100); }
  private connect(source: AudioScheduledSourceNode, filter: BiquadFilterNode, gain: GainNode, at: number, end: number) {
    source.connect(filter); filter.connect(gain); gain.connect(this.dry); this.nodes.add(source);
    source.onended = () => { this.nodes.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(at); source.stop(end);
  }
  private note(midi: number, at: number, duration: number, level: number, soft = false) {
    const ctx = this.context, osc = ctx.createOscillator(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
    osc.type = soft ? "triangle" : "sine"; osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    filter.type = "lowpass"; filter.frequency.value = soft ? 680 : 2400;
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(level, at + (soft ? Math.min(0.18, duration / 3) : 0.008)); gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    this.connect(osc, filter, gain, at, at + duration + 0.02);
  }
  private drum(kind: "kick" | "snare" | "hat", at: number, level: number) {
    const ctx = this.context, gain = ctx.createGain(), filter = ctx.createBiquadFilter(), duration = kind === "kick" ? 0.24 : kind === "snare" ? 0.14 : 0.045;
    let source: OscillatorNode | AudioBufferSourceNode;
    if (kind === "kick") {
      const osc = ctx.createOscillator(); osc.frequency.setValueAtTime(130, at); osc.frequency.exponentialRampToValueAtTime(42, at + 0.16); source = osc;
      filter.type = "lowpass"; filter.frequency.value = 220;
    } else {
      const noise = ctx.createBufferSource(); noise.buffer = this.noise; source = noise;
      filter.type = "highpass"; filter.frequency.value = kind === "hat" ? 6500 : 1500;
    }
    gain.gain.setValueAtTime(0.0001, at); gain.gain.linearRampToValueAtTime(level, at + 0.004); gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    this.connect(source, filter, gain, at, at + duration + 0.01);
  }
  accent(instrumental = true) {
    if (!this.running || this.context.state !== "running") return;
    const at = this.context.currentTime + 0.02;
    if (!instrumental) {
      this.accentUntil = at + 0.65;
      const param = this.trackFilter.frequency;
      param.cancelScheduledValues(at); param.setValueAtTime(param.value, at);
      param.exponentialRampToValueAtTime(1600, at + 0.12); param.exponentialRampToValueAtTime(20000, at + 0.65);
      return;
    }
    for (let i = 0; i < 4; i++) this.drum("snare", at + i * 0.1, 0.035 + i * 0.012);
    this.drum("kick", at + 0.45, 0.25); this.note(60 + this.root, at + 0.45, 0.5, 0.075);
  }
  private schedule() {
    if (!this.running || this.context.state !== "running") return;
    if (this.at < this.context.currentTime) this.at = this.context.currentTime + 0.08;
    // Schedule one bar at a time; a throttled tab never catches up with a burst.
    if (this.at > this.context.currentTime + 0.2) return;
    const mood = this.mood, beat = 60 / MUSIC_MOODS[mood].bpm, length = beat * 4;
    if (this.bar % 2 === 0) { const roots = [0, 3, 5, 7, 8, 10].filter(root => root !== this.root); this.root = roots[Math.floor(Math.random() * roots.length)]; }
    const chord = [48 + this.root, (mood === "party" ? 52 : 51) + this.root, 55 + this.root, 58 + this.root];
    for (const tone of chord) this.note(tone, this.at, length * 1.05, 0.017, true);
    const bassBeats = mood === "chill" ? [0, 2.5] : mood === "banter" ? [0, 1.5, 2.75] : [0, 1, 2, 3];
    for (const step of bassBeats) this.note(36 + this.root, this.at + beat * step, beat * 0.72, 0.075, true);
    if (mood !== "chill") {
      for (const step of mood === "party" ? [0, 1, 2, 3] : [0, 2, 2.75]) this.drum("kick", this.at + step * beat, 0.2);
      for (const step of [1, 3]) this.drum("snare", this.at + step * beat, 0.085);
      for (let i = 0; i < 8; i++) this.drum("hat", this.at + i * beat / 2, i % 2 ? 0.035 : 0.022);
      if (this.bar % 4 === 3) for (const step of [3.5, 3.75]) this.drum("snare", this.at + step * beat, 0.045);
    }
    for (let i = 0; i < 8; i++) if (Math.random() > (mood === "chill" ? 0.65 : 0.4)) this.note(chord[Math.floor(Math.random() * chord.length)] + 12, this.at + i * beat / 2, beat * 0.8, mood === "banter" ? 0.055 : 0.04);
    this.bar++; this.at += length;
  }
  stop() {
    this.running = false; clearInterval(this.timer);
    this.master.gain.cancelScheduledValues(this.context.currentTime); this.master.gain.value = 0;
    this.track.gain.cancelScheduledValues(this.context.currentTime); this.track.gain.value = 0;
    for (const node of this.nodes) { try { node.stop(); } catch { /* Already ended. */ } }
    this.nodes.clear();
  }
  async dispose() { this.stop(); await this.context.close(); }
}
