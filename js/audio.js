// =============================================================================
// INTRODUCTION DINO - AUDIO MANAGER
// Authentic Chromium SFX, retro welcoming startup jingle, and soothing,
// peaceful Minecraft-ambient background music (~8-12% volume, loopable)
// =============================================================================

import { ASSETS } from './assets.js';
import { PersistenceManager } from './persistence.js';

export class AudioManager {
  constructor() {
    this.audioContext = null;
    this.soundBuffers = {};
    this.isMuted = PersistenceManager.getMuteState();
    this.isInitialized = false;
    this.hasPlayedStartup = false;
    this.lastPlayed = {};

    // Background Ambient Music Nodes & State
    this.bgmBuffer = null;
    this.bgmSource = null;
    this.bgmGainNode = null;
    this.masterGainNode = null;
    this.isBgmPlaying = false;
    this.bgmTargetVolume = 0.095; // 9.5% volume (within 8-12% target)
  }

  /**
   * Initialize AudioContext with decoded sound assets and ambient BGM
   */
  async init() {
    if (this.isInitialized) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioContext) {
        this.audioContext = new AudioContextClass();
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Master gain for unified mute control
      this.masterGainNode = this.audioContext.createGain();
      this.masterGainNode.gain.setValueAtTime(this.isMuted ? 0 : 1, 0);
      this.masterGainNode.connect(this.audioContext.destination);

      // BGM gain node with gentle initial zero gain
      this.bgmGainNode = this.audioContext.createGain();
      this.bgmGainNode.gain.setValueAtTime(0, 0);
      this.bgmGainNode.connect(this.masterGainNode);

      await Promise.all([
        this.loadSound('press', ASSETS.SOUND_PRESS),
        this.loadSound('hit', ASSETS.SOUND_HIT),
        this.loadSound('reached', ASSETS.SOUND_REACHED),
        this.generateAmbientBGM(),
      ]);

      this.isInitialized = true;
    } catch (err) {
      console.warn('AudioContext initialization note:', err);
    }
  }

  async loadSound(name, dataUri) {
    if (!this.audioContext) return;

    try {
      const base64Data = dataUri.split(',')[1];
      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer);
      this.soundBuffers[name] = audioBuffer;
    } catch (e) {
      console.warn(`Could not decode audio ${name}:`, e);
    }
  }

  /**
   * Synthesize original, peaceful, Minecraft-style ambient music (~32s loop)
   * Warm felt piano / chimes + analog pad in Fmaj9 -> Cadd9 -> Am9 -> Em7
   */
  async generateAmbientBGM() {
    if (this.bgmBuffer) return this.bgmBuffer;

    try {
      const OfflineCtxClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!OfflineCtxClass) return null;

      const sampleRate = 44100;
      const duration = 32; // 32 seconds seamless loop
      const offlineCtx = new OfflineCtxClass(2, sampleRate * duration, sampleRate);

      // Warm low-pass filter (cuts harsh highs, leaves warm mellow acoustic character)
      const masterFilter = offlineCtx.createBiquadFilter();
      masterFilter.type = 'lowpass';
      masterFilter.frequency.setValueAtTime(1200, 0);
      masterFilter.Q.setValueAtTime(0.7, 0);
      masterFilter.connect(offlineCtx.destination);

      // Helper to synthesize soft acoustic chime / felt piano note
      const playAcousticNote = (freq, time, dur, pan = 0, gainLevel = 0.16) => {
        [1.0, 2.0].forEach((harmonic, idx) => {
          const osc = offlineCtx.createOscillator();
          const gain = offlineCtx.createGain();
          const panner = offlineCtx.createStereoPanner ? offlineCtx.createStereoPanner() : null;

          osc.type = idx === 0 ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(freq * harmonic, time);

          const hGain = idx === 0 ? gainLevel : gainLevel * 0.28;
          // Soft attack and natural singing decay
          gain.gain.setValueAtTime(0, time);
          gain.gain.linearRampToValueAtTime(hGain, time + 0.025);
          gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

          osc.connect(gain);
          if (panner) {
            panner.pan.setValueAtTime(pan, time);
            gain.connect(panner);
            panner.connect(masterFilter);
          } else {
            gain.connect(masterFilter);
          }

          osc.start(time);
          osc.stop(time + dur + 0.1);
        });
      };

      // Helper for warm ambient pad cushion underneath
      const playAmbientPad = (freq, time, dur, gainLevel = 0.04) => {
        const osc = offlineCtx.createOscillator();
        const gain = offlineCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(gainLevel, time + 2.0);
        gain.gain.setValueAtTime(gainLevel, time + dur - 2.0);
        gain.gain.linearRampToValueAtTime(0.0001, time + dur);

        osc.connect(gain);
        gain.connect(masterFilter);

        osc.start(time);
        osc.stop(time + dur + 0.1);
      };

      // 4 Ambient Bars (8 seconds per chord = 32s total)
      // Bar 1: Fmaj9 (0s - 8s)
      playAmbientPad(87.31, 0, 8, 0.045);  // F2
      playAmbientPad(130.81, 0, 8, 0.035); // C3
      playAmbientPad(220.00, 0, 8, 0.03);  // A3
      playAmbientPad(329.63, 0, 8, 0.025); // E4
      playAcousticNote(523.25, 0.8, 5.0, -0.2, 0.15);  // C5
      playAcousticNote(659.25, 3.2, 4.5, 0.2, 0.14);   // E5
      playAcousticNote(783.99, 5.4, 4.0, -0.15, 0.13); // G5

      // Bar 2: Cadd9 (8s - 16s)
      playAmbientPad(65.41, 8, 8, 0.045);  // C2
      playAmbientPad(98.00, 8, 8, 0.035);  // G2
      playAmbientPad(164.81, 8, 8, 0.03);  // E3
      playAmbientPad(293.66, 8, 8, 0.025); // D4
      playAcousticNote(587.33, 9.0, 5.0, 0.22, 0.15);  // D5
      playAcousticNote(783.99, 11.2, 4.5, -0.2, 0.14); // G5
      playAcousticNote(659.25, 13.6, 4.2, 0.15, 0.13); // E5

      // Bar 3: Am9 (16s - 24s)
      playAmbientPad(110.00, 16, 8, 0.045); // A2
      playAmbientPad(164.81, 16, 8, 0.035); // E3
      playAmbientPad(261.63, 16, 8, 0.03);  // C4
      playAmbientPad(493.88, 16, 8, 0.025); // B4
      playAcousticNote(523.25, 17.0, 5.0, -0.2, 0.15); // C5
      playAcousticNote(493.88, 19.4, 4.5, 0.22, 0.14); // B4
      playAcousticNote(440.00, 21.8, 4.2, -0.15, 0.13); // A4

      // Bar 4: Em7 / G (24s - 32s)
      playAmbientPad(98.00, 24, 8, 0.045);  // G2
      playAmbientPad(146.83, 24, 8, 0.035); // D3
      playAmbientPad(246.94, 24, 8, 0.03);  // B3
      playAmbientPad(369.99, 24, 8, 0.025); // F#4
      playAcousticNote(493.88, 25.0, 5.0, 0.2, 0.14);   // B4
      playAcousticNote(587.33, 27.2, 4.5, -0.22, 0.14); // D5
      playAcousticNote(392.00, 29.5, 4.2, 0.1, 0.13);   // G4

      this.bgmBuffer = await offlineCtx.startRendering();
      return this.bgmBuffer;
    } catch (e) {
      console.warn('Ambient BGM generation note:', e);
      return null;
    }
  }

  /**
   * Start or fade in the background music
   */
  startBGM() {
    if (!this.audioContext || !this.bgmGainNode) return;

    if (!this.bgmSource && this.bgmBuffer) {
      this.bgmSource = this.audioContext.createBufferSource();
      this.bgmSource.buffer = this.bgmBuffer;
      this.bgmSource.loop = true;
      this.bgmSource.connect(this.bgmGainNode);
      try {
        this.bgmSource.start(0);
      } catch (e) {}
    }

    this.isBgmPlaying = true;
    const now = this.audioContext.currentTime;
    this.bgmGainNode.gain.cancelScheduledValues(now);
    this.bgmGainNode.gain.setValueAtTime(this.bgmGainNode.gain.value, now);
    this.bgmGainNode.gain.linearRampToValueAtTime(this.bgmTargetVolume, now + 2.5);
  }

  /**
   * Fade out the background music on crash or pause
   */
  pauseBGM(duration = 1.2) {
    if (!this.audioContext || !this.bgmGainNode) return;
    const now = this.audioContext.currentTime;
    this.bgmGainNode.gain.cancelScheduledValues(now);
    this.bgmGainNode.gain.setValueAtTime(this.bgmGainNode.gain.value, now);
    this.bgmGainNode.gain.linearRampToValueAtTime(0, now + duration);
  }

  /**
   * Resume background music on safe recovery
   */
  resumeBGM(duration = 2.0) {
    if (!this.audioContext || !this.bgmGainNode) return;
    if (!this.bgmSource) {
      this.startBGM();
      return;
    }
    const now = this.audioContext.currentTime;
    this.bgmGainNode.gain.cancelScheduledValues(now);
    this.bgmGainNode.gain.setValueAtTime(this.bgmGainNode.gain.value, now);
    this.bgmGainNode.gain.linearRampToValueAtTime(this.bgmTargetVolume, now + duration);
  }

  /**
   * Attempt to play the startup jingle on load if browser autoplay permits
   */
  tryAutoPlayStartup() {
    if (this.hasPlayedStartup || this.isMuted) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!this.audioContext) {
        this.audioContext = new AudioContextClass();
      }
      if (this.audioContext.state === 'running') {
        this.playStartupMusic();
      }
    } catch (e) {}
  }

  /**
   * Short, cheerful, nostalgic chiptune welcoming jingle (~1.5s)
   */
  playStartupMusic() {
    if (this.hasPlayedStartup || this.isMuted) return;
    this.hasPlayedStartup = true;

    try {
      if (!this.audioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        this.audioContext = new AudioContextClass();
      }

      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      const ctx = this.audioContext;
      const now = ctx.currentTime;

      // Filter for warm retro character
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2800, now);

      const jingleGain = ctx.createGain();
      jingleGain.gain.setValueAtTime(0.12, now);

      filter.connect(jingleGain);
      if (this.masterGainNode) {
        jingleGain.connect(this.masterGainNode);
      } else {
        jingleGain.connect(ctx.destination);
      }

      // Cute, cheerful 8-bit greeting arpeggio
      const notes = [
        { freq: 659.25, time: 0.00, dur: 0.12 }, // E5
        { freq: 830.61, time: 0.14, dur: 0.12 }, // G#5
        { freq: 987.77, time: 0.28, dur: 0.14 }, // B5
        { freq: 1318.51, time: 0.44, dur: 0.26 }, // E6
        { freq: 1244.51, time: 0.72, dur: 0.14 }, // D#6
        { freq: 1318.51, time: 0.88, dur: 0.55 }, // E6 final chime
      ];

      notes.forEach(({ freq, time, dur }) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + time);

        // Soft ADSR envelope
        noteGain.gain.setValueAtTime(0, now + time);
        noteGain.gain.linearRampToValueAtTime(1.0, now + time + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);

        osc.connect(noteGain);
        noteGain.connect(filter);

        osc.start(now + time);
        osc.stop(now + time + dur + 0.05);
      });
    } catch (e) {
      console.warn('Startup musical moment error:', e);
    }
  }

  play(name, cooldown = 80) {
    if (this.isMuted || !this.audioContext || !this.isInitialized) return;

    // Prevent accidental rapid duplicate playback
    const now = performance.now();
    if (this.lastPlayed[name] && (now - this.lastPlayed[name] < cooldown)) {
      return;
    }
    this.lastPlayed[name] = now;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    const buffer = this.soundBuffers[name];
    if (buffer) {
      try {
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        if (this.masterGainNode) {
          source.connect(this.masterGainNode);
        } else {
          source.connect(this.audioContext.destination);
        }
        source.start(0);
      } catch (e) {}
    }
  }

  /**
   * Jump sound with explicit 300ms cooldown (prevents repeated Spacebar spam)
   */
  playPress() {
    this.play('press', 300);
  }

  playHit() {
    this.play('hit', 200);
  }

  playScoreReached() {
    this.play('reached', 300);
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    PersistenceManager.setMuteState(this.isMuted);

    if (this.masterGainNode && this.audioContext) {
      const now = this.audioContext.currentTime;
      this.masterGainNode.gain.cancelScheduledValues(now);
      this.masterGainNode.gain.setValueAtTime(this.isMuted ? 0 : 1, now);
    }

    return this.isMuted;
  }
}
