import { Component, ChangeDetectionStrategy, signal, OnDestroy, effect, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppTheme } from '../video-editor/app.component';

export interface DrumTrack {
  name: string;
  steps: boolean[]; // 16 steps
  mute: boolean;
  vol: number; // 0-1
}

@Component({
  selector: 'app-drum-machine',
  templateUrl: './drum-machine.component.html',
  styleUrls: ['./drum-machine.component.css'],
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DrumMachineComponent implements OnDestroy {
  theme = input.required<AppTheme>();

  // State
  isPlaying = signal(false);
  bpm = signal(120);
  currentStep = signal(-1);

  tracks = signal<DrumTrack[]>([
    { name: 'Kick', steps: Array(16).fill(false), mute: false, vol: 0.8 },
    { name: 'Snare', steps: Array(16).fill(false), mute: false, vol: 0.7 },
    { name: 'Hi-Hat', steps: Array(16).fill(false), mute: false, vol: 0.6 },
    { name: 'Clap', steps: Array(16).fill(false), mute: false, vol: 0.7 },
  ]);

  // Audio Context
  private audioContext: AudioContext | null = null;
  private timerId?: number;
  private nextNoteTime = 0.0;
  private scheduleAheadTime = 0.1;
  private lookahead = 25.0;

  constructor() {
    // Initialize with a simple beat
    this.updateTrackStep(0, 0, true);
    this.updateTrackStep(0, 8, true); // Kick on 1 and 9
    this.updateTrackStep(1, 4, true);
    this.updateTrackStep(1, 12, true); // Snare on 5 and 13
  }

  ngOnDestroy(): void {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
    }
  }

  async initAudio() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  togglePlay() {
    this.initAudio().then(() => {
      if (this.isPlaying()) {
        this.stop();
      } else {
        this.start();
      }
    });
  }

  start() {
    if (this.isPlaying()) return;
    this.isPlaying.set(true);
    this.currentStep.set(0);
    this.nextNoteTime = this.audioContext!.currentTime;
    this.scheduler();
  }

  stop() {
    this.isPlaying.set(false);
    if (this.timerId) {
      window.clearTimeout(this.timerId);
    }
    this.currentStep.set(-1);
  }

  reset() {
    this.stop();
    this.tracks.update(t => t.map(track => ({...track, steps: Array(16).fill(false)})));
  }

  private scheduler() {
    if (!this.isPlaying()) return;

    // While there are notes that will need to play before the next interval, schedule them and advance the pointer.
    while (this.nextNoteTime < this.audioContext!.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.currentStep(), this.nextNoteTime);
      this.nextStep();
    }
    this.timerId = window.setTimeout(() => this.scheduler(), this.lookahead);
  }

  private nextStep() {
    const secondsPerBeat = 60.0 / this.bpm();
    this.nextNoteTime += 0.25 * secondsPerBeat; // Advance by 1/4 beat (16th note)
    this.currentStep.update(step => (step + 1) % 16);
  }

  private scheduleNote(stepNumber: number, time: number) {
    // Update UI step indicator roughly in sync
    // (Note: precise visual sync with audio time is harder, this is "good enough" for now)
    // To strictly sync UI, we'd use requestAnimationFrame but checking time.

    this.tracks().forEach((track, index) => {
      if (track.steps[stepNumber] && !track.mute) {
        this.playDrumSound(index, time, track.vol);
      }
    });
  }

  updateTrackStep(trackIndex: number, stepIndex: number, active?: boolean) {
    this.tracks.update(tracks => {
      const newTracks = [...tracks];
      const newSteps = [...newTracks[trackIndex].steps];
      // Toggle if active not provided, otherwise set
      newSteps[stepIndex] = active !== undefined ? active : !newSteps[stepIndex];
      newTracks[trackIndex] = { ...newTracks[trackIndex], steps: newSteps };
      return newTracks;
    });
  }

  // --- Sound Synthesis ---

  private playDrumSound(trackIndex: number, time: number, volume: number) {
    const ctx = this.audioContext!;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    gain.connect(ctx.destination);

    switch (trackIndex) {
      case 0: // Kick
        this.playKick(ctx, time, gain);
        break;
      case 1: // Snare
        this.playSnare(ctx, time, gain);
        break;
      case 2: // Hi-Hat
        this.playHiHat(ctx, time, gain);
        break;
      case 3: // Clap
        this.playClap(ctx, time, gain);
        break;
    }
  }

  private playKick(ctx: AudioContext, time: number, output: AudioNode) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);

    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

    osc.connect(gain);
    gain.connect(output);

    osc.start(time);
    osc.stop(time + 0.5);
  }

  private playSnare(ctx: AudioContext, time: number, output: AudioNode) {
    // Noise
    const bufferSize = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1000;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(1, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(output);

    // Tone
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(100, time);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.5, time); // Blended
    oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

    osc.connect(oscGain);
    oscGain.connect(output);

    noise.start(time);
    osc.start(time);
    noise.stop(time + 0.2);
    osc.stop(time + 0.2);
  }

  private playHiHat(ctx: AudioContext, time: number, output: AudioNode) {
    const bufferSize = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 10000;

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 7000;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.6, time); // Quieter
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05); // Very short

    noise.connect(bandpass);
    bandpass.connect(highpass);
    highpass.connect(gain);
    gain.connect(output);

    noise.start(time);
    noise.stop(time + 0.05);
  }

  private playClap(ctx: AudioContext, time: number, output: AudioNode) {
    const bufferSize = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 1;

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.setValueAtTime(1, time + 0.001);
    envelope.gain.exponentialRampToValueAtTime(0.1, time + 0.01);
    envelope.gain.setValueAtTime(1, time + 0.011);
    envelope.gain.exponentialRampToValueAtTime(0.1, time + 0.02);
    envelope.gain.setValueAtTime(1, time + 0.021);
    envelope.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

    noise.connect(filter);
    filter.connect(envelope);
    envelope.connect(output);

    noise.start(time);
    noise.stop(time + 0.15);
  }

  // --- AI Command Handlers ---

  handleAiBeat(style: string) {
    // Reset
    this.tracks.update(t => t.map(track => ({...track, steps: Array(16).fill(false)})));

    if (style.toLowerCase().includes('trap')) {
        // Kick
        this.updateTrackStep(0, 0, true);
        this.updateTrackStep(0, 8, true); // Typical
        // Snare/Clap
        this.updateTrackStep(1, 8, true); // Snare on 3 (if half time) or 16th logic
        this.updateTrackStep(3, 8, true); // Clap on 3
        // HiHats (Fast)
        for(let i=0; i<16; i+=2) this.updateTrackStep(2, i, true);
        this.updateTrackStep(2, 3, true); // roll
        this.updateTrackStep(2, 6, true); // roll
    } else if (style.toLowerCase().includes('house')) {
        // Four on the floor
        [0, 4, 8, 12].forEach(i => this.updateTrackStep(0, i, true));
        // Open Hat
        [2, 6, 10, 14].forEach(i => this.updateTrackStep(2, i, true));
        // Clap/Snare
        [4, 12].forEach(i => this.updateTrackStep(3, i, true));
    } else {
        // Generic Hip Hop
        this.updateTrackStep(0, 0, true);
        this.updateTrackStep(0, 7, true);
        this.updateTrackStep(0, 10, true);
        this.updateTrackStep(1, 4, true);
        this.updateTrackStep(1, 12, true);
        for(let i=0; i<16; i+=2) this.updateTrackStep(2, i, true);
    }
  }
}
