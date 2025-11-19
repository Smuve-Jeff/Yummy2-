import { Component, ChangeDetectionStrategy, signal, ElementRef, viewChild, output, input, effect, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
// FIX: Imported types from AiService for full static import compatibility
import type { GoogleGenAI, GenerateImagesParameters, GenerateImagesResponse, Type } from '../../services/ai.service';
import { AppTheme } from '../../app.component';
import { AiService } from '../../services/ai.service'; // NEW: Import AiService

@Component({
  selector: 'app-image-editor',
  templateUrl: './image-editor.component.html',
  styleUrls: ['./image-editor.component.css'],
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageEditorComponent {
  // NEW: Input for initial prompt
  initialPrompt = input<string | null>(null);
  theme = input.required<AppTheme>(); // NEW: Input for current theme

  originalImageUrl = signal<string | null>(null);
  editPrompt = signal('');
  generatedImageUrls = signal<string[]>([]);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  aspectRatio = signal<'1:1' | '3:4' | '4:3' | '9:16' | '16:9'>('1:1'); // NEW: Aspect ratio signal

  private aiService = inject(AiService); // NEW: Inject AiService
  isAiAvailable = computed(() => this.aiService.isAiAvailable);

  fileInputRef = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  imageSelected = output<string>(); // NEW: Output for selected image URL
  imageAnalysisRequest = output<string>(); // NEW: Output to request image analysis from chatbot

  // REFACTOR: No longer directly importing GoogleGenAI, using AiService's instance
  // FIX: Access genAI as a getter
  private genAI: GoogleGenAI | undefined = undefined; // Initialize as undefined


  constructor() {
    // If AI is not available, set an error message
    if (!this.aiService.isAiAvailable) {
      this.errorMessage.set('AI features are unavailable. An API key is required and was not found or was invalid in window.AURA_GEMINI_API_KEY.');
    } else {
      // FIX: Assign genAI instance from aiService if available
      this.genAI = this.aiService.genAI;
    }

    // Effect to update editPrompt when initialPrompt changes (e.g., from chatbot)
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
      this.generatedImageUrls.set([]); // Clear previous generations
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
    // FIX: Access genAI as a getter
    if (!this.isAiAvailable() || !this.genAI) {
      this.errorMessage.set('AI features are unavailable. Please check your configuration (window.AURA_GEMINI_API_KEY).');
      return;
    }
    // const imageUrl = this.originalImageUrl(); // Not used for imagen-4.0-generate-001 as it's text-to-image
    const prompt = this.editPrompt().trim();

    if (!prompt) { // Removed imageUrl check, as it's not direct input anymore
      this.errorMessage.set('Please enter an edit prompt.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.generatedImageUrls.set([]);

    try {
      // FIX: Access genAI as a getter
      const response: GenerateImagesResponse = await this.genAI.models.generateImages({
        model: 'imagen-4.0-generate-001', // Use imagen-4.0-generate-001 for image generation/editing
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/png', // Request PNG output
          aspectRatio: this.aspectRatio(), // Use selected aspect ratio
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
    if (this.fileInputRef()) {
      this.fileInputRef()!.nativeElement.value = ''; // Reset file input
    }
  }

  // NEW: Emit the currently displayed image URL
  useAsAlbumArt(): void {
    const urlToEmit = this.generatedImageUrls().length > 0
      ? this.generatedImageUrls()[0]
      : this.originalImageUrl();

    if (urlToEmit) {
      this.imageSelected.emit(urlToEmit);
      // Removed the alert here, parent will handle feedback via modal
    } else {
      this.errorMessage.set('No image to use as album art.');
    }
  }

  // NEW: Request image analysis for the current image
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
}