import { Component, ChangeDetectionStrategy, signal, ElementRef, viewChild, effect, OnDestroy, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EqPanelComponent } from '../eq-panel/eq-panel.component'; // Corrected path for EqPanelComponent
import { MatrixBackgroundComponent } from '../matrix-background/matrix-background.component';
import { ChatbotComponent } from '../audio-visualizer/chatbot/chatbot.component';
import { ImageEditorComponent } from '../image-editor/image-editor.component';
import { VideoEditorComponent } from './video-editor.component';
import { AudioVisualizerComponent } from '../audio-visualizer/audio-visualizer.component'; // Corrected import path
import { PianoRollComponent } from '../piano-roll/piano-roll.component'; // Import PianoRollComponent
import { DrumMachineComponent } from '../drum-machine/drum-machine.component'; // Import DrumMachineComponent
import { NetworkingComponent, ArtistProfile, MOCK_ARTISTS } from '../networking/networking.component'; // NEW: Import NetworkingComponent and types
import { AiService } from '../../services/ai.service'; // NEW: Import AiService

// FIX: Augment HTMLAudioElement to include custom __sourceNode property
declare global {
  interface HTMLAudioElement {
    __sourceNode?: MediaElementAudioSourceNode;
  }
}

export interface Track {
  title: string;
  artist: string;
  albumArtUrl: string;
  audioSrc: string;
  videoSrc?: string;
}

export interface EqBand {
  label: string;
  value: number;
}

export interface Enhancements {
  bassBoost: boolean;
  surroundSound: boolean;
}

export interface DeckState {
  track: Track;
  isPlaying: boolean;
  progress: number;
  duration: number;
  playbackRate: number; // Pitch
  filterFreq: number; // FX (Low-pass filter frequency)
  loop: boolean;
  gain: number;
  eqHigh: number;
  eqMid: number;
  eqLow: number;
  wasPlayingBeforeScratch?: boolean; // NEW: To restore play state after scratch
}

export const initialDeckState: DeckState = {
  track: {
    title: 'NO SIGNAL',
    artist: 'Load a track into deck',
    albumArtUrl: 'https://picsum.photos/seed/placeholder/500/500',
    audioSrc: '',
  },
  isPlaying: false,
  progress: 0,
  duration: 0,
  playbackRate: 1,
  filterFreq: 20000, // Start with filter wide open
  loop: false,
  gain: 50, // 0-100
  eqHigh: 50, // 0-100
  eqMid: 50, // 0-100
  eqLow: 50, // 0-100
  wasPlayingBeforeScratch: false,
};

type ScratchState = {
  active: boolean;
  lastAngle: number;
  platterElement: HTMLElement | null;
  initialTouchX?: number; // NEW
  initialTouchY?: number; // NEW
};

// New: Theme interface and predefined themes
export interface AppTheme {
  name: string;
  primary: string; // Tailwind color name (e.g., 'green', 'amber')
  accent: string;  // Tailwind color name for DJ mode (e.g., 'amber', 'blue')
  neutral: string; // Tailwind color name for neutral backgrounds/text (e.g., 'neutral', 'stone')
  purple: string; // Added for editor themes, though usually generic, using it for specific editors
  red: string; // Added for editor themes, though usually generic, using it for specific editors
  blue: string; // NEW: Added for networking theme
}

const THEMES: AppTheme[] = [
  { name: 'Green Vintage', primary: 'green', accent: 'amber', neutral: 'neutral', purple: 'purple', red: 'red', blue: 'blue' },
  { name: 'Blue Retro', primary: 'blue', accent: 'fuchsia', neutral: 'zinc', purple: 'purple', red: 'red', blue: 'blue' },
  { name: 'Red Glitch', primary: 'red', accent: 'cyan', neutral: 'stone', purple: 'purple', red: 'red', blue: 'blue' },
  { name: 'Amber Glow', primary: 'amber', accent: 'green', neutral: 'neutral', purple: 'purple', red: 'red', blue: 'blue' },
  { name: 'Purple Haze', primary: 'purple', accent: 'lime', neutral: 'slate', purple: 'purple', red: 'red', blue: 'blue' },
  { name: 'Cyan Wave', primary: 'cyan', accent: 'violet', neutral: 'gray', purple: 'purple', red: 'red', blue: 'blue' },
  { name: 'Yellow Neon', primary: 'yellow', accent: 'red', neutral: 'stone', purple: 'purple', red: 'red', blue: 'blue' },
];

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, EqPanelComponent, MatrixBackgroundComponent, ChatbotComponent, ImageEditorComponent, VideoEditorComponent, AudioVisualizerComponent, PianoRollComponent, DrumMachineComponent, NetworkingComponent],
  host: {
    // Moved host listeners from @HostListener decorators to the host object
    '(window:mousemove)': 'onScratch($event)',
    '(window:touchmove)': 'onScratch($event)',
    '(window:mouseup)': 'onScratchEnd()',
    '(window:touchend)': 'onScratchEnd()',
  },
})
export class AppComponent implements OnDestroy {
  audioPlayerARef = viewChild<ElementRef<HTMLAudioElement>>('audioPlayerA');
  videoPlayerARef = viewChild<ElementRef<HTMLVideoElement>>('videoPlayerA');
  audioPlayerBRef = viewChild<ElementRef<HTMLAudioElement>>('audioPlayerB');
  videoPlayerBRef = viewChild<ElementRef<HTMLVideoElement>>('videoPlayerB');
  fileInputRef = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  // NEW: ViewChild for Drum Machine
  drumMachineRef = viewChild<DrumMachineComponent>(DrumMachineComponent);

  // App mode
  mainViewMode = signal<'player' | 'dj' | 'piano-roll' | 'drum-machine' | 'image-editor' | 'video-editor' | 'networking'>('player');
  showChatbot = signal(true); // Chatbot is a modal, starts open for initial greeting

  // DJ State
  deckA = signal<DeckState>({ ...initialDeckState });
  deckB = signal<DeckState>({ ...initialDeckState });
  crossfade = signal(0); // -1 is full A, 1 is full B
  loadingTargetDeck = signal<'A' | 'B' | null>(null);

  // Scratching State
  isScratchingA = signal(false);
  isScratchingB = signal(false);
  scratchRotationA = signal('');
  scratchRotationB = signal('');
  private scratchStateA: ScratchState = { active: false, lastAngle: 0, platterElement: null };
  private scratchStateB: ScratchState = { active: false, lastAngle: 0, platterElement: null };
  private readonly SCRATCH_SENSITIVITY = 2.5; // Adjust to control scratch responsiveness

  // Player State
  playlist = signal<Track[]>([]);
  currentTrackIndex = signal<number>(-1);
  currentPlayerTrack = computed<Track | null>(() => {
    const idx = this.currentTrackIndex();
    const list = this.playlist();
    return (idx >= 0 && idx < list.length) ? list[idx] : null;
  });

  // Master State
  volume = signal(0.75);
  showEqPanel = signal(false);

  // Search state
  searchQuery = signal('');
  isSearching = signal(false);
  searchResults = signal<Track[]>([]);

  // Master Effects State
  eqSettings = signal<EqBand[]>([
    { label: '60Hz', value: 50 }, { label: '310Hz', value: 50 }, { label: '1KHz', value: 50 },
    { label: '6KHz', value: 50 }, { label: '16KHz', value: 50 },
  ]);
  enhancements = signal<Enhancements>({ bassBoost: false, surroundSound: false });

