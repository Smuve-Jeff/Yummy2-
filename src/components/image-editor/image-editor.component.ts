import { Component, ChangeDetectionStrategy, signal, ElementRef, viewChild, output, input, effect, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { GoogleGenAI, GenerateImagesResponse } from '../../services/ai.service';
import { AppTheme } from '../video-editor/app.component';
import { AiService } from '../../services/ai.service';

@Component({
  selector: 'app-image-editor',
  templateUrl: './image-editor.component.html',
  styleUrls: ['./image-editor.component.css'],
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageEditorComponent {
  initialPrompt = input<string | null>(null);
  theme = input.required<AppTheme>();

  originalImageUrl = signal<string | null>(null);
  editPrompt = signal('');
  generatedImageUrls = signal<string[]>([]);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  aspectRatio = signal<'1:1' | '3:4' | '4:3' | '9:16' | '16:9'>('1:1');

  // Text Overlay State
  albumTitle = signal('');
  artistName = signal('');
  showTextOverlayControls = signal(false);

  private aiService = inject(AiService);
  isAiAvailable = computed(() => this.aiService.isAiAvailable);

  fileInputRef = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('editorCanvas');

  imageSelected = output<string>();
  imageAnalysisRequest = output<string>();

  private genAI: GoogleGenAI | undefined = undefined;

  constructor() {
    if (!this.aiService.isAiAvailable) {
      this.errorMessage.set('AI features are unavailable. An API key is required.');
    } else {
      this.genAI = this.aiService.genAI;
    }

    effect(() => {
      const prompt = this.initialPrompt();
      if (prompt && prompt !== this.editPrompt()) {
        this.editPrompt.set(prompt);
      }
    });
  }

  handleImageUpload(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.errorMessage.set(null);
      this.generatedImageUrls.set([]);
      const reader = new FileReader();
      reader.onload = (e) => {
        this.originalImageUrl.set(e.target?.result as string);
      };
      reader.onerror = () => {
        this.errorMessage.set('Failed to read file.');
      };
      reader.readAsDataURL(file);
    } else {
      this.originalImageUrl.set(null);
      this.generatedImageUrls.set([]);
    }
  }

  async generateImage(): Promise<void> {
    if (!this.isAiAvailable() || !this.genAI) {
      this.errorMessage.set('AI features are unavailable.');
      return;
    }
    const prompt = this.editPrompt().trim();

    if (!prompt) {
      this.errorMessage.set('Please enter an edit prompt.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.generatedImageUrls.set([]);

    try {
      const response: GenerateImagesResponse = await this.genAI.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/png',
          aspectRatio: this.aspectRatio(),
        },
      });

      const base64ImageBytes: string | undefined = response.generatedImages[0]?.image?.imageBytes;
      if (base64ImageBytes) {
        this.generatedImageUrls.set([`data:image/png;base64,${base64ImageBytes}`]);
      } else {
        this.errorMessage.set('No image generated. Please try a different prompt.');
      }
    } catch (error: any) {
      console.error('Error generating image:', error);
      this.errorMessage.set(`Image generation failed: ${error.message || 'Unknown error'}.`);
    } finally {
      this.isLoading.set(false);
    }
  }

  clearImage(): void {
    this.originalImageUrl.set(null);
    this.generatedImageUrls.set([]);
    this.editPrompt.set('');
    this.errorMessage.set(null);
    this.albumTitle.set('');
    this.artistName.set('');
    if (this.fileInputRef()) {
      this.fileInputRef()!.nativeElement.value = '';
    }
  }

  useAsAlbumArt(): void {
    const urlToEmit = this.generatedImageUrls().length > 0
      ? this.generatedImageUrls()[0]
      : this.originalImageUrl();

    if (urlToEmit) {
      this.imageSelected.emit(urlToEmit);
    } else {
      this.errorMessage.set('No image to use as album art.');
    }
  }

  requestImageAnalysis(): void {
    const imageUrlToAnalyze = this.generatedImageUrls().length > 0
      ? this.generatedImageUrls()[0]
      : this.originalImageUrl();

    if (imageUrlToAnalyze) {
      this.imageAnalysisRequest.emit(imageUrlToAnalyze);
      alert('Image analysis requested. Check chatbot for results!');
    } else {
      this.errorMessage.set('No image available to analyze.');
    }
  }

  // --- Text Overlay Logic ---

  toggleTextOverlay(): void {
    this.showTextOverlayControls.update(v => !v);
  }

  applyTextOverlay(): void {
    const imageUrl = this.generatedImageUrls().length > 0 ? this.generatedImageUrls()[0] : this.originalImageUrl();

    if (!imageUrl) {
      this.errorMessage.set("No image to apply text to.");
      return;
    }

    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw Image
      ctx.drawImage(img, 0, 0);

      // Draw Overlay
      // Simple bottom gradient for better text visibility
      const gradient = ctx.createLinearGradient(0, canvas.height - 200, 0, canvas.height);
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(1, "rgba(0,0,0,0.8)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, canvas.height - 200, canvas.width, 200);

      // Draw Text
      ctx.textAlign = 'center';
      ctx.fillStyle = 'white';

      // Artist Name (Smaller, above title)
      if (this.artistName()) {
        ctx.font = `bold ${canvas.width * 0.05}px monospace`;
        ctx.fillText(this.artistName().toUpperCase(), canvas.width / 2, canvas.height - 100);
      }

      // Album Title (Larger)
      if (this.albumTitle()) {
        ctx.font = `bold ${canvas.width * 0.08}px monospace`;
        ctx.fillText(this.albumTitle().toUpperCase(), canvas.width / 2, canvas.height - 40);
      }

      // Update Generated Image URL with the canvas data
      const newUrl = canvas.toDataURL('image/png');
      this.generatedImageUrls.set([newUrl]);
    };
    img.src = imageUrl;
  }
}
