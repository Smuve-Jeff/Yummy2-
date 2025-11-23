import { Component, ChangeDetectionStrategy, signal, input, output, effect, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppTheme } from '../video-editor/app.component';
import { AiService } from '../../services/ai.service';

@Component({
  selector: 'app-lyricist',
  templateUrl: './lyricist.component.html',
  styleUrls: ['./lyricist.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LyricistComponent {
  theme = input.required<AppTheme>();

  lyrics = signal('');
  aiSuggestions = signal<string[]>([]);
  isGenerating = signal(false);

  // Outputs for main app to handle if needed, though mostly self-contained or via service
  suggestionSelected = output<string>();

  private aiService = inject(AiService);
  isAiAvailable = computed(() => this.aiService.isAiAvailable);

  constructor() {}

  async generateRhyme(word: string) {
    if (!word || !this.isAiAvailable()) return;
    this.isGenerating.set(true);

    try {
        const prompt = `Suggest 5 rhymes for the word "${word}" suitable for a rap/song. Return only the words separated by commas.`;
        const response = await this.aiService.chatInstance?.sendMessage({ message: prompt });
        const text = response?.text || '';
        const suggestions = text.split(',').map(s => s.trim());
        this.aiSuggestions.set(suggestions);
    } catch (e) {
        console.error(e);
    } finally {
        this.isGenerating.set(false);
    }
  }

  async generateChorus(topic: string) {
     if (!topic || !this.isAiAvailable()) return;
     this.isGenerating.set(true);

     try {
        const prompt = `Write a catchy 4-line chorus about "${topic}". Style: Hip Hop/R&B.`;
        const response = await this.aiService.chatInstance?.sendMessage({ message: prompt });
        const text = response?.text || '';
        this.lyrics.update(current => current + '\n\n[Chorus]\n' + text + '\n');
     } catch (e) {
         console.error(e);
     } finally {
         this.isGenerating.set(false);
     }
  }

  applySuggestion(suggestion: string) {
      this.lyrics.update(l => l + ' ' + suggestion);
      this.suggestionSelected.emit(suggestion);
  }
}
