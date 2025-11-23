import { Component, ChangeDetectionStrategy, signal, ElementRef, viewChild, OnDestroy, input, effect, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
// FIX: Imported types from AiService for full static import compatibility
import type { GoogleGenAI, GenerateVideosParameters, GenerateVideosOperation, GenerateVideosResponse } from '../../services/ai.service';
import { AppTheme } from '../video-editor/app.component';
import { AiService } from '../../services/ai.service'; // NEW: Import AiService

export interface VideoClip {
    id: string;
    url: string;
    name: string;
    type: 'generated' | 'recorded';
}

@Component({
  selector: 'app-video-editor',
  templateUrl: './video-editor.component.html',
  styleUrls: ['./video-editor.component.css'],
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoEditorComponent implements OnDestroy {
  imageForVideoGeneration = input<string | null>(null);
  initialPrompt = input<string | null>(null);
  theme = input.required<AppTheme>(); // NEW: Input for current theme

  // State for recording
  mediaStream = signal<MediaStream | null>(null);
  isRecording = signal(false);
  recordedVideoBlob = signal<Blob | null>(null);
  recordedVideoUrl = signal<string | null>(null);
  recordingTime = signal(0);
  cameraEnabled = signal(false); // Indicates if camera stream is active in the preview
  isCameraActive = signal(false); // Indicates if camera is actually enabled/streaming

  // State for AI video generation
  videoPrompt = signal('');
  generatedVideoUrl = signal<string | null>(null);
  isGeneratingVideo = signal(false);
  generationProgressMessage = signal<string | null>(null);
  aspectRatio = signal<'1:1' | '3:4' | '4:3' | '9:16' | '16:9'>('16:9'); // NEW: Aspect ratio signal

  // Clip Management
  clips = signal<VideoClip[]>([]);
  sequencerClips = signal<VideoClip[]>([]);
  isPlayingSequence = signal(false);
  currentSequenceIndex = signal(-1);

  private aiService = inject(AiService); // NEW: Inject AiService
  isAiAvailable = computed(() => this.aiService.isAiAvailable);

  // General UI state
  error = signal<string | null>(null);

  // View children
  liveVideoPreviewRef = viewChild<ElementRef<HTMLVideoElement>>('liveVideoPreview');
  recordedVideoPlayerRef = viewChild<ElementRef<HTMLVideoElement>>('recordedVideoPlayer');
  sequencePlayerRef = viewChild<ElementRef<HTMLVideoElement>>('sequencePlayer');

  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingIntervalId?: number;
  // REFACTOR: No longer directly importing GoogleGenAI, using AiService's instance
  // FIX: Access genAI as a getter
  private genAI: GoogleGenAI | undefined = undefined; // Initialize as undefined


  constructor() {
    // If AI is not available, set an error message
    if (!this.aiService.isAiAvailable) {
      this.error.set('AI features are unavailable. An API key is required and was not found or was invalid in window.AURA_GEMINI_API_KEY.');
    } else {
      // FIX: Assign genAI instance from aiService if available
      this.genAI = this.aiService.genAI;
    }

    // Effect to update videoPrompt when initialPrompt changes (e.g., from chatbot)
    effect(() => {
      const prompt = this.initialPrompt();
      if (prompt && prompt !== this.videoPrompt()) {
        this.videoPrompt.set(prompt);
      }
    });
  }

  ngOnDestroy(): void {
    // FIX: Changed stopAllMedia to stopMediaStream
    this.stopMediaStream();
  }

  // --- Media Stream and Recording ---

  async requestMediaPermissions(): Promise<void> {
    this.error.set(null);
    if (this.mediaStream()) {
      this.stopMediaStream();
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      this.mediaStream.set(stream);
      this.cameraEnabled.set(true);
      this.isCameraActive.set(true);
      if (this.liveVideoPreviewRef()) {
        this.liveVideoPreviewRef()!.nativeElement.srcObject = stream;
        await this.liveVideoPreviewRef()!.nativeElement.play();
      }
      console.log('Camera and microphone access granted.');
    } catch (err: any) {
      console.error('Error accessing media devices:', err);
      this.error.set(`Failed to access camera/microphone: ${err.name || err.message}. Please check permissions.`);
      this.cameraEnabled.set(false);
      this.isCameraActive.set(false);
    }
  }

  stopMediaStream(): void {
    this.mediaStream()?.getTracks().forEach(track => track.stop());
    this.mediaStream.set(null);
    this.isCameraActive.set(false);
    if (this.liveVideoPreviewRef()) {
      this.liveVideoPreviewRef()!.nativeElement.srcObject = null;
    }
    console.log('Media stream stopped.');
  }

  toggleCamera(): void {
    if (this.isCameraActive()) {
      this.stopMediaStream();
      this.cameraEnabled.set(false);
    } else {
      this.requestMediaPermissions();
    }
  }

  startRecording(): void {
    if (!this.mediaStream() || !this.isCameraActive()) {
      this.error.set('Camera is not active. Please enable camera first.');
      return;
    }
    if (this.isRecording()) return;

    this.recordedChunks = [];
    this.recordedVideoBlob.set(null);
    this.recordedVideoUrl.set(null);
    this.recordingTime.set(0);
    this.error.set(null);

    try {
      this.mediaRecorder = new MediaRecorder(this.mediaStream()!, { mimeType: 'video/webm; codecs=vp8,opus' }); // Using webm for broad compatibility

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        this.recordedVideoBlob.set(blob);
        const url = URL.createObjectURL(blob);
        this.recordedVideoUrl.set(url);

        // Add to clips
        this.addClip(url, `Recording ${this.clips().length + 1}`, 'recorded');

        console.log('Recording stopped. Blob created.');
        if (this.recordingIntervalId) clearInterval(this.recordingIntervalId);
        this.recordingIntervalId = undefined;
      };

      this.mediaRecorder.onerror = (event: any) => {
        console.error('MediaRecorder error:', event.error);
        this.error.set(`Recording error: ${event.error.name || event.error.message}`);
        this.isRecording.set(false);
        if (this.recordingIntervalId) clearInterval(this.recordingIntervalId);
        this.recordingIntervalId = undefined;
      };

      this.mediaRecorder.start();
      this.isRecording.set(true);
      this.recordingIntervalId = window.setInterval(() => this.recordingTime.update(t => t + 1), 1000);
      console.log('Recording started.');
    } catch (e: any) {
      console.error('Error starting MediaRecorder:', e);
      this.error.set(`Failed to start recording: ${e.message}`);
      this.isRecording.set(false);
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.isRecording()) {
      this.mediaRecorder.stop();
      this.isRecording.set(false);
      console.log('Attempting to stop recording...');
    }
  }

  playRecordedVideo(): void {
    if (this.recordedVideoUrl() && this.recordedVideoPlayerRef()) {
      this.recordedVideoPlayerRef()!.nativeElement.load();
      this.recordedVideoPlayerRef()!.nativeElement.play().catch(e => console.error('Error playing recorded video:', e));
    }
  }

  // --- AI Video Generation ---

  async generateVideo(fromImage: boolean): Promise<void> {
    // FIX: Access genAI as a getter
    if (!this.isAiAvailable() || !this.genAI) {
      this.error.set('AI features are unavailable. Please check your configuration (window.AURA_GEMINI_API_KEY).');
      return;
    }
    const prompt = this.videoPrompt().trim();
    if (!prompt) {
      this.error.set('Please enter a prompt for video generation.');
      return;
    }
    // FIX: Access imageForVideoGeneration as an input signal with ()
    if (fromImage && !this.imageForVideoGeneration()) {
      this.error.set('Please select an image first or clear "Generate from image" option.');
      return;
    }

    this.isGeneratingVideo.set(true);
    this.error.set(null);
    this.generatedVideoUrl.set(null);
    this.generationProgressMessage.set('Starting video generation...');

    try {
      let operation: GenerateVideosOperation;
      const config: GenerateVideosParameters['config'] = {
        numberOfVideos: 1,
        aspectRatio: this.aspectRatio(),
      };

      if (fromImage && this.imageForVideoGeneration()) {
        const mimeType = this.imageForVideoGeneration()!.split(';')[0].split(':')[1];
        const data = this.imageForVideoGeneration()!.split(',')[1];

        operation = await this.genAI.models.generateVideos({
          model: 'veo-3.1-fast-generate-preview', // Veo 3 model
          prompt: prompt,
          image: {
            imageBytes: data,
            mimeType: mimeType,
          },
          config: config,
        });
      } else {
        operation = await this.genAI.models.generateVideos({
          model: 'veo-3.1-fast-generate-preview', // Veo 3 model
          prompt: prompt,
          config: config,
        });
      }

      this.generationProgressMessage.set('Video generation in progress. This may take a few minutes...');

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        this.generationProgressMessage.set(`Still generating... Current status: ${operation.metadata?.state || 'processing'}`);
        operation = await this.genAI.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        // The API key must be appended when fetching from the download link.
        const fullUrl = `${downloadLink}&key=${this.aiService.getApiKey()}`;
        this.generatedVideoUrl.set(fullUrl);
        this.addClip(fullUrl, `AI Video ${this.clips().length + 1}`, 'generated');
        this.generationProgressMessage.set('Video generation complete!');
      } else {
        this.error.set('Video generation failed: No download link in response.');
        this.generationProgressMessage.set(null);
      }
    } catch (error: any) {
      console.error('Error generating video:', error);
      this.error.set(`Video generation failed: ${error.message || 'Unknown error'}.`);
      this.generationProgressMessage.set(null);
    } finally {
      this.isGeneratingVideo.set(false);
    }
  }

  // --- Clip Management & Sequencer ---

  addClip(url: string, name: string, type: 'generated' | 'recorded') {
      const clip: VideoClip = { id: Date.now().toString() + Math.random(), url, name, type };
      this.clips.update(c => [...c, clip]);
  }

  addToSequence(clip: VideoClip) {
      this.sequencerClips.update(s => [...s, clip]);
  }

  removeFromSequence(index: number) {
      this.sequencerClips.update(s => s.filter((_, i) => i !== index));
  }

  playSequence() {
      if (this.sequencerClips().length === 0) return;
      this.isPlayingSequence.set(true);
      this.currentSequenceIndex.set(0);
      this.playCurrentSequenceClip();
  }

  private playCurrentSequenceClip() {
      const idx = this.currentSequenceIndex();
      const clips = this.sequencerClips();

      if (idx >= clips.length) {
          this.isPlayingSequence.set(false);
          this.currentSequenceIndex.set(-1);
          return;
      }

      const clip = clips[idx];
      const player = this.sequencePlayerRef()?.nativeElement;
      if (player) {
          player.src = clip.url;
          player.load();
          player.play().catch(e => console.error(e));

          player.onended = () => {
              this.currentSequenceIndex.update(i => i + 1);
              this.playCurrentSequenceClip();
          };
      }
  }

  stopSequence() {
      this.isPlayingSequence.set(false);
      const player = this.sequencePlayerRef()?.nativeElement;
      if (player) {
          player.pause();
          player.currentTime = 0;
      }
  }

  // AI Command Handler for sequencer
  createSequenceFromAll() {
      this.sequencerClips.set([...this.clips()]);
      alert('Added all clips to sequence!');
  }


  formatTime(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }

  clearAll(): void {
    this.stopMediaStream();
    this.isRecording.set(false);
    this.recordedVideoBlob.set(null);
    this.recordedVideoUrl.set(null);
    this.recordingTime.set(0);

    this.videoPrompt.set('');
    this.generatedVideoUrl.set(null);
    this.isGeneratingVideo.set(false);
    this.generationProgressMessage.set(null);
    this.aspectRatio.set('16:9');
    this.error.set(null);

    // Clear Clips? Maybe optional. For now keep clips.
  }
}
