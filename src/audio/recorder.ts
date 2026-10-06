import type { RecorderState } from "../types";

export const MAX_RECORDING_SECONDS = 60;

export interface RecorderEvents {
  onState: (state: RecorderState, message?: string) => void;
  onTime: (seconds: number) => void;
  onComplete: (blob: Blob, duration: number) => void;
}

export class FieldRecorder {
  private stream?: MediaStream;
  private recorder?: MediaRecorder;
  private chunks: Blob[] = [];
  private context?: AudioContext;
  private analyser?: AnalyserNode;
  private visualizer?: HTMLCanvasElement;
  private frame?: number;
  private lastTimeUpdate = 0;
  private visualGain = 4;
  private startedAt = 0;
  private pausedAt = 0;
  private pausedTotal = 0;
  private discarded = false;
  private attempt = 0;
  private stoppedAt?: number;
  private stopTimer?: number;
  private onVisibility = () => {
    if (document.hidden) this.pause();
  };
  constructor(private events: RecorderEvents) {}

  attachVisualizer(canvas: HTMLCanvasElement | null) {
    this.visualizer = canvas ?? undefined;
    if (canvas) this.drawWaveform(new Float32Array(256));
  }

  async start() {
    const attempt = ++this.attempt;
    this.discarded = false;
    let timer: number | undefined;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      this.events.onState(
        "error",
        "This browser cannot record audio. Try current Safari or Chrome.",
      );
      return;
    }
    try {
      this.events.onState("requesting-permission");
      let expired = false;
      const microphone = navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      void microphone.then(
        (stream) => {
          if (expired || attempt !== this.attempt)
            stream.getTracks().forEach((track) => track.stop());
        },
        () => {},
      );
      const timeout = new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => {
          expired = true;
          reject(
            new DOMException("Microphone request timed out", "TimeoutError"),
          );
        }, 12000);
      });
      this.stream = await Promise.race([microphone, timeout]);
      window.clearTimeout(timer);
      if (attempt !== this.attempt || this.discarded) {
        this.cleanup();
        return;
      }
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(
        (type) => MediaRecorder.isTypeSupported(type),
      );
      this.recorder = mime
        ? new MediaRecorder(this.stream, { mimeType: mime })
        : new MediaRecorder(this.stream);
      this.chunks = [];
      this.recorder.ondataavailable = (event) => {
        if (event.data.size) this.chunks.push(event.data);
      };
      this.recorder.onerror = () => {
        this.discard();
        this.events.onState("error", "Recording was interrupted.");
      };
      this.recorder.onstop = () => this.finish();
      this.context = new AudioContext();
      // Safari can create the analyser context suspended after microphone access.
      void this.context.resume?.().catch(() => {});
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 256;
      this.context.createMediaStreamSource(this.stream).connect(this.analyser);
      this.startedAt = performance.now();
      this.pausedTotal = 0;
      this.stoppedAt = undefined;
      document.addEventListener("visibilitychange", this.onVisibility);
      this.stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (!this.discarded) {
            this.discard();
            this.events.onState(
              "error",
              "Microphone disconnected. Please record again.",
            );
          }
        };
      });
      this.recorder.start(250);
      this.events.onState("recording");
      this.tick();
    } catch (error) {
      window.clearTimeout(timer);
      this.cleanup();
      if (attempt !== this.attempt || this.discarded) return;
      const denied =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" ||
          error.name === "PermissionDeniedError");
      const timedOut =
        error instanceof DOMException && error.name === "TimeoutError";
      this.events.onState(
        "error",
        denied
          ? "Microphone permission denied. Enable it in browser settings and try again."
          : timedOut
            ? "Microphone permission did not open. Check the browser permission icon and try again."
            : "Microphone unavailable. Check that no other app is using it.",
      );
    }
  }

  pause() {
    if (this.recorder?.state === "recording") {
      this.recorder.pause();
      this.pausedAt = performance.now();
      this.events.onState("paused");
    }
  }
  resume() {
    if (this.recorder?.state === "paused") {
      this.recorder.resume();
      this.pausedTotal += performance.now() - this.pausedAt;
      this.events.onState("recording");
    }
  }
  stop() {
    if (this.recorder && this.recorder.state !== "inactive") {
      this.stoppedAt = performance.now();
      if (this.recorder.state === "paused")
        this.pausedTotal += this.stoppedAt - this.pausedAt;
      this.events.onState("processing");
      // Some WebViews miss onstop after an interruption. Keep received chunks
      // usable, and never leave the controls in an endless processing state.
      this.stopTimer = window.setTimeout(() => {
        if (this.chunks.some(chunk => chunk.size)) this.finish();
        else {
          this.cleanup();
          this.events.onState('error', 'Recording could not finish. Please try again.');
        }
      }, 8000);
      this.recorder.stop();
    }
  }
  discard() {
    this.attempt++;
    this.discarded = true;
    if (this.recorder && this.recorder.state !== "inactive")
      this.recorder.stop();
    this.cleanup();
  }

  private tick = () => {
    if (!this.analyser || !this.recorder || this.recorder.state === "inactive")
      return;
    const raw = new Float32Array(this.analyser.frequencyBinCount);
    if (this.analyser.getFloatTimeDomainData) {
      this.analyser.getFloatTimeDomainData(raw);
    } else {
      const bytes = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteTimeDomainData(bytes);
      for (let index = 0; index < bytes.length; index++)
        raw[index] = (bytes[index] - 128) / 128;
    }
    try { this.drawWaveform(raw); } catch {
      // A canvas/viewport interruption must not disable recording controls.
    }
    const pause =
      this.recorder.state === "paused" ? performance.now() - this.pausedAt : 0;
    const now = performance.now();
    const elapsed =
      (now - this.startedAt - this.pausedTotal - pause) / 1000;
    if (now - this.lastTimeUpdate >= 100) {
      this.events.onTime(Math.min(elapsed, MAX_RECORDING_SECONDS));
      this.lastTimeUpdate = now;
    }
    if (elapsed >= MAX_RECORDING_SECONDS) {
      this.events.onTime(MAX_RECORDING_SECONDS);
      this.stop();
      return;
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  private drawWaveform(samples: Float32Array) {
    const canvas = this.visualizer;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const scale = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(bounds.width * scale));
    const height = Math.max(1, Math.round(bounds.height * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const drawing = canvas.getContext("2d");
    if (!drawing) return;
    drawing.clearRect(0, 0, width, height);
    drawing.lineWidth = Math.max(2, 2.2 * scale);
    drawing.lineCap = "round";
    drawing.lineJoin = "round";
    const gradient = drawing.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "#f531a4");
    gradient.addColorStop(0.5, "#ff76c7");
    gradient.addColorStop(1, "#f531a4");
    drawing.strokeStyle = gradient;
    drawing.beginPath();
    let peak = 0;
    for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
    const targetGain = Math.min(
      28,
      Math.max(1.5, 0.62 / Math.max(peak, 0.001)),
    );
    this.visualGain +=
      (targetGain - this.visualGain) *
      (targetGain < this.visualGain ? 0.3 : 0.08);
    for (let index = 0; index < samples.length; index++) {
      const x = (index / Math.max(1, samples.length - 1)) * width;
      const sample = Math.abs(samples[index]) < 0.0025 ? 0 : samples[index];
      const normalized = Math.max(-1, Math.min(1, sample * this.visualGain));
      const y = height / 2 + normalized * height * 0.42;
      if (index === 0) drawing.moveTo(x, y);
      else drawing.lineTo(x, y);
    }
    drawing.stroke();
  }

  private finish() {
    if (!this.recorder) return;
    if (this.discarded) {
      this.cleanup();
      return;
    }
    const duration = Math.max(
      0,
      ((this.stoppedAt ?? performance.now()) -
        this.startedAt -
        this.pausedTotal) /
        1000,
    );
    const blob = new Blob(this.chunks, {
      type: this.recorder?.mimeType || "audio/webm",
    });
    this.cleanup();
    if (blob.size < 100 || duration < 0.15)
      this.events.onState(
        "error",
        "The recording is empty. Try again and record a little longer.",
      );
    else {
      this.events.onState('processing');
      this.events.onComplete(blob, duration);
    }
  }

  private cleanup() {
    window.clearTimeout(this.stopTimer);
    document.removeEventListener("visibilitychange", this.onVisibility);
    if (this.frame) cancelAnimationFrame(this.frame);
    this.stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    void this.context?.close();
    this.stream = undefined;
    this.recorder = undefined;
    this.context = undefined;
    this.analyser = undefined;
  }
}
