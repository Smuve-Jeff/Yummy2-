import { Component, ChangeDetectionStrategy, signal, OnDestroy, AfterViewInit, input, effect } from '@angular/core';
import { CommonModule, NgFor } from '@angular/common';
import { AppTheme } from '../video-editor/app.component'; // Correct path

const BASE_OCTAVE = 3; // Starting MIDI note for C3
const NUMBER_OF_NOTES_PER_OCTAVE = 12; // C to B
const NUMBER_OF_OCTAVES = 2; // C3 to B4 for visible piano roll
const STEPS_PER_BAR = 16; // 16th notes in 4/4

export interface PianoRollNote {
  midi: number;
  name: string;
  octave: number;
}

const ALL_NOTES: PianoRollNote[] = [];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

for (let octave = BASE_OCTAVE; octave < BASE_OCTAVE + NUMBER_OF_OCTAVES; octave++) {
  for (let i = 0; i < NUMBER_OF_NOTES_PER_OCTAVE; i++) {
    ALL_NOTES.push({
      midi: 60 + (octave - 4) * 12 + i, // MIDI 60 is C4. We adjust for BASE_OCTAVE.
      name: NOTE_NAMES[i],
      octave: octave,
    });
  }
}
// Reverse to have higher notes at the top of the UI
ALL_NOTES.reverse();


@Component({
  selector: 'app-piano-roll',
  templateUrl: './piano-roll.component.html',
  styleUrls: ['./piano-roll.component.css'],
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PianoRollComponent implements AfterViewInit, OnDestroy {
  theme = input.required<AppTheme>();

  // State
  allNotes = ALL_NOTES;
  bpm = signal(120);
  isPlaying = signal(false);
  currentStep = signal(-1);
  // Sequence: Map<midi_note_number, boolean[]> where boolean[] is a 16-step array
  sequence = signal<Map<number, boolean[]>>(new Map());

  // Music theory helpers
  scales = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
  };
  keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  selectedKey = signal('C');
  selectedScale = signal('major');

  // Audio
  private audioContext: AudioContext | null = null;
  private timerId?: number;
  private masterGainNode?: GainNode;

  constructor() {
    this.initializeEmptySequence();
    effect(() => {
      // Re-initialize sequence if notes change (though `allNotes` is static here)
      // This is a placeholder for potential dynamic note ranges in the future
      this.initializeEmptySequence();
    });
  }

  ngAfterViewInit(): void {
    // Audio context will be initialized on first user interaction (play button)
  }

  ngOnDestroy(): void {
    this.stop();
    this.audioContext?.close().catch(e => console.error("Error closing AudioContext:", e));
  }

  private initializeEmptySequence(): void {
    const newSequence = new Map<number, boolean[]>();
    this.allNotes.forEach(note => {
      newSequence.set(note.midi, Array(STEPS_PER_BAR).fill(false));
    });
    this.sequence.set(newSequence);
  }

  private async initAudio(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'running') return;

    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.masterGainNode = this.audioContext.createGain();
      this.masterGainNode.gain.value = 0.5; // Initial volume
      this.masterGainNode.connect(this.audioContext.destination);
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  async togglePlay(): Promise<void> {
    await this.initAudio();
    if (this.isPlaying()) {
      this.stop();
    } else {
      this.start();
    }
  }

  start(): void {
    if (this.isPlaying()) return;
    this.isPlaying.set(true);
    // Reset to step 0 if stopped, or continue from current step
    this.currentStep.set(this.currentStep() === -1 ? 0 : this.currentStep());
    this.scheduleNextStep();
  }

  stop(): void {
    this.isPlaying.set(false);
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = undefined;
    }
    // Don't reset currentStep, allows resuming from current position.
  }

  resetSequence(): void {
    this.stop();
    this.currentStep.set(-1);
    this.initializeEmptySequence();
  }

  private scheduleNextStep(): void {
    if (!this.isPlaying()) return;
    if (!this.audioContext) return;

    const secondsPerBeat = 60.0 / this.bpm();
    const secondsPerStep = secondsPerBeat / 4; // 16th notes

    this.timerId = window.setTimeout(() => {
      const currentStep = this.currentStep();
      this.playStep(currentStep);
      this.currentStep.update(s => (s + 1) % STEPS_PER_BAR);
      this.scheduleNextStep();
    }, secondsPerStep * 1000);
  }

  private playStep(step: number): void {
    if (!this.audioContext || !this.masterGainNode) return;

    this.sequence().forEach((stepsForNote, midiNote) => {
      if (stepsForNote[step]) {
        this.playNote(midiNote, this.audioContext.currentTime);
      }
    });
  }

  private playNote(midiNote: number, startTime: number): void {
    if (!this.audioContext || !this.masterGainNode) return;

    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12); // A4 is MIDI 69
    const attackTime = 0.01;
    const decayTime = 0.3;
    const sustainLevel = 0.7;
    const releaseTime = 0.2;

    const now = this.audioContext.currentTime;

    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(1, now + attackTime);
    gainNode.gain.linearRampToValueAtTime(sustainLevel, now + attackTime + decayTime);
    gainNode.gain.setValueAtTime(sustainLevel, now + attackTime + decayTime + releaseTime);
    gainNode.gain.linearRampToValueAtTime(0, now + attackTime + decayTime + releaseTime + 0.1);


    const oscillator1 = this.audioContext.createOscillator();
    oscillator1.type = 'sine';
    oscillator1.frequency.setValueAtTime(frequency, startTime);

    const oscillator2 = this.audioContext.createOscillator();
    oscillator2.type = 'triangle';
    oscillator2.frequency.setValueAtTime(frequency * 2, startTime);


    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(this.masterGainNode);

    oscillator1.start(startTime);
    oscillator2.start(startTime);

    oscillator1.stop(startTime + 0.5);
    oscillator2.stop(startTime + 0.5);
  }

  toggleNote(midiNote: number, stepIndex: number): void {
    this.sequence.update(currentSequence => {
      const stepsForNote = currentSequence.get(midiNote);
      if (stepsForNote) {
        stepsForNote[stepIndex] = !stepsForNote[stepIndex];
      }
      return new Map(currentSequence);
    });
  }

  onBpmChange(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(value) && value >= 60 && value <= 240) {
      this.bpm.set(value);
      if (this.isPlaying()) {
        // Restart sequencer to apply new BPM immediately
        this.stop();
        this.start();
      }
    }
  }

  // Helper to format note names for display
  getNoteDisplay(note: PianoRollNote): string {
    return `${note.name}${note.octave}`;
  }

  objectKeys(obj: object): string[] {
    return Object.keys(obj);
  }

  getNotesInScale(): number[] {
    const rootNote = this.keys.indexOf(this.selectedKey());
    const scale = this.scales[this.selectedScale()];
    const notesInScale = [];
    for (let i = 0; i < NUMBER_OF_OCTAVES * 12; i++) {
      if (scale.includes(i % 12)) {
        notesInScale.push(rootNote + i);
      }
    }
    console.log('notes in scale', notesInScale);
    return notesInScale;
  }
}