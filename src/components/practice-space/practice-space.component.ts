import { Component, ChangeDetectionStrategy, signal, viewChild, ElementRef, inject, input, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppTheme } from '../video-editor/app.component';
import { AiService, Content } from '../../services/ai.service';

@Component({
  selector: 'app-practice-space',
  templateUrl: './practice-space.component.html',
  styleUrls: ['./practice-space.component.css'],
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PracticeSpaceComponent implements OnDestroy {
  theme = input.required<AppTheme>();

  isRecording = signal(false);
  recordingTime = signal(0);
  recordedUrl = signal<string | null>(null);
  recordedBlob = signal<Blob | null>(null);

  notes = signal('');
  aiFeedback = signal<string | null>(null);
  isGettingFeedback = signal(false);

  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private intervalId: number | undefined;
  private stream: MediaStream | null = null;

  private aiService = inject(AiService);

  constructor() {}

  ngOnDestroy(): void {
    this.stopRecording();
  }

  async toggleRecording(): Promise<void> {
    if (this.isRecording()) {
      this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  private async startRecording(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.chunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        this.recordedBlob.set(blob);
        this.recordedUrl.set(URL.createObjectURL(blob));
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
      };

      this.mediaRecorder.start();
      this.isRecording.set(true);
      this.recordingTime.set(0);
      this.intervalId = window.setInterval(() => {
        this.recordingTime.update(t => t + 1);
      }, 1000);

    } catch (err) {
      console.error('Error starting recording:', err);
      alert('Could not access microphone.');
    }
  }

  private stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.isRecording.set(false);
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  updateNotes(event: Event): void {
    const val = (event.target as HTMLTextAreaElement).value;
    this.notes.set(val);
  }

  async getAiFeedback(): Promise<void> {
    if (!this.aiService.isAiAvailable || !this.aiService.chatInstance) {
      alert('AI service is not available.');
      return;
    }

    this.isGettingFeedback.set(true);
    this.aiFeedback.set(null);

    try {
      const parts: (string | Content)[] = [];

      let messageText = "I am practicing my music. ";
      if (this.notes()) {
        messageText += `Here are my notes/lyrics: "${this.notes()}". `;
      }
      messageText += "Please critique my practice session or provide tips based on what I've shared.";

      // If we have audio, try to convert to base64 and send it
      if (this.recordedBlob()) {
        const base64Audio = await this.blobToBase64(this.recordedBlob()!);
        parts.push({
            inlineData: {
                mimeType: 'audio/webm',
                data: base64Audio
            }
        } as Content);
        messageText += " I have attached a recording of my practice.";
      }

      parts.push(messageText);

      const response = await this.aiService.chatInstance.sendMessage({
        message: parts
      });

      this.aiFeedback.set(response.text);

    } catch (err) {
      console.error('Error getting feedback:', err);
      this.aiFeedback.set('Error getting feedback. Please try again.');
    } finally {
      this.isGettingFeedback.set(false);
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            // Remove data URL prefix (e.g., "data:audio/webm;base64,")
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
  }

  formatTime(seconds: number): string {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }
}