  // Recording State
  isRecording = signal(false);
  recordingTime = signal(0);
  recordedMixUrl = signal<string | null>(null);
  private recordedBlob = signal<Blob | null>(null);
  canShare = computed(() => !!(navigator.share && this.recordedBlob()));

  // VU Meter State
  vuLevelA = signal(0);
  vuLevelB = signal(0);
  vuLevelMaster = signal(0);
  vuBars = Array(12).fill(0); // For template iteration

  // NEW: Microphone State
  micEnabled = signal(false);
  micVolume = signal(50); // 0-100
  micEqHigh = signal(50); // 0-100
  micEqMid = signal(50); // 0-100
  micEqLow = signal(50); // 0-100
  micFilterFreq = signal(20000); // Low-pass filter frequency, 20Hz-20KHz
  vuLevelMic = signal(0); // VU level for microphone

  // NEW: Theming State
  readonly THEMES = THEMES;
  currentTheme = signal<AppTheme>(THEMES[0]);

  // Computed CSS classes for dynamic theming
  mainBorderClass = computed(() => `border-${this.currentTheme().primary}-400/50`);
  mainTextColorClass = computed(() => `text-${this.currentTheme().primary}-400`);
  mainHoverBgClass = computed(() => `hover:bg-${this.currentTheme().primary}-400 hover:text-black`);
  mainBg90050Class = computed(() => `bg-${this.currentTheme().primary}-900/50`);

  djBorderClass = computed(() => `border-${this.currentTheme().accent}-500/30`);
  djTextColorClass = computed(() => `text-${this.currentTheme().accent}-400`);
  djActiveBgClass = computed(() => `bg-${this.currentTheme().accent}-500`);
  djHoverBgClass = computed(() => `hover:bg-${this.currentTheme().accent}-500 hover:text-black`);
  djBg80050Class = computed(() => `bg-${this.currentTheme().neutral}-800/50`);
  djTextAccent300Class = computed(() => `text-${this.currentTheme().accent}-300`);
  djTextNeutral400Class = computed(() => `text-${this.currentTheme().neutral}-400`);
  djBgStone900 = computed(() => `bg-${this.currentTheme().neutral}-900`);
  djBgStone700 = computed(() => `bg-${this.currentTheme().neutral}-700`);

  // Audio Context and Nodes
  private audioContext!: AudioContext;
  private analyserMaster!: AnalyserNode;
  private analyserA!: AnalyserNode;
  private analyserB!: AnalyserNode;
  private analyserMic!: AnalyserNode;

  private gainNodeMaster!: GainNode;
  private gainNodeA!: GainNode;
  private gainNodeB!: GainNode;
  private crossfadeNode!: GainNode;
  private eqNodesMaster: BiquadFilterNode[] = [];

  // NEW: Microphone Audio Nodes
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private micGainNode: GainNode | null = null;
  private micEqNodes: BiquadFilterNode[] = [];
  private micFilterNode: BiquadFilterNode | null = null;
  private micStream: MediaStream | null = null; // To hold the microphone stream

  // Recording nodes
  private destinationNode!: MediaStreamAudioDestinationNode; // FIX: Corrected type name
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingIntervalId?: number;
  private vuIntervalId?: number;

  // NEW: AI Feature States
  imageEditorInitialPrompt = signal<string>(''); // For image editor commands from chatbot
  videoEditorInitialPrompt = signal<string>(''); // For video editor commands from chatbot
  lastImageEditorImageUrl = signal<string | null>(null); // To pass image from editor to video generator

  showApplyAlbumArtModal = signal(false);
  imageToApplyAsAlbumArt = signal<string | null>(null);

  imageToAnalyzeUrl = signal<string | null>(null); // URL of image to send to chatbot for analysis
  imageAnalysisResult = signal<string | null>(null); // Result of image analysis from chatbot
  showImageAnalysisModal = signal(false); // Controls display of image analysis modal

  mapLocationQuery = signal<string | null>(null); // Query for map search from chatbot
  mapLocationResult = signal<string | null>(null); // Result of map search from chatbot
  showMapResultsModal = signal(false); // Controls display of map results modal

  networkingLocationQuery = signal<string | null>(null); // NEW: Query for networking search
  selectedArtistProfile = signal<ArtistProfile | null>(null); // NEW: For displaying detailed artist profile
  showArtistDetailModal = signal(false); // NEW: Controls display of artist detail modal

  private aiService = inject(AiService); // Inject AiService

  constructor() {
    this.initAudioContext();
    this.initVUAnalysis();

    // Listen for changes in isAiAvailable from AiService
    effect(() => {
      // FIX: Access isAiAvailable as a getter property
      if (!this.aiService.isAiAvailable) {
        console.warn('AppComponent: AI services are not available.');
      }
    });

    // Effect to observe image analysis result and show modal
    effect(() => {
      const result = this.imageAnalysisResult();
      if (result) {
        this.showImageAnalysisModal.set(true);
      }
    });

    // Effect to observe map location result and show modal
    effect(() => {
      const result = this.mapLocationResult();
      if (result) {
        this.showMapResultsModal.set(true);
      }
    });

    // Effect to observe selectedArtistProfile and show modal
    effect(() => {
      const artist = this.selectedArtistProfile();
      if (artist) {
        this.showArtistDetailModal.set(true);
      }
    });

    // Set initial track for player mode
    this.loadTrackToDeck(initialDeckState.track, 'A');
  }

