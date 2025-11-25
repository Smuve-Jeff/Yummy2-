import { Component, ChangeDetectionStrategy, signal, Input, OnChanges, SimpleChanges, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MusicDataService } from '../../services/music-data.service';

// Represents a single drum sample
export interface DrumSound {
  name: string;
  path: string;
  audioBuffer?: AudioBuffer;
}

// Represents a single step in the sequencer for a specific sound
export interface Step {
  active: boolean;
}

@Component({
  selector: 'app-drum-machine',
  templateUrl: './drum-machine.component.html',
  styleUrls: ['./drum-machine.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule],
})
export class DrumMachineComponent implements OnChanges {
  @Input() initialPattern: { style: string; bpm?: number } | null = null;

  // --- State Signals ---

  // The grid of steps for the sequencer
  grid = signal<Step[][]>([]);
  // The available drum sounds
  sounds = signal<DrumSound[]>([]);
  // The current BPM (Beats Per Minute)
  bpm = signal(120);
  // Whether the sequencer is currently playing
  isPlaying = signal(false);
  // The currently highlighted step in the sequence
  currentStep = signal(0);

  // --- Audio Context and Timing ---

  private audioContext: AudioContext;
  private nextStepTime = 0.0; // When the next step is due to play
  private timerId?: number;
  private musicDataService = inject(MusicDataService);

  constructor() {
    this.audioContext = new AudioContext();
    this.initializeSoundsAndGrid();

    // Update service when grid or bpm changes
    effect(() => {
      this.musicDataService.drumMachinePattern.set({
        grid: this.grid(),
        bpm: this.bpm(),
      });
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialPattern'] && this.initialPattern) {
      this.generatePattern(this.initialPattern.style, this.initialPattern.bpm);
    }
  }

  private initializeSoundsAndGrid(): void {
    const initialPattern = this.musicDataService.drumMachinePattern();
    if (initialPattern && initialPattern.grid.length > 0) {
      this.grid.set(initialPattern.grid);
      this.bpm.set(initialPattern.bpm);
    }

    const initialSounds: DrumSound[] = [
      { name: 'Kick', path: 'assets/sounds/kick.wav' },
      { name: 'Snare', path: 'assets/sounds/snare.wav' },
      { name: 'Clap', path: 'assets/sounds/clap.wav' },
      { name: 'Hi-Hat (Closed)', path: 'assets/sounds/hihat-closed.wav' },
      { name: 'Hi-Hat (Open)', path: 'assets/sounds/hihat-open.wav' },
      { name: 'Tom (High)', path: 'assets/sounds/tom-high.wav' },
      { name: 'Tom (Mid)', path: 'assets/sounds/tom-mid.wav' },
      { name: 'Tom (Low)', path: 'assets/sounds/tom-low.wav' },
    ];
    this.sounds.set(initialSounds);
    this.loadSounds();

    // Create an 8x16 grid of steps (8 sounds, 16 steps)
    const newGrid: Step[][] = [];
    for (let i = 0; i < initialSounds.length; i++) {
      const row: Step[] = [];
      for (let j = 0; j < 16; j++) {
        row.push({ active: false });
      }
      newGrid.push(row);
    }
    this.grid.set(newGrid);
  }

  private async loadSounds(): Promise<void> {
    for (const sound of this.sounds()) {
      try {
        const response = await fetch(sound.path);
        const arrayBuffer = await response.arrayBuffer();
        sound.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      } catch (error) {
        console.error(`Error loading sound: ${sound.name}`, error);
      }
    }
  }

  // --- Sequencer Logic ---

  togglePlay(): void {
    this.isPlaying.update(p => !p);
    if (this.isPlaying()) {
      this.currentStep.set(0);
      this.nextStepTime = this.audioContext.currentTime;
      this.scheduler();
    } else {
      if (this.timerId) {
        clearTimeout(this.timerId);
        this.timerId = undefined;
      }
    }
  }

  private scheduler(): void {
    while (this.nextStepTime < this.audioContext.currentTime + 0.1) {
      this.playStep();
      this.advanceStep();
    }
    this.timerId = window.setTimeout(() => this.scheduler(), 25.0);
  }

  private playStep(): void {
    const step = this.currentStep();
    const soundsToPlay = this.sounds();

    for (let i = 0; i < soundsToPlay.length; i++) {
      if (this.grid()[i][step].active && soundsToPlay[i].audioBuffer) {
        this.playSound(soundsToPlay[i].audioBuffer!);
      }
    }
  }

  private playSound(buffer: AudioBuffer): void {
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    source.start();
  }

  private advanceStep(): void {
    const secondsPerBeat = 60.0 / this.bpm();
    this.nextStepTime += 0.25 * secondsPerBeat; // 16th notes
    this.currentStep.update(s => (s + 1) % 16);
  }

  // --- UI Interaction ---

  toggleStep(soundIndex: number, stepIndex: number): void {
    this.grid.update(currentGrid => {
      const newGrid = [...currentGrid];
      const newRow = [...newGrid[soundIndex]];
      newRow[stepIndex] = { ...newRow[stepIndex], active: !newRow[stepIndex].active };
      newGrid[soundIndex] = newRow;
      return newGrid;
    });
  }

  onBpmChange(event: Event): void {
    const newBpm = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(newBpm) && newBpm > 0) {
      this.bpm.set(newBpm);
    }
  }

  clearPattern(): void {
    this.grid.update(currentGrid =>
      currentGrid.map(row => row.map(() => ({ active: false })))
    );
  }

  private generatePattern(style: string, bpm?: number): void {
    if (bpm) {
      this.bpm.set(bpm);
    }

    const newGrid = this.grid().map(row => row.map(() => ({ active: false })));

    switch (style.toLowerCase()) {
      case 'hip-hop':
        // Kick on 1 and 3
        newGrid[0][0] = { active: true };
        newGrid[0][8] = { active: true };
        // Snare on 2 and 4
        newGrid[1][4] = { active: true };
        newGrid[1][12] = { active: true };
        // Hi-hats on every 8th note
        for (let i = 0; i < 16; i += 2) {
          newGrid[3][i] = { active: true };
        }
        break;
      case 'house':
        // Kick on every beat
        for (let i = 0; i < 16; i += 4) {
          newGrid[0][i] = { active: true };
        }
        // Snare on 2 and 4
        newGrid[1][4] = { active: true };
        newGrid[1][12] = { active: true };
        // Open hi-hat on the off-beat
        for (let i = 2; i < 16; i += 4) {
          newGrid[4][i] = { active: true };
        }
        break;
      case 'techno':
        // Kick on every beat
        for (let i = 0; i < 16; i += 4) {
          newGrid[0][i] = { active: true };
        }
        // Clap on 2 and 4
        newGrid[2][4] = { active: true };
        newGrid[2][12] = { active: true };
        // Hi-hats on every 16th note
        for (let i = 0; i < 16; i++) {
          newGrid[3][i] = { active: true };
        }
        break;
    }

    this.grid.set(newGrid);
  }
}