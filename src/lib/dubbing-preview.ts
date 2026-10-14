type PreviewTrack = { cueStartMs: number; cueEndMs: number; recordedStartMs: number; audio: HTMLAudioElement };

/** The video clock owns playback; padding remains available in the individual take. */
export class DubbingPreview {
  private disposed = false;
  private buffering = false;
  private seeking = false;
  private oldMuted: boolean;
  private interval?: ReturnType<typeof setInterval>;
  private listeners: Array<[string, EventListener]> = [];
  private pending = new Map<HTMLMediaElement, object>();
  private wanted = new Set<HTMLMediaElement>();

  constructor(private video: HTMLVideoElement, private tracks: PreviewTrack[], private background: HTMLAudioElement | null | undefined, private onError: () => void, private onEnded: () => void) {
    this.oldMuted = video.muted;
  }

  async start() {
    const listen = (name: string, fn: () => void) => {
      this.video.addEventListener(name, fn);
      this.listeners.push([name, fn]);
    };
    listen("play", () => this.sync());
    listen("playing", () => { this.buffering = false; this.sync(); });
    listen("waiting", () => { this.buffering = true; this.sync(); });
    listen("seeking", () => { this.seeking = true; this.sync(); });
    listen("seeked", () => { this.seeking = false; this.buffering = false; this.sync(true); });
    for (const name of ["pause", "timeupdate", "ratechange"]) listen(name, () => this.sync());
    listen("volumechange", () => { if (!this.video.muted) this.video.muted = true; });
    listen("ended", () => { this.dispose(); this.onEnded(); });
    listen("error", () => this.fail());
    this.video.muted = true;
    this.video.currentTime = 0;
    this.interval = setInterval(() => this.sync(), 50);
    try { await this.video.play(); this.sync(true); } catch { if (!this.disposed) this.fail(); }
  }

  private fail() {
    if (this.disposed) return;
    this.dispose();
    this.onError();
  }

  private sync(force = false) {
    if (this.disposed) return;
    const seconds = this.video.currentTime;
    const running = !this.video.paused && !this.video.ended && !this.buffering && !this.seeking;
    for (const track of this.tracks) {
      const active = seconds * 1000 >= track.cueStartMs && seconds * 1000 < track.cueEndMs;
      this.syncAudio(track.audio, seconds - track.recordedStartMs / 1000, running && active, force, active);
    }
    if (this.background) this.syncAudio(this.background, seconds, running, force, true);
  }

  private syncAudio(audio: HTMLAudioElement, time: number, running: boolean, force: boolean, position: boolean) {
    const withinAudio = !Number.isFinite(audio.duration) || time < audio.duration;
    running = running && withinAudio && time >= 0;
    if (!running) { this.wanted.delete(audio); this.pending.delete(audio); audio.pause(); }
    audio.playbackRate = this.video.playbackRate;
    if (position && time >= 0 && (force || Math.abs(audio.currentTime - time) > 0.12)) audio.currentTime = time;
    if (!running) return;
    this.wanted.add(audio);
    if (!audio.paused || this.pending.has(audio)) return;
    const token = {};
    this.pending.set(audio, token);
    void audio.play().then(() => {
      if (this.disposed || !this.wanted.has(audio)) audio.pause();
    }, () => {
      if (!this.disposed && this.pending.get(audio) === token && this.wanted.has(audio)) this.fail();
    }).finally(() => { if (this.pending.get(audio) === token) this.pending.delete(audio); });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    clearInterval(this.interval);
    for (const [name, fn] of this.listeners) this.video.removeEventListener(name, fn);
    this.listeners = [];
    this.wanted.clear();
    this.video.pause();
    for (const track of this.tracks) track.audio.pause();
    this.background?.pause();
    this.video.muted = this.oldMuted;
  }
}