  ngOnDestroy(): void {
    this.stopAllAudio();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(e => console.error('Error closing audio context:', e));
    }
    if (this.vuIntervalId) {
      clearInterval(this.vuIntervalId);
    }
    this.stopMediaStream(); // Stop microphone stream if active
  }

  private initAudioContext(): void {
    if (this.audioContext) return; // Prevent re-initialization

    this.audioContext = new AudioContext();

    // Create master nodes
    this.gainNodeMaster = this.audioContext.createGain();
    this.crossfadeNode = this.audioContext.createGain(); // Crossfade is applied before master gain

    // Create analysers
    this.analyserMaster = this.audioContext.createAnalyser();
    this.analyserA = this.audioContext.createAnalyser();
    this.analyserB = this.audioContext.createAnalyser();
    this.analyserMic = this.audioContext.createAnalyser(); // For microphone VU meter

    // Create destination for recording
    this.destinationNode = this.audioContext.createMediaStreamDestination();

    // Connect master chain: Crossfade -> EQ -> Master Gain -> Analyser -> Destination & Speakers
    this.crossfadeNode.connect(this.gainNodeMaster);
    this.setupMasterEq(this.gainNodeMaster); // EQ nodes are connected here
    this.eqNodesMaster[this.eqNodesMaster.length - 1].connect(this.analyserMaster); // Last EQ node connects to analyser
    this.analyserMaster.connect(this.destinationNode); // Connect to recording destination
    this.analyserMaster.connect(this.audioContext.destination); // Connect to speakers

    // Initialize crossfader position
    this.onCrossfadeChange({ target: { value: this.crossfade() } } as any);
    this.onVolumeChange({ target: { value: this.volume() } } as any);

    // Initialize EQ settings
    this.eqSettings().forEach((band, index) => {
      this.onMasterEqChange(this.eqSettings());
    });
  }

  private setupMasterEq(inputNode: AudioNode): void {
    this.eqNodesMaster = [];
    const frequencies = [60, 310, 1000, 6000, 16000]; // Standard EQ bands

    for (let i = 0; i < frequencies.length; i++) {
      const eq = this.audioContext.createBiquadFilter();
      eq.type = 'peaking';
      eq.frequency.value = frequencies[i];
      eq.Q.value = 1; // Quality factor
      eq.gain.value = 0; // Default flat
      this.eqNodesMaster.push(eq);
    }

    // Connect them in series
    if (this.eqNodesMaster.length > 0) {
      inputNode.connect(this.eqNodesMaster[0]);
      for (let i = 0; i < this.eqNodesMaster.length - 1; i++) {
        this.eqNodesMaster[i].connect(this.eqNodesMaster[i + 1]);
      }
      // The last EQ node will be connected to the analyserMaster outside this function
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
      if (this.analyserMaster) {
        const data = new Uint8Array(this.analyserMaster.fftSize);
        this.analyserMaster.getByteFrequencyData(data);
        const avg = data.reduce((sum, val) => sum + val, 0) / data.length;
        this.vuLevelMaster.set(avg / 255);
      }
      if (this.analyserMic && this.micEnabled()) {
        const data = new Uint8Array(this.analyserMic.fftSize);
        this.analyserMic.getByteFrequencyData(data);
        const avg = data.reduce((sum, val) => sum + val, 0) / data.length;
        this.vuLevelMic.set(avg / 255);
      }
    }, 100); // Update VU meters 10 times per second
  }

  getMasterAnalyser(): AnalyserNode | undefined {
    return this.analyserMaster;
  }

  // --- File Loading ---

  private activeFileInputDeck: 'A' | 'B' | null = null;
  private activeFileInputTrackPlayer: boolean = false;

  openFilePickerForDeck(deck: 'A' | 'B' | null): void {
    this.activeFileInputDeck = deck;
    this.activeFileInputTrackPlayer = (deck === null); // If null, it's for the main player
    this.fileInputRef()!.nativeElement.click();
  }

  handleFileInput(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const newTrack: Track = {
        title: file.name,
        artist: 'Local File',
        albumArtUrl: 'https://picsum.photos/seed/' + Math.random().toString(36).substring(7) + '/500/500', // Random placeholder
        audioSrc: url,
        videoSrc: file.type.startsWith('video/') ? url : undefined,
      };

      if (this.activeFileInputDeck === 'A') {
        this.loadTrackToDeck(newTrack, 'A');
      } else if (this.activeFileInputDeck === 'B') {
        this.loadTrackToDeck(newTrack, 'B');
      } else if (this.activeFileInputTrackPlayer) {
        this.addTrackToPlaylist(newTrack, true); // Load to main player and play immediately
      }
    }
    // Reset file input to allow selecting same file again
    if (this.fileInputRef()) {
      this.fileInputRef()!.nativeElement.value = '';
    }
    this.activeFileInputDeck = null;
    this.activeFileInputTrackPlayer = false;
  }

  loadTrackToDeck(track: Track, deckId: 'A' | 'B'): void {
    const deckRef = deckId === 'A' ? this.audioPlayerARef() : this.audioPlayerBRef();
    const videoRef = deckId === 'A' ? this.videoPlayerARef() : this.videoPlayerBRef();

    const currentDeck = deckId === 'A' ? this.deckA() : this.deckB();

    // Pause current track if playing
    if (currentDeck.isPlaying) {
      deckRef?.nativeElement.pause();
      if (videoRef?.nativeElement) {
        videoRef.nativeElement.pause();
      }
    }

    if (!deckRef) {
      console.error(`Audio player reference for deck ${deckId} not found.`);
      return;
    }

    // Set loading state
    this.loadingTargetDeck.set(deckId);

    // Update deck state with new track
    const newDeckState = {
      ...initialDeckState, // Reset other settings
      track: track,
      isPlaying: false, // Will be set to true on first play
    };

    if (deckId === 'A') {
      this.deckA.set(newDeckState);
      deckRef.nativeElement.src = track.audioSrc;
      if (this.videoPlayerARef()?.nativeElement) {
        this.videoPlayerARef()!.nativeElement.src = track.videoSrc || '';
      }
    } else {
      this.deckB.set(newDeckState);
      deckRef.nativeElement.src = track.audioSrc;
      if (this.videoPlayerBRef()?.nativeElement) {
        this.videoPlayerBRef()!.nativeElement.src = track.videoSrc || '';
      }
    }
  }

  // --- Playback Controls ---

  togglePlayPause(deckId: 'A' | 'B' | 'player' = 'player'): void {
    const deckRef = deckId === 'A' ? this.audioPlayerARef() : deckId === 'B' ? this.audioPlayerBRef() : this.audioPlayerARef();
    const videoRef = deckId === 'A' ? this.videoPlayerARef() : deckId === 'B' ? this.videoPlayerBRef() : this.videoPlayerARef();
    const currentDeck = deckId === 'A' ? this.deckA() : deckId === 'B' ? this.deckB() : this.deckA(); // For player mode, default to deckA

    if (!deckRef || !deckRef.nativeElement.src) {
      console.warn(`No track loaded for deck ${deckId}.`);
      return;
    }

    // Ensure AudioContext is resumed on first user interaction
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(e => console.error("Error resuming AudioContext:", e));
    }

    const isPlaying = !currentDeck.isPlaying;

    if (isPlaying) {
      // Connect audio source to Web Audio API graph if not already connected
      let sourceNode = deckRef.nativeElement.__sourceNode;
      if (!sourceNode) {
        sourceNode = this.audioContext.createMediaElementSource(deckRef.nativeElement);
        deckRef.nativeElement.__sourceNode = sourceNode; // Store for future reference

        // Create specific gain nodes for each deck
        if (deckId === 'A') {
          this.gainNodeA = this.audioContext.createGain();
          sourceNode.connect(this.gainNodeA);
          this.gainNodeA.connect(this.analyserA); // Connect to analyser A
          this.analyserA.connect(this.crossfadeNode);
        } else if (deckId === 'B') {
          this.gainNodeB = this.audioContext.createGain();
          sourceNode.connect(this.gainNodeB);
          this.gainNodeB.connect(this.analyserB); // Connect to analyser B
          this.analyserB.connect(this.crossfadeNode);
        } else { // Player mode, assume deck A
          this.gainNodeA = this.audioContext.createGain();
          sourceNode.connect(this.gainNodeA);
          sourceNode.connect(this.analyserA); // Connect to analyser A
          this.analyserA.connect(this.crossfadeNode);
        }
      }

      deckRef.nativeElement.play().catch(e => console.error(`Error playing deck ${deckId}:`, e));
      if (videoRef?.nativeElement) {
        videoRef.nativeElement.play().catch(e => console.error(`Error playing video for deck ${deckId}:`, e));
      }
    } else {
      deckRef.nativeElement.pause();
      if (videoRef?.nativeElement) {
        videoRef.nativeElement.pause();
      }
    }

    const updateFn = (oldState: DeckState) => ({ ...oldState, isPlaying: isPlaying });
    if (deckId === 'A' || deckId === 'player') {
      this.deckA.update(updateFn);
    } else {
      this.deckB.update(updateFn);
    }
  }

  onTimeUpdate(event: Event, deckId: 'A' | 'B'): void {
    const player = event.target as HTMLAudioElement | HTMLVideoElement;
    const updateFn = (oldState: DeckState) => ({ ...oldState, progress: player.currentTime });
    if (deckId === 'A') {
      this.deckA.update(updateFn);
    } else {
      this.deckB.update(updateFn);
    }
  }

  onLoadedMetadata(event: Event, deckId: 'A' | 'B'): void {
    const player = event.target as HTMLAudioElement | HTMLVideoElement;
    const updateFn = (oldState: DeckState) => ({ ...oldState, duration: player.duration, progress: 0 });

    // FIX: Set initial gain values when metadata is loaded
    if (deckId === 'A') {
      this.deckA.update(updateFn);
      if (this.gainNodeA) {
        this.gainNodeA.gain.value = this.mapSliderToGain(this.deckA().gain);
      }
      // Reconnect if needed or ensure connections are fresh for Web Audio API
      let sourceNode = (player as HTMLAudioElement).__sourceNode;
      if (!sourceNode) {
        sourceNode = this.audioContext.createMediaElementSource(player as HTMLAudioElement);
        (player as HTMLAudioElement).__sourceNode = sourceNode;
        this.gainNodeA = this.audioContext.createGain();
        sourceNode.connect(this.gainNodeA);
        this.gainNodeA.connect(this.analyserA);
        this.analyserA.connect(this.crossfadeNode);
      }

      this.onEqChange({ target: { value: this.deckA().eqHigh } } as any, 'A', 'High');
      this.onEqChange({ target: { value: this.deckA().eqMid } } as any, 'A', 'Mid');
      this.onEqChange({ target: { value: this.deckA().eqLow } } as any, 'A', 'Low');
      this.onFilterChange({ target: { value: this.getNormalizedFilterValue(this.deckA().filterFreq) } } as any, 'A');
    } else {
      this.deckB.update(updateFn);
      if (this.gainNodeB) {
        this.gainNodeB.gain.value = this.mapSliderToGain(this.deckB().gain);
      }
      // Reconnect if needed or ensure connections are fresh for Web Audio API
      let sourceNode = (player as HTMLAudioElement).__sourceNode;
      if (!sourceNode) {
        sourceNode = this.audioContext.createMediaElementSource(player as HTMLAudioElement);
        (player as HTMLAudioElement).__sourceNode = sourceNode;
        this.gainNodeB = this.audioContext.createGain();
        sourceNode.connect(this.gainNodeB);
        this.gainNodeB.connect(this.analyserB);
        this.analyserB.connect(this.crossfadeNode);
      }

      this.onEqChange({ target: { value: this.deckB().eqHigh } } as any, 'B', 'High');
      this.onEqChange({ target: { value: this.deckB().eqMid } } as any, 'B', 'Mid');
      this.onEqChange({ target: { value: this.deckB().eqLow } } as any, 'B', 'Low');
      this.onFilterChange({ target: { value: this.getNormalizedFilterValue(this.deckB().filterFreq) } } as any, 'B');
    }

    // Reset loading state
    this.loadingTargetDeck.set(null);
  }

  onEnded(deckId: 'A' | 'B'): void {
    const updateFn = (oldState: DeckState) => ({ ...oldState, isPlaying: false, progress: 0 });
    if (deckId === 'A') {
      this.deckA.update(oldState => (oldState.loop ? { ...oldState, progress: 0, isPlaying: true } : updateFn(oldState)));
      if (this.deckA().loop) {
        this.audioPlayerARef()!.nativeElement.currentTime = 0;
        this.audioPlayerARef()!.nativeElement.play();
        this.videoPlayerARef()?.nativeElement.play();
      }
    } else {
      this.deckB.update(oldState => (oldState.loop ? { ...oldState, progress: 0, isPlaying: true } : updateFn(oldState)));
      if (this.deckB().loop) {
        this.audioPlayerBRef()!.nativeElement.currentTime = 0;
        this.audioPlayerBRef()!.nativeElement.play();
        this.videoPlayerBRef()?.nativeElement.play();
      }
    }

    // If in player mode and track ends, play next track
    if (this.mainViewMode() === 'player' && deckId === 'A' && !this.deckA().loop) {
      this.playNext();
    }
  }

  onProgressChange(event: Event, deckId: 'A' | 'B'): void {
    const newTime = parseInt((event.target as HTMLInputElement).value, 10);
    const deckRef = deckId === 'A' ? this.audioPlayerARef() : this.audioPlayerBRef();
    const videoRef = deckId === 'A' ? this.videoPlayerARef() : this.videoPlayerBRef();
    if (deckRef?.nativeElement) {
      deckRef.nativeElement.currentTime = newTime;
      if (videoRef?.nativeElement) {
        videoRef.nativeElement.currentTime = newTime;
      }
    }
    const updateFn = (oldState: DeckState) => ({ ...oldState, progress: newTime });
    if (deckId === 'A') {
      this.deckA.update(updateFn);
    } else {
      this.deckB.update(updateFn);
    }
  }

  toggleLoop(deckId: 'A' | 'B'): void {
    const updateFn = (oldState: DeckState) => ({ ...oldState, loop: !oldState.loop });
    if (deckId === 'A') {
      this.deckA.update(updateFn);
    } else {
      this.deckB.update(updateFn);
    }
  }

  // --- Playlist Controls (for Player mode) ---

  addTrackToPlaylist(track: Track, playImmediately: boolean = false): void {
    this.playlist.update(list => [...list, track]);
    this.searchResults.set([]); // Clear search results after adding

    if (playImmediately) {
      const newIndex = this.playlist().length - 1;
      this.playTrackFromPlaylist(newIndex);
    }
  }

  playTrackFromPlaylist(index: number): void {
    const list = this.playlist();
    if (index >= 0 && index < list.length) {
      this.currentTrackIndex.set(index);
      const track = list[index];
      this.loadTrackToDeck(track, 'A'); // Load into Deck A for player mode
      // Play after metadata loaded in onLoadedMetadata
      if (!this.deckA().isPlaying) { // Only play if not already playing to avoid double play issue
        this.togglePlayPause('A');
      }
    }
  }

  playNext(): void {
    const list = this.playlist();
    if (list.length === 0) return;

    const nextIndex = (this.currentTrackIndex() + 1) % list.length;
    this.playTrackFromPlaylist(nextIndex);
  }

  playPrevious(): void {
    const list = this.playlist();
    if (list.length === 0) return;

    let prevIndex = (this.currentTrackIndex() - 1);
    if (prevIndex < 0) {
      prevIndex = list.length - 1; // Wrap around to end
    }
    this.playTrackFromPlaylist(prevIndex);
  }

  // --- Global Controls ---

  onVolumeChange(event: Event): void {
    const newVolume = parseFloat((event.target as HTMLInputElement).value);
    this.volume.set(newVolume);
    if (this.gainNodeMaster) {
      this.gainNodeMaster.gain.value = newVolume;
    }
  }

  toggleEqPanel(): void {
    this.showEqPanel.update(val => !val);
  }

  onMasterEqChange(newSettings: EqBand[]): void {
    this.eqSettings.set(newSettings);
    newSettings.forEach((band, index) => {
      if (this.eqNodesMaster[index]) {
        this.eqNodesMaster[index].gain.value = this.mapSliderToDb(band.value);
      }
    });
  }

  onEnhancementsChange(newEnhancements: Enhancements): void {
    this.enhancements.set(newEnhancements);
    // Placeholder for actual Web Audio API enhancement logic
    // For bass boost, you'd typically use another BiquadFilterNode (low-shelf)
    // For surround sound, a more complex spatialization setup is needed.
    console.log('Enhancements updated:', newEnhancements);
  }

  // --- DJ Mixer Specific Controls ---

  private mapSliderToGain(value: number): number {
    return value / 100; // 0-100 slider to 0-1 gain
  }

  onGainChange(event: Event, deckId: 'A' | 'B'): void {
    const newGain = parseInt((event.target as HTMLInputElement).value, 10);
    const gainValue = this.mapSliderToGain(newGain);
    const updateFn = (oldState: DeckState) => ({ ...oldState, gain: newGain });

    if (deckId === 'A') {
      this.deckA.update(updateFn);
      if (this.gainNodeA) this.gainNodeA.gain.value = gainValue;
    } else {
      this.deckB.update(updateFn);
      if (this.gainNodeB) this.gainNodeB.gain.value = gainValue;
    }
  }

  private mapSliderToDb(value: number): number {
    // Maps a 0-100 slider value to dB range, e.g., -12dB to +12dB
    return (value - 50) * 0.48; // (value - 50) gives -50 to +50, multiplied by 0.48 gives -24 to +24 dB approximately, adjustable
  }

  onEqChange(event: Event, deckId: 'A' | 'B', band: 'High' | 'Mid' | 'Low'): void {
    const newValue = parseInt((event.target as HTMLInputElement).value, 10);
    const dbValue = this.mapSliderToDb(newValue);
    const updateFn = (oldState: DeckState) => ({ ...oldState, [`eq${band}`]: newValue });

    if (deckId === 'A') {
      this.deckA.update(updateFn);
      // Logic to control deck-specific EQ (requires dedicated BiquadFilterNodes for each deck, not currently implemented fully)
      // For now, these are UI controls. Actual audio EQ on decks is more complex than master EQ.
      // This would require creating 3 BiquadFilterNodes per deck (high, mid, low) and connecting them.
    } else {
      this.deckB.update(updateFn);
      // Same for deck B
    }
    // For now, let's just log this for demonstration purposes if actual deck EQs are not wired up
    // console.log(`Deck ${deckId} EQ ${band} changed to: ${newValue} (dB: ${dbValue})`);
  }

  // Maps 0-1 slider to filter frequency (20Hz to 20000Hz, logarithmic scale)
  getNormalizedFilterValue(freq: number): number {
    return Math.log10(freq / 20) / Math.log10(1000); // Inverse of mapFilterSliderToFreq
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
    const sliderValue = parseFloat((event.target as HTMLInputElement).value); // 0-1
    const newFreq = this.mapFilterSliderToFreq(sliderValue);
    const updateFn = (oldState: DeckState) => ({ ...oldState, filterFreq: newFreq });

    if (deckId === 'A') {
      this.deckA.update(updateFn);
      // Apply filter to deck A (requires dedicated BiquadFilterNode for the deck)
    } else {
      this.deckB.update(updateFn);
      // Apply filter to deck B
    }
    // console.log(`Deck ${deckId} filter changed to: ${newFreq} Hz`);
  }

  onPitchChange(event: Event, deckId: 'A' | 'B'): void {
    const newRate = parseFloat((event.target as HTMLInputElement).value);
    const deckRef = deckId === 'A' ? this.audioPlayerARef() : this.audioPlayerBRef();
    const videoRef = deckId === 'A' ? this.videoPlayerARef() : this.videoPlayerBRef();
    if (deckRef?.nativeElement) {
      deckRef.nativeElement.playbackRate = newRate;
      if (videoRef?.nativeElement) {
        videoRef.nativeElement.playbackRate = newRate;
      }
    }
    const updateFn = (oldState: DeckState) => ({ ...oldState, playbackRate: newRate });
    if (deckId === 'A') {
      this.deckA.update(updateFn);
    } else {
      this.deckB.update(updateFn);
    }
  }

  onCrossfadeChange(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value); // -1 to 1
    this.crossfade.set(value);

    // Calculate gain for each deck based on crossfader position
    // Formula for equal power crossfade:
    const gainA = Math.cos((value + 1) / 2 * (Math.PI / 2));
    const gainB = Math.cos((1 - value) / 2 * (Math.PI / 2));

    if (this.gainNodeA) this.gainNodeA.gain.value = gainA;
    if (this.gainNodeB) this.gainNodeB.gain.value = gainB;
  }

  // --- Scratching Logic ---

  private getElementAngle(element: HTMLElement, clientX: number, clientY: number): number {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    return Math.atan2(clientY - centerY, clientX - centerX);
  }

  onScratchStart(event: MouseEvent | TouchEvent, deckId: 'A' | 'B'): void {
    const platterElement = (event.currentTarget as HTMLElement).querySelector('.vinyl-platter');
    if (!platterElement) return;

    event.preventDefault(); // Prevent default touch actions like scrolling

    let clientX: number, clientY: number;
    if (event instanceof TouchEvent) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    const currentDeckState = deckId === 'A' ? this.deckA() : this.deckB();
    const deckRef = deckId === 'A' ? this.audioPlayerARef() : this.audioPlayerBRef();
    const videoRef = deckId === 'A' ? this.videoPlayerARef() : this.videoPlayerBRef();

    const scratchState = deckId === 'A' ? this.scratchStateA : this.scratchStateB;
    scratchState.active = true;
    scratchState.platterElement = platterElement as HTMLElement;
    scratchState.lastAngle = this.getElementAngle(platterElement as HTMLElement, clientX, clientY);
    scratchState.initialTouchX = clientX; // Store initial touch position
    scratchState.initialTouchY = clientY;

    // Pause the track and save its playing state
    if (deckRef?.nativeElement && currentDeckState.isPlaying) {
      deckRef.nativeElement.pause();
      if (videoRef?.nativeElement) {
        videoRef.nativeElement.pause();
      }
      if (deckId === 'A') {
        this.deckA.update(state => ({ ...state, isPlaying: false, wasPlayingBeforeScratch: true }));
      } else {
        this.deckB.update(state => ({ ...state, isPlaying: false, wasPlayingBeforeScratch: true }));
      }
    } else if (deckRef?.nativeElement) {
      // If it wasn't playing, ensure wasPlayingBeforeScratch is false
      if (deckId === 'A') {
        this.deckA.update(state => ({ ...state, wasPlayingBeforeScratch: false }));
      } else {
        this.deckB.update(state => ({ ...state, wasPlayingBeforeScratch: false }));
      }
    }

    if (deckId === 'A') this.isScratchingA.set(true);
    else this.isScratchingB.set(true);

    // console.log(`Scratch started on deck ${deckId}`);
  }

  onScratch(event: MouseEvent | TouchEvent): void {
    if (!this.scratchStateA.active && !this.scratchStateB.active) return;

    event.preventDefault(); // Prevent default scrolling for touch events

    let clientX: number, clientY: number;
    if (event instanceof TouchEvent) {
      if (event.touches.length === 0) return; // No active touches
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    if (this.scratchStateA.active && this.scratchStateA.platterElement) {
      this.applyScratch(this.scratchStateA, clientX, clientY, 'A');
    }
    if (this.scratchStateB.active && this.scratchStateB.platterElement) {
      this.applyScratch(this.scratchStateB, clientX, clientY, 'B');
    }
  }

  private applyScratch(scratchState: ScratchState, clientX: number, clientY: number, deckId: 'A' | 'B'): void {
    if (!scratchState.platterElement) return;

    const deckRef = deckId === 'A' ? this.audioPlayerARef() : this.audioPlayerBRef();
    const videoRef = deckId === 'A' ? this.videoPlayerARef() : this.videoPlayerBRef();

    const currentAngle = this.getElementAngle(scratchState.platterElement, clientX, clientY);
    let deltaAngle = currentAngle - scratchState.lastAngle;

    // Handle angle wrap-around (-PI to PI)
    if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
    if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

    // Apply rotation visually
    const currentRotation = parseInt(scratchState.platterElement.style.transform.replace('rotate(', '').replace('deg)', '') || '0', 10);
    const newRotation = currentRotation + (deltaAngle * 180 / Math.PI);
    const rotationSetter = deckId === 'A' ? this.scratchRotationA : this.scratchRotationB;
    rotationSetter.set(`rotate(${newRotation}deg)`);

    // Apply audio scratching effect
    if (deckRef?.nativeElement?.src) {
      // Calculate playbackDelta based on deltaAngle and sensitivity
      // A small deltaAngle results in a small time shift for scratching effect.
      // Assuming deltaAngle is in radians, and we map it to seconds.
      const playbackDelta = deltaAngle * this.SCRATCH_SENSITIVITY;
      deckRef.nativeElement.currentTime += playbackDelta;
      if (videoRef?.nativeElement) {
        videoRef.nativeElement.currentTime += playbackDelta;
      }
    }
    scratchState.lastAngle = currentAngle;
  }

  onScratchEnd(): void {
    if (this.isScratchingA() || this.isScratchingB()) {
      // console.log("Scratch ended.");
    }

    // Check deck A
    if (this.scratchStateA.active) {
      this.scratchStateA.active = false;
      this.scratchStateA.platterElement = null;
      this.isScratchingA.set(false);
      // Restore play state if it was playing before scratch
      if (this.deckA().wasPlayingBeforeScratch && this.audioPlayerARef()?.nativeElement && !this.deckA().isPlaying) {
        this.togglePlayPause('A');
      }
    }

    // Check deck B
    if (this.scratchStateB.active) {
      this.scratchStateB.active = false;
      this.scratchStateB.platterElement = null;
      this.isScratchingB.set(false);
      // Restore play state if it was playing before scratch
      if (this.deckB().wasPlayingBeforeScratch && this.audioPlayerBRef()?.nativeElement && !this.deckB().isPlaying) {
        this.togglePlayPause('B');
      }
    }
  }

  // --- Recording Master Output ---

  toggleRecording(): void {
    if (this.isRecording()) {
      this.stopMasterRecording();
    } else {
      this.startMasterRecording();
    }
  }

  startMasterRecording(): void {
    if (!this.audioContext || !this.destinationNode) {
      console.error('AudioContext or MediaStreamAudioDestinationNode not initialized.');
      return;
    }
    if (this.isRecording()) return;

    this.recordedChunks = [];
    this.recordedMixUrl.set(null);
    this.recordedBlob.set(null);
    this.recordingTime.set(0);

    try {
      this.mediaRecorder = new MediaRecorder(this.destinationNode.stream, { mimeType: 'audio/webm; codecs=opus' });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        this.recordedBlob.set(blob);
        this.recordedMixUrl.set(URL.createObjectURL(blob));
        console.log('Master recording stopped. Blob created.');
        if (this.recordingIntervalId) clearInterval(this.recordingIntervalId);
        this.recordingIntervalId = undefined;
      };

      this.mediaRecorder.onerror = (event: any) => {
        console.error('Master MediaRecorder error:', event.error);
        // Optionally display error to user
        this.isRecording.set(false);
        if (this.recordingIntervalId) clearInterval(this.recordingIntervalId);
        this.recordingIntervalId = undefined;
      };

      this.mediaRecorder.start();
      this.isRecording.set(true);
      this.recordingIntervalId = window.setInterval(() => this.recordingTime.update(t => t + 1), 1000);
      console.log('Master recording started.');
    } catch (e: any) {
      console.error('Error starting Master MediaRecorder:', e);
      // Optionally display error to user
      this.isRecording.set(false);
    }
  }

  stopMasterRecording(): void {
    if (this.mediaRecorder && this.isRecording()) {
      this.mediaRecorder.stop();
      this.isRecording.set(false);
      console.log('Attempting to stop master recording...');
    }
  }

  async shareMix(): Promise<void> {
    const blob = this.recordedBlob();
    if (!blob || !this.canShare()) {
      console.warn('No recorded mix available or Web Share API not supported.');
      return;
    }

    const file = new File([blob], 'aura-mix.webm', { type: blob.type });
    try {
      await navigator.share({
        files: [file],
        title: 'Aura Mix',
        text: 'Check out my latest mix from Aura Music Player!',
      });
      console.log('Mix shared successfully.');
    } catch (error) {
      console.error('Error sharing mix:', error);
    }
  }

  // --- Microphone Controls ---

  async toggleMicrophone(): Promise<void> {
    if (this.micEnabled()) {
      this.stopMicrophone();
    } else {
      await this.startMicrophone();
    }
  }

  async startMicrophone(): Promise<void> {
    if (this.micEnabled()) return; // Already enabled

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.micSourceNode = this.audioContext.createMediaStreamSource(this.micStream);
      this.micGainNode = this.audioContext.createGain();
      this.micFilterNode = this.audioContext.createBiquadFilter(); // Low-pass filter
      this.micFilterNode.type = 'lowpass';
      this.micFilterNode.frequency.value = this.micFilterFreq(); // Initial filter frequency

      // Setup microphone EQ (3 bands: High, Mid, Low)
      const eqFrequencies = [250, 2500, 10000]; // Low, Mid, High frequencies for boosting/cutting
      this.micEqNodes = eqFrequencies.map(freq => {
        const eq = this.audioContext.createBiquadFilter();
        eq.type = 'peaking';
        eq.frequency.value = freq;
        eq.Q.value = 1; // Quality factor
        eq.gain.value = 0; // Default flat
        return eq;
      });

      // Connect mic chain: Source -> Gain -> EQ1 -> EQ2 -> EQ3 -> Filter -> Analyser -> Master Gain
      this.micSourceNode.connect(this.micGainNode);
      this.micGainNode.connect(this.micEqNodes[0]);
      this.micEqNodes[0].connect(this.micEqNodes[1]);
      this.micEqNodes[1].connect(this.micEqNodes[2]);
      this.micEqNodes[2].connect(this.micFilterNode);
      this.micFilterNode.connect(this.analyserMic); // Connect to mic analyser
      this.analyserMic.connect(this.gainNodeMaster); // Route mic to master output

      // Apply initial mic settings
      this.onMicVolumeChange({ target: { value: this.micVolume() } } as any);
      this.onMicEqChange({ target: { value: this.micEqHigh() } } as any, 'High');
      this.onMicEqChange({ target: { value: this.micEqMid() } } as any, 'Mid');
      this.onMicEqChange({ target: { value: this.micEqLow() } } as any, 'Low');
      this.onMicFilterChange({ target: { value: this.getNormalizedFilterValue(this.micFilterFreq()) } } as any);

      this.micEnabled.set(true);
      console.log('Microphone enabled.');
    } catch (err) {
      console.error('Error enabling microphone:', err);
      this.micEnabled.set(false);
      alert('Failed to access microphone. Please ensure permissions are granted.');
    }
  }

  stopMicrophone(): void {
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    // Disconnect all mic nodes from the graph
    if (this.micSourceNode) this.micSourceNode.disconnect();
    if (this.micGainNode) this.micGainNode.disconnect();
    if (this.micFilterNode) this.micFilterNode.disconnect();
    this.micEqNodes.forEach(node => node.disconnect());
    // FIX: Ensure analyserMic exists before disconnecting it.
    if (this.analyserMic) this.analyserMic.disconnect(); // Disconnect analyser from master

    this.micSourceNode = null;
    this.micGainNode = null;
    this.micFilterNode = null;
    this.micEqNodes = [];

    this.micEnabled.set(false);
    this.vuLevelMic.set(0); // Reset mic VU level
    console.log('Microphone disabled.');
  }

  onMicVolumeChange(event: Event): void {
    const newVolume = parseInt((event.target as HTMLInputElement).value, 10);
    this.micVolume.set(newVolume);
    if (this.micGainNode) {
      this.micGainNode.gain.value = this.mapSliderToGain(newVolume);
    }
  }

  onMicEqChange(event: Event, band: 'High' | 'Mid' | 'Low'): void {
    const newValue = parseInt((event.target as HTMLInputElement).value, 10);
    const dbValue = this.mapSliderToDb(newValue);

    // FIX: Ensure micEqNodes and its elements exist before accessing for assignment
    if (band === 'High' && this.micEqNodes[2]) { // Assumed index for High EQ
      this.micEqHigh.set(newValue);
      this.micEqNodes[2].gain.value = dbValue;
    } else if (band === 'Mid' && this.micEqNodes[1]) { // Assumed index for Mid EQ
      this.micEqMid.set(newValue);
      this.micEqNodes[1].gain.value = dbValue;
    } else if (band === 'Low' && this.micEqNodes[0]) { // Assumed index for Low EQ
      this.micEqLow.set(newValue);
      this.micEqNodes[0].gain.value = dbValue;
    }
  }

  onMicFilterChange(event: Event): void {
    const sliderValue = parseFloat((event.target as HTMLInputElement).value); // 0-1
    const newFreq = this.mapFilterSliderToFreq(sliderValue);
    this.micFilterFreq.set(newFreq);
    if (this.micFilterNode) {
      this.micFilterNode.frequency.value = newFreq;
    }
  }

  // --- App Mode Management ---
  toggleMainViewMode(): void {
    const modes = ['player', 'dj', 'piano-roll', 'drum-machine', 'image-editor', 'video-editor', 'networking']; // NEW: Add 'networking'
    const currentMode = this.mainViewMode();
    const currentIndex = modes.indexOf(currentMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    this.mainViewMode.set(modes[nextIndex] as any);
    this.stopAllAudio(); // Stop audio when switching modes
    // Reset specific states when switching modes
    if (modes[nextIndex] !== 'image-editor') {
      this.imageEditorInitialPrompt.set('');
    }
    if (modes[nextIndex] !== 'video-editor') {
      this.videoEditorInitialPrompt.set('');
    }
    if (modes[nextIndex] !== 'networking') { // NEW: Clear networking query
      this.networkingLocationQuery.set(null);
      this.selectedArtistProfile.set(null);
    }
    this.lastImageEditorImageUrl.set(null); // Clear image for video generation

    // If switching to DJ mode, ensure tracks are connected for VU/crossfade
    if (modes[nextIndex] === 'dj') {
      this.audioPlayerARef()?.nativeElement.load(); // Reload to ensure Web Audio connection
      this.audioPlayerBRef()?.nativeElement.load();
      if (this.deckA().isPlaying) this.togglePlayPause('A'); // Restart if it was playing
      if (this.deckB().isPlaying) this.togglePlayPause('B'); // Restart if it was playing
    }
  }

  toggleChatbot(): void {
    this.showChatbot.update(val => !val);
    // Clear any pending AI analysis if chatbot is closed
    if (!this.showChatbot()) {
      this.imageToAnalyzeUrl.set(null);
      this.imageAnalysisResult.set(null);
      this.mapLocationQuery.set(null);
      this.mapLocationResult.set(null);
      this.showImageAnalysisModal.set(false);
      this.showMapResultsModal.set(false);
      this.networkingLocationQuery.set(null); // NEW: Clear networking query
      this.selectedArtistProfile.set(null); // NEW: Clear selected artist
      this.showArtistDetailModal.set(false); // NEW: Close networking modal
    }
  }

  // --- AI Command Handling from Chatbot ---
  handleChatbotCommand(command: { action: string; parameters: any; aiContext?: string }): void {
    console.log('AppComponent: Received chatbot command:', command);
    const { action, parameters, aiContext } = command;

    switch (action) {
      case 'SET_THEME':
        const themeName = parameters.theme as string;
        const newTheme = this.THEMES.find(t => t.name.toLowerCase() === themeName.toLowerCase());
        if (newTheme) {
          this.currentTheme.set(newTheme);
          console.log(`Theme set to: ${newTheme.name}`);
        } else {
          console.warn(`Theme "${themeName}" not found.`);
        }
        break;
      case 'PLAY_TRACK':
        // Requires more robust logic to find/load tracks
        if (parameters.title) {
          // Attempt to find in playlist or search results
          const trackToPlay = this.playlist().find(t => t.title.toLowerCase().includes(parameters.title.toLowerCase())) ||
                             this.searchResults().find(t => t.title.toLowerCase().includes(parameters.title.toLowerCase()));
          if (trackToPlay) {
            const index = this.playlist().indexOf(trackToPlay);
            if (index !== -1) {
              this.playTrackFromPlaylist(index);
            } else { // Add to playlist and play
              this.addTrackToPlaylist(trackToPlay, true);
            }
          } else {
            console.warn(`Track with title "${parameters.title}" not found.`);
          }
        }
        break;
      case 'PAUSE_TRACK':
        // Pause active deck (assuming current player track is on deck A)
        if (this.deckA().isPlaying) {
          this.togglePlayPause('A');
        }
        break;
      case 'STOP_TRACK':
        this.audioPlayerARef()?.nativeElement.pause();
        if (this.audioPlayerARef()?.nativeElement) this.audioPlayerARef()!.nativeElement.currentTime = 0; // FIX: Ensure nativeElement exists
        this.videoPlayerARef()?.nativeElement.pause();
        // FIX: Ensure videoRef exists before accessing its nativeElement for assignment
        if (this.videoPlayerARef()?.nativeElement) {
          this.videoPlayerARef()!.nativeElement.currentTime = 0;
        }
        this.deckA.update(state => ({ ...state, isPlaying: false, progress: 0 }));
        break;
      case 'NEXT_TRACK':
        this.playNext();
        break;
      case 'PREVIOUS_TRACK':
        this.playPrevious();
        break;
      case 'TOGGLE_LOOP':
        this.toggleLoop('A'); // Assuming loop applies to player track on deck A
        break;
      case 'LOAD_TRACK':
        // This command might need more complex parameters (e.g., URL or search query)
        console.warn('LOAD_TRACK command not fully implemented for chatbot direct loading.');
        break;
      case 'GENERATE_IMAGE':
        if (parameters.prompt) {
          this.imageEditorInitialPrompt.set(parameters.prompt);
          this.mainViewMode.set('image-editor');
          this.showChatbot.set(false); // Close chatbot after sending command
        }
        break;
      case 'GENERATE_VIDEO':
        if (parameters.prompt) {
          this.videoEditorInitialPrompt.set(parameters.prompt);
          // Optional: handle image context if passed from chatbot for video generation
          // if (parameters.imageUrl) this.lastImageEditorImageUrl.set(parameters.imageUrl);
          this.mainViewMode.set('video-editor');
          this.showChatbot.set(false); // Close chatbot after sending command
        }
        break;
      case 'ANALYZE_IMAGE':
        if (parameters.imageUrl) {
          this.imageToAnalyzeUrl.set(parameters.imageUrl);
          // Chatbot will pick this up via its input and initiate analysis
          this.showChatbot.set(true); // Ensure chatbot is open to display results
        }
        break;
      case 'FIND_ON_MAP':
        if (parameters.query) {
          this.mapLocationQuery.set(parameters.query);
          // Chatbot will pick this up via its input and initiate map search
          this.showChatbot.set(true); // Ensure chatbot is open to display results
        }
        break;
      case 'FIND_ARTISTS': // NEW: Handle Find Artists command
        if (parameters.location) {
          this.networkingLocationQuery.set(parameters.location);
          this.mainViewMode.set('networking'); // Switch to networking view
          this.showChatbot.set(false); // Close chatbot after sending command
        }
        break;
      case 'VIEW_ARTIST_PROFILE': // NEW: Handle View Artist Profile command
        if (parameters.name) {
          // FIX: Filter MOCK_ARTISTS based on genre or other relevant criteria
          const matchingArtists = MOCK_ARTISTS.filter(a =>
            a.name.toLowerCase() === parameters.name.toLowerCase() &&
            (!parameters.genre || a.genres.some(g => g.toLowerCase().includes(parameters.genre.toLowerCase()))) &&
            (!parameters.location || a.location.toLowerCase().includes(parameters.location.toLowerCase()))
          );
          if (matchingArtists.length > 0) {
            this.selectedArtistProfile.set(matchingArtists[0]); // Select first match
            this.mainViewMode.set('networking'); // Switch to networking view
            this.showChatbot.set(false); // Close chatbot
          } else {
            this.selectedArtistProfile.set(null);
            console.warn(`Artist "${parameters.name}" not found in mock data or no matching criteria.`);
            // Optionally send a message back to chatbot that artist was not found
          }
        }
        break;
      case 'START_DRUM':
        this.mainViewMode.set('drum-machine');
        setTimeout(() => this.drumMachineRef()?.start(), 0);
        break;
      case 'STOP_DRUM':
        this.mainViewMode.set('drum-machine');
        setTimeout(() => this.drumMachineRef()?.stop(), 0);
        break;
      case 'SET_BPM':
        if (parameters.bpm) {
          this.mainViewMode.set('drum-machine');
          setTimeout(() => this.drumMachineRef()?.setBpm(parseInt(parameters.bpm, 10)), 0);
        }
        break;
      case 'CLEAR_BEAT':
        this.mainViewMode.set('drum-machine');
        setTimeout(() => this.drumMachineRef()?.clearPattern(), 0);
        break;
      case 'GENERATE_BEAT':
        if (parameters.pattern) {
          this.mainViewMode.set('drum-machine');
          try {
            // Parse JSON if it's a string, or use directly if already an object (though it usually comes as string from AI)
            const pattern = typeof parameters.pattern === 'string' ? JSON.parse(parameters.pattern) : parameters.pattern;
            setTimeout(() => this.drumMachineRef()?.setPattern(pattern), 0);
          } catch (e) {
            console.error('Failed to parse drum pattern:', e);
          }
        }
        break;
      case 'TOGGLE_TRACK_MUTE':
        if (parameters.track) {
           this.mainViewMode.set('drum-machine');
           // This logic requires checking current state, which is hard from here without querying the component.
           // For simplicity, we might assume 'mute' meant 'toggle'. Or we can ask AI to send explicit state.
           // Let's assume toggle for now or just force a state if parameter allows.
           // Actually the component has toggleMute(index). We need name to index mapping.
           // The component's new method setTrackMute accepts a boolean. We need to know if we want to mute or unmute.
           // Let's assume 'true' if not specified, or maybe the AI can send 'mute=true'.
           // command: TOGGLE_TRACK_MUTE:::track='kick', mute='true'
           const muteState = parameters.mute === 'true' || parameters.mute === true;
           setTimeout(() => this.drumMachineRef()?.setTrackMute(parameters.track, muteState), 0);
        }
        break;
      case 'TOGGLE_TRACK_SOLO':
        if (parameters.track) {
           this.mainViewMode.set('drum-machine');
           const soloState = parameters.solo === 'true' || parameters.solo === true;
           setTimeout(() => this.drumMachineRef()?.setTrackSolo(parameters.track, soloState), 0);
        }
        break;
      default:
        console.warn(`Unknown chatbot command: ${action}`);
        break;
    }
  }

  handleImageSelectedForAlbumArt(imageUrl: string): void {
    this.imageToApplyAsAlbumArt.set(imageUrl);
    this.showApplyAlbumArtModal.set(true);
    this.lastImageEditorImageUrl.set(imageUrl); // Store for video generation
    this.showChatbot.set(false); // Close chatbot if open
  }

  applyImageAsAlbumArt(target: 'player' | 'A' | 'B'): void {
    const imageUrl = this.imageToApplyAsAlbumArt();
    if (!imageUrl) return;

    if (target === 'player' && this.currentPlayerTrack()) {
      this.playlist.update(list => list.map((track, index) =>
        index === this.currentTrackIndex() ? { ...track, albumArtUrl: imageUrl } : track
      ));
      // Also update deckA if it's currently playing the player track
      this.deckA.update(state => ({ ...state, track: { ...state.track, albumArtUrl: imageUrl } }));
    } else if (target === 'A') {
      // FIX: Update the track property within DeckState
      this.deckA.update(state => ({ ...state, track: { ...state.track, albumArtUrl: imageUrl } }));
    } else if (target === 'B') {
      // FIX: Update the track property within DeckState
      this.deckB.update(state => ({ ...state, track: { ...state.track, albumArtUrl: imageUrl } }));
    }
    this.showApplyAlbumArtModal.set(false);
    this.imageToApplyAsAlbumArt.set(null);
  }

  // --- Utility Functions ---

  private stopAllAudio(): void {
    this.audioPlayerARef()?.nativeElement.pause();
    if (this.audioPlayerARef()?.nativeElement) this.audioPlayerARef()!.nativeElement.currentTime = 0;
    this.videoPlayerARef()?.nativeElement.pause();
    // FIX: Ensure videoRef exists before accessing its nativeElement for assignment
    if (this.videoPlayerARef()?.nativeElement) {
      this.videoPlayerARef()!.nativeElement.currentTime = 0;
    }
    this.deckA.update(state => ({ ...state, isPlaying: false, progress: 0 }));

    this.audioPlayerBRef()?.nativeElement.pause();
    if (this.audioPlayerBRef()?.nativeElement) this.audioPlayerBRef()!.nativeElement.currentTime = 0;
    this.videoPlayerBRef()?.nativeElement.pause();
    // FIX: Ensure videoRef exists before accessing its nativeElement for assignment
    if (this.videoPlayerBRef()?.nativeElement) {
      this.videoPlayerBRef()!.nativeElement.currentTime = 0;
    }
    this.deckB.update(state => ({ ...state, isPlaying: false, progress: 0 }));

    this.stopMicrophone(); // Ensure microphone is stopped
  }

  private stopMediaStream(): void {
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
  }


  formatTime(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }

  randomizeTheme(): void {
    let newTheme = this.currentTheme();
    while (newTheme === this.currentTheme()) {
      newTheme = this.THEMES[Math.floor(Math.random() * this.THEMES.length)];
    }
    this.currentTheme.set(newTheme);
  }
}