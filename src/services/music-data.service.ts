import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { DeckState, initialDeckState, Track } from '../components/video-editor/app.component'; // Importing types
import { CloudStorageService } from './cloud-storage.service';

export interface PianoRollNote {
  midi: number;
  name: string;
  octave: number;
}

export type RepeatMode = 'off' | 'one' | 'all';

import { Step } from '../components/drum-machine/drum-machine.component';

export interface AppState {
  playlist: Track[];
  deckA: DeckState;
  deckB: DeckState;
  pianoRollSequence: { [key: number]: boolean[] }; // JSON friendly map
  drumMachinePattern: { grid: Step[][]; bpm: number };
  bpm: number;
  shuffle: boolean;
  repeat: RepeatMode;
}

@Injectable({
  providedIn: 'root'
})
export class MusicDataService {
  private cloudStorageService = inject(CloudStorageService);

  // State Signals
  playlist = signal<Track[]>([]);
  currentTrackIndex = signal<number>(-1);

  deckA = signal<DeckState>({ ...initialDeckState });
  deckB = signal<DeckState>({ ...initialDeckState });

  // Piano Roll State
  // Map<midi, boolean[]> is hard to serialize, using Object/Array for storage, Map for runtime if needed
  // We will store as a Map signal for the component, but serialize to object for storage
  pianoRollSequence = signal<Map<number, boolean[]>>(new Map());
  bpm = signal<number>(120);

  // Drum Machine State
  drumMachinePattern = signal<{ grid: Step[][]; bpm: number }>({ grid: [], bpm: 120 });

  // Playback Settings
  shuffle = signal<boolean>(false);
  repeat = signal<RepeatMode>('off');

  constructor() {
    this.loadState();

    // Auto-save effect
    effect(() => {
      this.saveState();
    });
  }

  private saveState(): void {
    // Convert Map to Object for JSON
    const seqObj: { [key: string]: boolean[] } = {};
    this.pianoRollSequence().forEach((val, key) => {
      seqObj[key.toString()] = val;
    });

    const state: AppState = {
      playlist: this.playlist(),
      deckA: this.deckA(),
      deckB: this.deckB(),
      pianoRollSequence: seqObj,
      drumMachinePattern: this.drumMachinePattern(),
      bpm: this.bpm(),
      shuffle: this.shuffle(),
      repeat: this.repeat(),
    };

    this.cloudStorageService.saveProject(state);
  }

  private loadState(): void {
    const state = this.cloudStorageService.loadProject();
    if (!state) return;

    try {
      if (state.playlist) this.playlist.set(state.playlist);

      if (state.deckA) this.deckA.set(state.deckA);
      if (state.deckB) this.deckB.set(state.deckB);

      if (state.pianoRollSequence) {
        const map = new Map<number, boolean[]>();
        Object.keys(state.pianoRollSequence).forEach(key => {
          map.set(parseInt(key), state.pianoRollSequence[key]);
        });
        this.pianoRollSequence.set(map);
      }

      if (state.drumMachinePattern) this.drumMachinePattern.set(state.drumMachinePattern);

      if (state.bpm) this.bpm.set(state.bpm);
      if (state.shuffle !== undefined) this.shuffle.set(state.shuffle);
      if (state.repeat) this.repeat.set(state.repeat);

    } catch (e) {
      console.error('Failed to load music state', e);
    }
  }

  // Advanced Playback Logic
  getNextTrackIndex(): number {
    const len = this.playlist().length;
    if (len === 0) return -1;

    const current = this.currentTrackIndex();
    const repeat = this.repeat();
    const shuffle = this.shuffle();

    if (repeat === 'one') {
      return current;
    }

    if (shuffle) {
      let next = Math.floor(Math.random() * len);
      // Try to avoid repeating the same track if possible
      if (len > 1 && next === current) {
        next = (next + 1) % len;
      }
      return next;
    }

    // Normal sequence
    const next = current + 1;
    if (next >= len) {
      return repeat === 'all' ? 0 : -1; // Stop if end and not repeat all
    }

    return next;
  }

  getPreviousTrackIndex(): number {
    const len = this.playlist().length;
    if (len === 0) return -1;

    const current = this.currentTrackIndex();
    // Standard prev logic: if shuffling, history is hard without a stack.
    // Simple approach: just go back in index, or random if shuffle (less ideal but simple).
    // Let's stick to index order for Prev unless we build a history stack.

    let prev = current - 1;
    if (prev < 0) {
      prev = this.repeat() === 'all' ? len - 1 : 0; // Loop or stay at start
    }
    return prev;
  }

  // Data Export Bundle
  getFullProjectState(): any {
    // This will be used by export logic
    const seqObj: { [key: string]: boolean[] } = {};
    this.pianoRollSequence().forEach((val, key) => {
      seqObj[key.toString()] = val;
    });

    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      playlist: this.playlist(),
      pianoRoll: {
        bpm: this.bpm(),
        sequence: seqObj
      },
      drumMachine: this.drumMachinePattern(),
      decks: {
        A: this.deckA().track,
        B: this.deckB().track
      },
      settings: {
        shuffle: this.shuffle(),
        repeat: this.repeat()
      }
    };
  }

  importProjectState(data: any): void {
    if (!data) return;

    if (data.playlist) this.playlist.set(data.playlist);

    if (data.pianoRoll) {
      if (data.pianoRoll.bpm) this.bpm.set(data.pianoRoll.bpm);
      if (data.pianoRoll.sequence) {
        const map = new Map<number, boolean[]>();
        Object.keys(data.pianoRoll.sequence).forEach(key => {
          map.set(parseInt(key), data.pianoRoll.sequence[key]);
        });
        this.pianoRollSequence.set(map);
      }
    }

      if (data.drumMachine) {
        this.drumMachinePattern.set(data.drumMachine);
      }

    if (data.decks) {
      if (data.decks.A) this.deckA.update(d => ({ ...d, track: data.decks.A }));
      if (data.decks.B) this.deckB.update(d => ({ ...d, track: data.decks.B }));
    }

    if (data.settings) {
      if (data.settings.shuffle !== undefined) this.shuffle.set(data.settings.shuffle);
      if (data.settings.repeat) this.repeat.set(data.settings.repeat);
    }
  }

  exportProject(): void {
    const state = this.getFullProjectState();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aura-project-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
