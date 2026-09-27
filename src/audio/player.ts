export class PlaybackManager {
  private audio = new Audio();
  private url?: string;
  currentId?: string;
  play(id: string, blob: Blob, onState: (playing: boolean) => void, loop = false, replace = false) {
    if (!replace && this.currentId === id) {
      if (!this.audio.paused) { this.audio.pause(); onState(false); return; }
      void this.audio.play().catch(() => onState(false)); return;
    }
    this.stop(); this.currentId = id; this.url = URL.createObjectURL(blob); this.audio.src = this.url; this.audio.loop = loop;
    this.audio.onended = () => onState(false); this.audio.onpause = () => onState(false); this.audio.onplay = () => onState(true);
    void this.audio.play().catch(() => onState(false));
  }
  pause() { this.audio.pause(); }
  restart() { if (!this.currentId) return; this.audio.currentTime = 0; void this.audio.play(); }
  stop() { this.audio.pause(); this.audio.removeAttribute('src'); if (this.url) URL.revokeObjectURL(this.url); this.url = undefined; this.currentId = undefined; }
}
