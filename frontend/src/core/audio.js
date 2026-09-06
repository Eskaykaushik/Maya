/**
 * Audio — the ears of Maya.
 *
 * Runs an always-on, low-fidelity analysis loop (amplitude + frequency)
 * that drives the particle renderer, plus a voice-activity detector that
 * flips Web Speech recognition on the instant speech begins — no buttons.
 */

export class Audio {
  constructor({ onAmplitude, onFrame, onSpeechStart, onSpeechEnd, onFinalText }) {
    this.onAmplitude = onAmplitude;      // (rms, peak, dominantHz) per analyser pass
    this.onFrame = onFrame;              // raw (frequencyBinCount, dataArray) throttled
    this.onSpeechStart = onSpeechStart;
    this.onSpeechEnd = onSpeechEnd;
    this.onFinalText = onFinalText;      // (text) final transcription

    this.ctx = null;
    this.analyser = null;
    this.source = null;
    this.recognition = null;
    this.listening = false;
    this.speechActive = false;
    this.supportsSpeech = false;
    this._raf = 0;

    this._vad = {
      enabled: true,
      running: 0,        // rolling squared-mean
      threshold: 0.006,
      minHold: 0.2,      // s above threshold to count as speech
      minGap: 0.6,       // s of silence to end speech
      rise: 0,
      fall: 0,
    };
  }

  async start() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.65;
    this.source = this.ctx.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
    this._loop();
    this._setupRecognition();
    return true;
  }

  _loop() {
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    const pump = () => {
      this.analyser.getByteTimeDomainData(data);
      let rms = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        rms += v * v;
      }
      rms = Math.sqrt(rms / data.length);

      // Dominant frequency from the frequency data (rough, for colour).
      const freq = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(freq);
      let peak = 0;
      let peakIdx = 0;
      for (let i = 2; i < freq.length; i++) {
        if (freq[i] > peak) { peak = freq[i]; peakIdx = i; }
      }
      const sampleRate = this.ctx.sampleRate;
      const dominantHz = (peakIdx * sampleRate) / (2 * freq.length);

      if (this.onFrame) this.onFrame(this.analyser, freq);
      if (this.onAmplitude) this.onAmplitude(rms, peak, dominantHz);

      this._vadUpdate(rms);
      this._raf = requestAnimationFrame(pump);
    };
    this._raf = requestAnimationFrame(pump);
  }

  _vadUpdate(rms) {
    if (!this._vad.enabled) return;
    const v = this._vad;
    if (rms > v.threshold) {
      if (v.running === 0) v.running = 1;
      v.running += 1 / 60;
      v.fall = 0;
      if (v.running >= v.minHold * 60) this._startSpeech();
    } else if (v.running > 0) {
      v.fall += 1 / 60;
      if (v.fall >= v.minGap * 60) {
        v.running = 0;
        this._endSpeech();
      }
    }
  }

  _startSpeech() {
    if (this.speechActive) return;
    this.speechActive = true;
    if (this.onSpeechStart) this.onSpeechStart();
    if (this.recognition) {
      try { this.recognition.start(); } catch { /* already started */ }
    }
  }

  _endSpeech() {
    if (!this.speechActive) return;
    this.speechActive = false;
    if (this.onSpeechEnd) this.onSpeechEnd();
    if (this.recognition) {
      try { this.recognition.stop(); } catch { /* noop */ }
    }
  }

  _setupRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.supportsSpeech = !!SR;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (interim && this.onSpeechEnd) this.onSpeechEnd();
      if (final && this.onFinalText) this.onFinalText(final.trim());
    };
    rec.onerror = () => {};
    this.recognition = rec;
  }

  setSpeaking(isSpeaking) {
    this._vad.enabled = !isSpeaking; // hush VAD while Maya is "thinking"
  }

  stop() {
    cancelAnimationFrame(this._raf);
    if (this.source) { try { this.source.disconnect(); } catch {} }
    if (this.ctx) { try { this.ctx.close(); } catch {} }
  }
}
