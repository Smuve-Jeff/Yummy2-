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
  private readonly FRAME_RATE_INTERVAL = 250; // Milliseconds per frame, originally 250ms

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

    const alphabet = 'SmuveJeffPresents';

    const fontSize = 16;
    const columns = canvas.width / fontSize;
    const rainDrops: number[] = [];

    for (let x = 0; x < columns; x++) {
      rainDrops[x] = 1;
    }

    // FIX: Use requestAnimationFrame for smoother animation
    let lastDrawTime = 0;
    const drawLoop = (currentTime: number) => {
      if (currentTime - lastDrawTime > this.FRAME_RATE_INTERVAL) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        this.ctx.fillRect(0, 0, canvas.width, canvas.height);
        this.ctx.fillStyle = '#0F0'; // Green text
        this.ctx.font = fontSize + 'px monospace';

        for (let i = 0; i < rainDrops.length; i++) {
          const text = alphabet.charAt(Math.floor(Math.random() * alphabet.length));
          this.ctx.fillText(text, i * fontSize, rainDrops[i] * fontSize);

          if (rainDrops[i] * fontSize > canvas.height && Math.random() > 0.975) {
            rainDrops[i] = 0;
          }
          rainDrops[i]++;
        }
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