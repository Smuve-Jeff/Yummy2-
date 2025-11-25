import { Component, ChangeDetectionStrategy, ElementRef, viewChild, AfterViewInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-matrix-background',
  template: `
    <canvas #matrixCanvas class="absolute top-0 left-0 w-full h-full"></canvas>
  `,
  styles: [`
    :host {
      display: block;
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 0;
    }
  `],
  standalone: true,
})
export class MatrixBackgroundComponent implements AfterViewInit, OnDestroy {
  canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('matrixCanvas');

  private ctx!: CanvasRenderingContext2D;
  // FIX: Changed intervalId to animationFrameId for requestAnimationFrame
  private animationFrameId?: number;
  private readonly FRAME_RATE_INTERVAL = 500; // Milliseconds per frame, originally 250ms

  ngAfterViewInit(): void {
    const canvas = this.canvasRef().nativeElement;
    const context = canvas.getContext('2d');

    if (!context) {
        console.error("Could not get 2D context");
        return;
    }
    this.ctx = context;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const phraseText = 'Smuve Jeff Presents';

    const fontSize = 16;

    interface FallingPhrase {
      text: string;
      x: number;
      y: number;
    }
    let phrases: FallingPhrase[] = [];

    // FIX: Use requestAnimationFrame for smoother animation
    let lastDrawTime = 0;
    const drawLoop = (currentTime: number) => {
      if (currentTime - lastDrawTime > this.FRAME_RATE_INTERVAL) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        this.ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (Math.random() > 0.98) {
            const x = Math.floor(Math.random() * canvas.width);
            phrases.push({ text: phraseText, x, y: fontSize });
        }

        this.ctx.fillStyle = '#0F0'; // Green text
        this.ctx.font = (fontSize + 4) + 'px monospace';
        phrases.forEach(phrase => {
            this.ctx.fillText(phrase.text, phrase.x, phrase.y);
            phrase.y += fontSize;
        });

        phrases = phrases.filter(phrase => phrase.y < canvas.height);

        lastDrawTime = currentTime;
      }
      this.animationFrameId = requestAnimationFrame(drawLoop);
    };

    this.animationFrameId = requestAnimationFrame(drawLoop);
  }

  ngOnDestroy(): void {
      // FIX: Clear requestAnimationFrame instead of clearInterval
      if (this.animationFrameId) {
          cancelAnimationFrame(this.animationFrameId);
      }
  }
}