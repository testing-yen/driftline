import { CONFIG } from '../config.js';

/**
 * Synthesized sound effects. No audio files: each sound is shaped from noise
 * with WebAudio. Silent until unlockAudio() runs inside a user gesture, as
 * browser autoplay rules require.
 */

let audio: AudioContext | null = null;
let noise: AudioBuffer | null = null;

/** Creates the AudioContext on the first call, resumes it on later ones. Call from a tap or key press. */
export function unlockAudio(): void {
  if (audio) {
    if (audio.state === 'suspended') void audio.resume().catch(() => undefined);
    return;
  }
  const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  try {
    audio = new Ctor();
  } catch {
    return;
  }
  const length = Math.ceil(audio.sampleRate * CONFIG.whooshS);
  noise = audio.createBuffer(1, length, audio.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < length; i += 1) samples[i] = Math.random() * 2 - 1;
}

/** A band-passed noise sweep; `strength` 0..1 sets its loudness and how high it sweeps. */
export function whoosh(strength: number): void {
  if (!audio || !noise || audio.state !== 'running') return;
  const t = audio.currentTime;
  const end = t + CONFIG.whooshS;
  const peak = t + CONFIG.whooshS * 0.4;
  const source = audio.createBufferSource();
  source.buffer = noise;
  const band = audio.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 1.2;
  band.frequency.setValueAtTime(CONFIG.whooshLowHz, t);
  band.frequency.exponentialRampToValueAtTime(CONFIG.whooshLowHz + (CONFIG.whooshHighHz - CONFIG.whooshLowHz) * strength, peak);
  band.frequency.exponentialRampToValueAtTime(CONFIG.whooshLowHz, end);
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(Math.max(0.0001, CONFIG.whooshVolume * strength), peak);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  source.connect(band).connect(gain).connect(audio.destination);
  source.start(t);
  source.stop(end);
}
