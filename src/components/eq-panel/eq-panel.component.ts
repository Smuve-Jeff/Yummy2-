import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppTheme } from '../../models/theme';
import { EqBand, Enhancements } from '../video-editor/app.component';

@Component({
  selector: 'app-eq-panel',
  templateUrl: './eq-panel.component.html',
  styleUrls: ['./eq-panel.component.css'],
  standalone: true,
  imports: [CommonModule],
})
export class EqPanelComponent {
  eqSettings = input.required<EqBand[]>();
  enhancements = input.required<Enhancements>();
  theme = input.required<AppTheme>(); // NEW: Input for current theme

  close = output<void>();
  eqChange = output<EqBand[]>();
  enhancementsChange = output<Enhancements>();

  onEqBandChange(index: number, event: Event): void {
    const newValue = parseInt((event.target as HTMLInputElement).value, 10);
    const newSettings = this.eqSettings().map((band, i) =>
      i === index ? { ...band, value: newValue } : band
    );
    this.eqChange.emit(newSettings);
  }

  onEnhancementToggle(key: keyof Enhancements, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    const newEnhancements = { ...this.enhancements(), [key]: isChecked };
    this.enhancementsChange.emit(newEnhancements);
  }

  onClose(): void {
    this.close.emit();
  }
}