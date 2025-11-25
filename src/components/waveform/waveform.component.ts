import { Component, ChangeDetectionStrategy, Input, OnChanges, SimpleChanges, ElementRef, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-waveform',
  templateUrl: './waveform.component.html',
  styleUrls: ['./waveform.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule],
})
export class WaveformComponent implements OnChanges {
  @Input() audioBuffer?: AudioBuffer;
  @Input() progress = 0;
  @Input() themeColor = '#00bcd4';

  canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('waveformCanvas');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['audioBuffer'] && this.audioBuffer) {
      this.drawWaveform();
    }
    if (changes['progress'] || changes['audioBuffer']) {
      this.drawProgress();
    }
  }

  private drawWaveform(): void {
    if (!this.audioBuffer || !this.canvasRef()) {
      return;
    }

    const canvas = this.canvasRef()!.nativeElement;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    const data = this.audioBuffer.getChannelData(0); // Use the left channel
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    context.clearRect(0, 0, width, height);
    context.fillStyle = this.themeColor;
    context.globalAlpha = 0.5;

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;

      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum < min) {
          min = datum;
        }
        if (datum > max) {
          max = datum;
        }
      }

      context.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }
  }

  private drawProgress(): void {
    if (!this.audioBuffer || !this.canvasRef()) {
      return;
    }

    const canvas = this.canvasRef()!.nativeElement;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    const position = (this.progress / this.audioBuffer.duration) * width;

    this.drawWaveform(); // Redraw the waveform

    context.globalAlpha = 1;
    context.fillStyle = '#ff4081'; // Progress color
    context.fillRect(position, 0, 2, height);
  }
}
