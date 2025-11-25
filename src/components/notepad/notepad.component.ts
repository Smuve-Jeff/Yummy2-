import { Component, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatrixBackgroundComponent } from '../matrix-background/matrix-background.component';

declare var webkitSpeechRecognition: any;

@Component({
  selector: 'app-notepad',
  templateUrl: './notepad.component.html',
  styleUrls: ['./notepad.component.css'],
  standalone: true,
  imports: [CommonModule, MatrixBackgroundComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotepadComponent implements OnDestroy {
  text: string = '';
  isDictating: boolean = false;
  recognition: any;
  screensaverEnabled: boolean = false;
  speechRecognitionSupported: boolean = false;

  constructor() {
    this.speechRecognitionSupported = 'webkitSpeechRecognition' in window;
    if (this.speechRecognitionSupported) {
      this.recognition = new webkitSpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: any) => {
        let interim_transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            this.text += event.results[i][0].transcript;
          } else {
            interim_transcript += event.results[i][0].transcript;
          }
        }
      };
    }
  }

  toggleDictation() {
    if (this.isDictating) {
      this.recognition.stop();
      this.isDictating = false;
    } else {
      this.recognition.start();
      this.isDictating = true;
    }
  }

  ngOnDestroy() {
    if (this.recognition) {
      this.recognition.stop();
    }
  }
}
