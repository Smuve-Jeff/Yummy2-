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
  bpm: number; // NEW: To store the detected BPM
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
  bpm: 0,
  wasPlayingBeforeScratch: false,
};

export type ScratchState = {
  active: boolean;
  lastAngle: number;
  platterElement: HTMLElement | null;
  initialTouchX?: number; // NEW
  initialTouchY?: number; // NEW
};
