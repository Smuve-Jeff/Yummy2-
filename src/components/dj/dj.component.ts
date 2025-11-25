import { Component, ChangeDetectionStrategy, signal, ElementRef, viewChild, inject, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MusicDataService } from '../../services/music-data.service';
import { DeckState, ScratchState } from './dj.model';

@Component({
  selector: 'app-dj',
  templateUrl: './dj.component.html',
  styleUrls: ['./dj.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule],
  host: {
    '(window:mousemove)': 'onScratch($event)',
    '(window:touchmove)': 'onScratch($event)',
    '(window:mouseup)': 'onScratchEnd()',
    '(window:touchend)': 'onScratchEnd()',
  },
})
export class DjComponent implements OnInit, OnDestroy {
  @Input() audioContext!: AudioContext;
  @Input() crossfadeNode!: GainNode;

  private musicDataService = inject(MusicDataService);
  private vuIntervalId?: number;

  audioPlayerARef = viewChild<ElementRef<HTMLAudioElement>>('audioPlayerA');
  videoPlayerARef = viewChild<ElementRef<HTMLVideoElement>>('videoPlayerA');
  audioPlayerBRef = viewChild<ElementRef<HTMLAudioElement>>('audioPlayerB');
  videoPlayerBRef = viewChild<ElementRef<HTMLVideoElement>>('videoPlayerB');
  fileInputRef = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  deckA = this.musicDataService.deckA;
  deckB = this.musicDataService.deckB;

  crossfade = signal(0); // -1 is full A, 1 is full B
  loadingTargetDeck = signal<'A' | 'B' | null>(null);

  // Scratching State
  isScratchingA = signal(false);
  isScratchingB = signal(false);
  scratchRotationA = signal('');
  scratchRotationB = signal('');
  private scratchStateA: ScratchState = { active: false, lastAngle: 0, platterElement: null };
  private scratchStateB: ScratchState = { active: false, lastAngle: 0, platterElement: null };
  private readonly SCRATCH_SENSITIVITY = 2.5;

  // VU Meter State
  vuLevelA = signal(0);
  vuLevelB = signal(0);
  vuBars = Array(12).fill(0);

  // Internal Audio Nodes
  private gainNodeA!: GainNode;
  private gainNodeB!: GainNode;
  private analyserA!: AnalyserNode;
  private analyserB!: AnalyserNode;

  ngOnInit(): void {
    if (this.audioContext) {
      this.gainNodeA = this.audioContext.createGain();
      this.gainNodeB = this.audioContext.createGain();
      this.analyserA = this.audioContext.createAnalyser();
      this.analyserB = this.audioContext.createAnalyser();
    }
    this.initVUAnalysis();
  }

  ngOnDestroy(): void {
    if (this.vuIntervalId) {
      clearInterval(this.vuIntervalId);
    }
  }

  private initVUAnalysis(): void {
    this.vuIntervalId = window.setInterval(() => {
      if (this.analyserA) {
        const data = new Uint8Array(this.analyserA.fftSize);
        this.analyserA.getByteFrequencyData(data);
        const avg = data.reduce((sum, val) => sum + val, 0) / data.length;
        this.vuLevelA.set(avg / 255);
      }
      if (this.analyserB) {
        const data = new Uint8Array(this.analyserB.fftSize);
        this.analyserB.getByteFrequencyData(data);
        const avg = data.reduce((sum, val) => sum + val, 0) / data.length;
        this.vuLevelB.set(avg / 255);
      }
    }, 100);
  }

  onLoadedMetadata(event: Event, deckId: 'A' | 'B'): void {
    const player = event.target as HTMLAudioElement | HTMLVideoElement;
    const updateFn = (oldState: DeckState) => ({ ...oldState, duration: player.duration, progress: 0 });

    if (deckId === 'A') {
      this.deckA.update(updateFn);
      if (this.gainNodeA) {
        this.gainNodeA.gain.value = this.mapSliderToGain(this.deckA().gain);
      }
      let sourceNode = (player as any).__sourceNode;
      if (!sourceNode) {
        sourceNode = this.audioContext.createMediaElementSource(player as HTMLAudioElement);
        (player as any).__sourceNode = sourceNode;
        sourceNode.connect(this.gainNodeA);
        this.gainNodeA.connect(this.analyserA);
        this.analyserA.connect(this.crossfadeNode);
      }
    } else {
      this.deckB.update(updateFn);
      if (this.gainNodeB) {
        this.gainNodeB.gain.value = this.mapSliderToGain(this.deckB().gain);
      }
      let sourceNode = (player as any).__sourceNode;
      if (!sourceNode) {
        sourceNode = this.audioContext.createMediaElementSource(player as HTMLAudioElement);
        (player as any).__sourceNode = sourceNode;
        sourceNode.connect(this.gainNodeB);
        this.gainNodeB.connect(this.analyserB);
        this.analyserB.connect(this.crossfadeNode);
      }
    }
    this.loadingTargetDeck.set(null);
  }

  syncDeck(deckId: 'A' | 'B'): void {
    const deckToSync = deckId === 'A' ? this.deckA() : this.deckB();
    const otherDeck = deckId === 'A' ? this.deckB() : this.deckA();

    if (deckToSync.bpm > 0 && otherDeck.bpm > 0) {
      const newPlaybackRate = otherDeck.bpm / deckToSync.bpm;
      const deckRef = deckId === 'A' ? this.audioPlayerARef() : this.audioPlayerBRef();
      if (deckRef?.nativeElement) {
        deckRef.nativeElement.playbackRate = newPlaybackRate;
      }
      if (deckId === 'A') {
        this.deckA.update(state => ({ ...state, playbackRate: newPlaybackRate }));
      } else {
        this.deckB.update(state => ({ ...state, playbackRate: newPlaybackRate }));
      }
    }
  }

  togglePlayPause(deckId: 'A' | 'B'): void {
    const deckRef = deckId === 'A' ? this.audioPlayerARef() : this.audioPlayerBRef();
    const currentDeck = deckId === 'A' ? this.deckA() : this.deckB();

    if (!deckRef || !deckRef.nativeElement.src) return;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const isPlaying = !currentDeck.isPlaying;

    if (isPlaying) {
      let sourceNode = (deckRef.nativeElement as any).__sourceNode;
      if (!sourceNode) {
        sourceNode = this.audioContext.createMediaElementSource(deckRef.nativeElement);
        (deckRef.nativeElement as any).__sourceNode = sourceNode;

        if (deckId === 'A') {
          sourceNode.connect(this.gainNodeA);
          this.gainNodeA.connect(this.analyserA);
          this.analyserA.connect(this.crossfadeNode);
        } else {
          sourceNode.connect(this.gainNodeB);
          this.gainNodeB.connect(this.analyserB);
          this.analyserB.connect(this.crossfadeNode);
        }
      }
      deckRef.nativeElement.play();
    } else {
      deckRef.nativeElement.pause();
    }

    if (deckId === 'A') {
      this.deckA.update(state => ({ ...state, isPlaying }));
    } else {
      this.deckB.update(state => ({ ...state, isPlaying }));
    }
  }

  onProgressChange(event: Event, deckId: 'A' | 'B'): void {
    const newTime = parseInt((event.target as HTMLInputElement).value, 10);
    const deckRef = deckId === 'A' ? this.audioPlayerARef() : this.audioPlayerBRef();
    if (deckRef?.nativeElement) {
      deckRef.nativeElement.currentTime = newTime;
    }
  }

  toggleLoop(deckId: 'A' | 'B'): void {
    if (deckId === 'A') {
      this.deckA.update(state => ({ ...state, loop: !state.loop }));
    } else {
      this.deckB.update(state => ({ ...state, loop: !state.loop }));
    }
  }

  private mapSliderToGain(value: number): number {
    return value / 100;
  }

  onGainChange(event: Event, deckId: 'A' | 'B'): void {
    const newGain = parseInt((event.target as HTMLInputElement).value, 10);
    const gainValue = this.mapSliderToGain(newGain);
    if (deckId === 'A') {
      this.deckA.update(state => ({ ...state, gain: newGain }));
      if (this.gainNodeA) this.gainNodeA.gain.value = gainValue;
    } else {
      this.deckB.update(state => ({ ...state, gain: newGain }));
      if (this.gainNodeB) this.gainNodeB.gain.value = gainValue;
    }
  }

  onEqChange(event: Event, deckId: 'A' | 'B', band: 'High' | 'Mid' | 'Low'): void {
    const newValue = parseInt((event.target as HTMLInputElement).value, 10);
    if (deckId === 'A') {
      this.deckA.update(state => ({ ...state, [`eq${band}`]: newValue }));
    } else {
      this.deckB.update(state => ({ ...state, [`eq${band}`]: newValue }));
    }
  }

  getNormalizedFilterValue(freq: number): number {
    return Math.log10(freq / 20) / Math.log10(1000);
  }

  private mapFilterSliderToFreq(sliderValue: number): number {
    const minFreq = 20;
    const maxFreq = 20000;
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const logValue = logMin + (sliderValue * (logMax - logMin));
    return Math.pow(10, logValue);
  }

  onFilterChange(event: Event, deckId: 'A' | 'B'): void {
    const sliderValue = parseFloat((event.target as HTMLInputElement).value);
    const newFreq = this.mapFilterSliderToFreq(sliderValue);
    if (deckId === 'A') {
      this.deckA.update(state => ({ ...state, filterFreq: newFreq }));
    } else {
      this.deckB.update(state => ({ ...state, filterFreq: newFreq }));
    }
  }

  onPitchChange(event: Event, deckId: 'A' | 'B'): void {
    const newRate = parseFloat((event.target as HTMLInputElement).value);
    const deckRef = deckId === 'A' ? this.audioPlayerARef() : this.audioPlayerBRef();
    if (deckRef?.nativeElement) {
      deckRef.nativeElement.playbackRate = newRate;
    }
    if (deckId === 'A') {
      this.deckA.update(state => ({ ...state, playbackRate: newRate }));
    } else {
      this.deckB.update(state => ({ ...state, playbackRate: newRate }));
    }
  }

  onCrossfadeChange(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.crossfade.set(value);
    const gainA = Math.cos((value + 1) / 2 * (Math.PI / 2));
    const gainB = Math.cos((1 - value) / 2 * (Math.PI / 2));
    if (this.gainNodeA) this.gainNodeA.gain.value = gainA;
    if (this.gainNodeB) this.gainNodeB.gain.value = gainB;
  }

  private getElementAngle(element: HTMLElement, clientX: number, clientY: number): number {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    return Math.atan2(clientY - centerY, clientX - centerX);
  }

  onScratchStart(event: MouseEvent | TouchEvent, deckId: 'A' | 'B'): void {
    const platterElement = (event.currentTarget as HTMLElement).querySelector('.vinyl-platter');
    if (!platterElement) return;
    event.preventDefault();
    let clientX: number, clientY: number;
    if (event instanceof TouchEvent) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    const deckRef = deckId === 'A' ? this.audioPlayerARef() : this.audioPlayerBRef();
    const scratchState = deckId === 'A' ? this.scratchStateA : this.scratchStateB;
    scratchState.active = true;
    scratchState.platterElement = platterElement as HTMLElement;
    scratchState.lastAngle = this.getElementAngle(platterElement as HTMLElement, clientX, clientY);
    if (deckRef?.nativeElement && this.deckA().isPlaying) {
      deckRef.nativeElement.pause();
      if (deckId === 'A') this.deckA.update(state => ({ ...state, isPlaying: false, wasPlayingBeforeScratch: true }));
      else this.deckB.update(state => ({ ...state, isPlaying: false, wasPlayingBeforeScratch: true }));
    } else {
      if (deckId === 'A') this.deckA.update(state => ({ ...state, wasPlayingBeforeScratch: false }));
      else this.deckB.update(state => ({ ...state, wasPlayingBeforeScratch: false }));
    }
    if (deckId === 'A') this.isScratchingA.set(true);
    else this.isScratchingB.set(true);
  }

  onScratch(event: MouseEvent | TouchEvent): void {
    if (!this.scratchStateA.active && !this.scratchStateB.active) return;
    event.preventDefault();
    let clientX: number, clientY: number;
    if (event instanceof TouchEvent) {
      if (event.touches.length === 0) return;
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    if (this.scratchStateA.active) this.applyScratch(this.scratchStateA, clientX, clientY, 'A');
    if (this.scratchStateB.active) this.applyScratch(this.scratchStateB, clientX, clientY, 'B');
  }

  private applyScratch(scratchState: ScratchState, clientX: number, clientY: number, deckId: 'A' | 'B'): void {
    if (!scratchState.platterElement) return;
    const deckRef = deckId === 'A' ? this.audioPlayerARef() : this.audioPlayerBRef();
    const currentAngle = this.getElementAngle(scratchState.platterElement, clientX, clientY);
    let deltaAngle = currentAngle - scratchState.lastAngle;
    if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
    if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
    const rotationSetter = deckId === 'A' ? this.scratchRotationA : this.scratchRotationB;
    rotationSetter.update(rot => `rotate(${parseFloat(rot.replace(/[^\d.-]/g, '')) + (deltaAngle * 180 / Math.PI)}deg)`);
    if (deckRef?.nativeElement?.src) {
      deckRef.nativeElement.currentTime += deltaAngle * this.SCRATCH_SENSITIVITY;
    }
    scratchState.lastAngle = currentAngle;
  }

  onScratchEnd(): void {
    if (this.scratchStateA.active) {
      this.scratchStateA.active = false;
      this.isScratchingA.set(false);
      if (this.deckA().wasPlayingBeforeScratch) this.togglePlayPause('A');
    }
    if (this.scratchStateB.active) {
      this.scratchStateB.active = false;
      this.isScratchingB.set(false);
      if (this.deckB().wasPlayingBeforeScratch) this.togglePlayPause('B');
    }
  }
}
