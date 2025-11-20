import { bootstrapApplication } from '@angular/platform-browser';
import { provideZonelessChangeDetection, InjectionToken } from '@angular/core';
import { AppComponent } from './src/components/video-editor/app.component';
import { provideAiService } from './src/services/ai.service';

export const API_KEY_TOKEN = new InjectionToken<string>('GEMINI_API_KEY');

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    provideAiService(),
    { provide: API_KEY_TOKEN, useValue: '' },
  ],
}).catch(err => console.error(err));
