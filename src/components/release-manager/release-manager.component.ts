import { Component, ChangeDetectionStrategy, signal, input, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppTheme } from '../video-editor/app.component';
import { AiService } from '../../services/ai.service';

export interface ReleaseTask {
  id: string;
  title: string;
  completed: boolean;
  category: 'Production' | 'Legal' | 'Visuals' | 'Marketing' | 'Distribution';
}

@Component({
  selector: 'app-release-manager',
  templateUrl: './release-manager.component.html',
  styleUrls: ['./release-manager.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReleaseManagerComponent {
  theme = input.required<AppTheme>();

  tasks = signal<ReleaseTask[]>([
    { id: '1', title: 'Final Mixdown', completed: false, category: 'Production' },
    { id: '2', title: 'Mastering', completed: false, category: 'Production' },
    { id: '3', title: 'Register ISRC Codes', completed: false, category: 'Legal' },
    { id: '4', title: 'Create Album Art', completed: false, category: 'Visuals' },
  ]);

  newTaskTitle = signal('');
  isGenerating = signal(false);

  private aiService = inject(AiService);
  isAiAvailable = computed(() => this.aiService.isAiAvailable);

  addTask() {
    if (!this.newTaskTitle().trim()) return;
    this.tasks.update(t => [
        ...t,
        {
            id: Date.now().toString(),
            title: this.newTaskTitle(),
            completed: false,
            category: 'Production' // Default
        }
    ]);
    this.newTaskTitle.set('');
  }

  toggleTask(id: string) {
    this.tasks.update(t => t.map(task =>
        task.id === id ? { ...task, completed: !task.completed } : task
    ));
  }

  deleteTask(id: string) {
      this.tasks.update(t => t.filter(task => task.id !== id));
  }

  async generatePlan() {
      if (!this.isAiAvailable()) return;
      this.isGenerating.set(true);

      try {
          // In a real app, we'd pass context about the specific song/artist
          const prompt = `Create a checklist of 5 essential steps for releasing an independent music single in 2024. Return only the task titles separated by commas.`;
          const response = await this.aiService.chatInstance?.sendMessage({ message: prompt });
          const text = response?.text || '';

          const newTasks = text.split(',').map((title, idx) => ({
              id: Date.now().toString() + idx,
              title: title.trim(),
              completed: false,
              category: 'Marketing' as const
          }));

          this.tasks.update(current => [...current, ...newTasks]);
      } catch(e) {
          console.error(e);
      } finally {
          this.isGenerating.set(false);
      }
  }
}
