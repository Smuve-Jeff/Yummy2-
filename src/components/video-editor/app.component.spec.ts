import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { provideAiService } from '../../services/ai.service';
import { API_KEY_TOKEN } from '../../../index';

// We need to mock index.tsx because it has side effects (bootstrapping application)
// that interfere with the test environment.
vi.mock('../../../index', () => ({
  API_KEY_TOKEN: 'GEMINI_API_KEY' // Mock the token
}));

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideAiService(),
        { provide: API_KEY_TOKEN, useValue: 'test-api-key' }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
