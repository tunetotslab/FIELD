import type { RecorderState } from '../types';

export interface RecorderEvents {
  onState: (state: RecorderState, message?: string) => void;
  onLevel: (samples: number[]) => void;
  onTime: (seconds: number) => void;
  onComplete: (blob: Blob, duration: number) => void;
}

export class FieldRecorder {
  private stream?: MediaStream;
  private recorder?: MediaRecorder;
  private chunks: Blob[] = [];
  private context?: AudioContext;
  private analyser?: AnalyserNode;
  private frame?: number;
  private startedAt = 0;
  private pausedAt = 0;
  private pausedTotal = 0;
  private discarded = false;
  private attempt = 0;
  private stoppedAt?: number;
  private onVisibility = () => { if (document.hidden) this.pause(); };
  constructor(private events: RecorderEvents) {}

  async start() {
    const attempt = ++this.attempt;
    this.discarded = false;
    let timer: number | undefined;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      this.events.onState('error', 'This browser cannot record audio. Try current Safari or Chrome.'); return;
    }
    try {
      this.events.onState('requesting-permission');
      let expired = false;
      const microphone = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      void microphone.then(stream => { if (expired || attempt !== this.attempt) stream.getTracks().forEach(track => track.stop()); }, () => {});
      const timeout = new Promise<never>((_, reject) => {timer = window.setTimeout(() => { expired = true; reject(new DOMException('Microphone request timed out', 'TimeoutError')); }, 12000);});
      this.stream = await Promise.race([microphone, timeout]);
      window.clearTimeout(timer);
      if (attempt !== this.attempt || this.discarded) {this.cleanup();return;}
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type));
      this.recorder = mime ? new MediaRecorder(this.stream, { mimeType: mime }) : new MediaRecorder(this.stream);
      this.chunks = [];
      this.recorder.ondataavailable = event => { if (event.data.size) this.chunks.push(event.data); };
      this.recorder.onerror = () => {this.discard();this.events.onState('error', 'Recording was interrupted.');};
      this.recorder.onstop = () => this.finish();
      this.context = new AudioContext();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 256;
      this.context.createMediaStreamSource(this.stream).connect(this.analyser);
      this.startedAt = performance.now(); this.pausedTotal = 0; this.stoppedAt = undefined;
      document.addEventListener('visibilitychange',this.onVisibility);
      this.stream.getAudioTracks().forEach(track => {track.onended=()=>{if(!this.discarded){this.discard();this.events.onState('error','Microphone disconnected. Please record again.');}};});
      this.recorder.start(250);
      this.events.onState('recording'); this.tick();
    } catch (error) {
      window.clearTimeout(timer);
      this.cleanup();
      if (attempt !== this.attempt || this.discarded) return;
      const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError');
      const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
      this.events.onState('error', denied ? 'Microphone permission denied. Enable it in browser settings and try again.' : timedOut ? 'Microphone permission did not open. Check the browser permission icon and try again.' : 'Microphone unavailable. Check that no other app is using it.');
    }
  }

  pause() { if (this.recorder?.state === 'recording') { this.recorder.pause(); this.pausedAt = performance.now(); this.events.onState('paused'); } }
  resume() { if (this.recorder?.state === 'paused') { this.recorder.resume(); this.pausedTotal += performance.now() - this.pausedAt; this.events.onState('recording'); } }
  stop() { if (this.recorder && this.recorder.state !== 'inactive') { this.stoppedAt=performance.now();if(this.recorder.state==='paused')this.pausedTotal+=this.stoppedAt-this.pausedAt;this.events.onState('processing'); this.recorder.stop(); } }
  discard() { this.attempt++; this.discarded = true; if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop(); else this.cleanup(); }

  private tick = () => {
    if (!this.analyser || !this.recorder || this.recorder.state === 'inactive') return;
    const raw = new Uint8Array(this.analyser.frequencyBinCount); this.analyser.getByteTimeDomainData(raw);
    this.events.onLevel(Array.from(raw, value => Math.abs(value - 128) / 128));
    const pause = this.recorder.state === 'paused' ? performance.now() - this.pausedAt : 0;
    this.events.onTime((performance.now() - this.startedAt - this.pausedTotal - pause) / 1000);
    this.frame = requestAnimationFrame(this.tick);
  };

  private finish() {
    if (this.discarded) { this.cleanup(); return; }
    const duration = Math.max(0, ((this.stoppedAt ?? performance.now()) - this.startedAt - this.pausedTotal) / 1000);
    const blob = new Blob(this.chunks, { type: this.recorder?.mimeType || 'audio/webm' });
    this.cleanup();
    if (blob.size < 100 || duration < .15) this.events.onState('error', 'The recording is empty. Try again and record a little longer.');
    else this.events.onComplete(blob, duration);
  }

  private cleanup() {
    document.removeEventListener('visibilitychange',this.onVisibility);
    if (this.frame) cancelAnimationFrame(this.frame);
    this.stream?.getTracks().forEach(track => {track.onended=null;track.stop();});
    void this.context?.close();
    this.stream = undefined; this.recorder = undefined; this.context = undefined; this.analyser = undefined;
  }
}
