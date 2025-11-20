import { Component, ChangeDetectionStrategy, signal, inject, input, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiService, GenerateContentResponse } from '../../services/ai.service';
import { AppTheme } from '../video-editor/app.component';

@Component({
  selector: 'app-notepad',
  templateUrl: './notepad.component.html',
  styleUrls: ['./notepad.component.css'],
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotepadComponent {
  theme = input.required<AppTheme>();

  lyricsText = signal('');
  isRecording = signal(false);
  isPlaying = signal(false);
  recordedAudioUrl = signal<string | null>(null);
  generationStatus = signal<string | null>(null);

  private aiService = inject(AiService);
  isAiAvailable = computed(() => this.aiService.isAiAvailable);

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioPlayer: HTMLAudioElement | null = null;

  constructor() {
    // Load saved note from local storage
    const savedNote = localStorage.getItem('aura_notepad_lyrics');
    if (savedNote) {
      this.lyricsText.set(savedNote);
    }

    effect(() => {
      localStorage.setItem('aura_notepad_lyrics', this.lyricsText());
    });
  }

  onTextInput(event: Event): void {
    const text = (event.target as HTMLTextAreaElement).value;
    this.lyricsText.set(text);
  }

  async generateLyrics(): Promise<void> {
    if (!this.isAiAvailable()) {
      this.generationStatus.set('AI unavailable.');
      return;
    }

    const currentText = this.lyricsText();
    this.generationStatus.set('Generating lyrics...');

    try {
      const prompt = `You are a professional songwriter. Continue or improve the following lyrics/notes. Keep the style consistent. If it's empty, start a fresh verse in a Hip-Hop/R&B style.\n\nCurrent Text:\n${currentText}`;

      const response: GenerateContentResponse = await this.aiService.genAI!.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt
      });

      const newLyrics = response.text;
      this.lyricsText.set(currentText + (currentText ? '\n\n' : '') + newLyrics);
      this.generationStatus.set(null);
    } catch (error) {
      console.error('Error generating lyrics:', error);
      this.generationStatus.set('Generation failed.');
    }
  }

  async startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        this.recordedAudioUrl.set(audioUrl);
        this.audioPlayer = new Audio(audioUrl);
        this.audioPlayer.onended = () => this.isPlaying.set(false);
      };

      this.mediaRecorder.start();
      this.isRecording.set(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.isRecording()) {
      this.mediaRecorder.stop();
      this.isRecording.set(false);
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  }

  togglePlayback(): void {
    if (!this.audioPlayer) return;

    if (this.isPlaying()) {
      this.audioPlayer.pause();
      this.isPlaying.set(false);
    } else {
      this.audioPlayer.play();
      this.isPlaying.set(true);
    }
  }

  saveNote(): void {
      // Manual save trigger if needed, though effect handles auto-save
      localStorage.setItem('aura_notepad_lyrics', this.lyricsText());
      alert('Note saved to local storage!');
  }
}
