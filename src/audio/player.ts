export class PlaybackManager {
  private audio = new Audio();
  private url?: string;
  private sequence=0;
  currentId?: string;
  onProgress?: (seconds:number) => void;
  play(id: string, blob: Blob, onState: (playing: boolean) => void, loop = false, replace = false, onError?:()=>void) {
    if (!replace && this.currentId === id) {
      if (!this.audio.paused) { this.audio.pause(); onState(false); return; }
      const sequence=this.sequence;
      void this.audio.play().catch(() => {if(sequence===this.sequence){onState(false);onError?.();}}); return;
    }
    this.stop(); const sequence=this.sequence; this.currentId = id; this.url = URL.createObjectURL(blob); this.audio.src = this.url; this.audio.loop = loop;
    this.audio.onended = () => onState(false); this.audio.onpause = () => onState(false); this.audio.onplay = () => onState(true);
    this.audio.ontimeupdate = () => this.onProgress?.(this.audio.currentTime);
    this.audio.onerror = () => {if(sequence===this.sequence){onState(false);onError?.();}};
    void this.audio.play().catch(() => {if(sequence===this.sequence){onState(false);onError?.();}});
  }
  pause() { this.audio.pause(); }
  restart() { if (!this.currentId) return; this.audio.currentTime = 0; void this.audio.play(); }
  stop() { this.sequence++;this.audio.pause();this.audio.onerror=null;this.audio.ontimeupdate=null;this.audio.onplay=null;this.audio.onended=null; this.audio.removeAttribute('src'); if (this.url) URL.revokeObjectURL(this.url); this.url = undefined; this.currentId = undefined; }
}
