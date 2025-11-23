import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { MOCK_ARTISTS } from '../networking/networking.component';

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the app', () => {
    expect(component).toBeTruthy();
  });

  describe('handleChatbotCommand', () => {
    it('should correctly filter artists with multiple criteria', () => {
      // Simulate a chatbot command to view an artist profile with multiple criteria
      component.handleChatbotCommand({
        action: 'VIEW_ARTIST_PROFILE',
        parameters: {
          name: 'BeatMaster Flex',
          genre: 'Hip-Hop',
          location: 'Atlanta',
        },
      });

      // Check if the correct artist is selected
      expect(component.selectedArtistProfile()).toEqual(MOCK_ARTISTS[0]);
    });

    it('should not select an artist if any of the criteria does not match', () => {
      // Simulate a chatbot command with a non-matching criterion
      component.handleChatbotCommand({
        action: 'VIEW_ARTIST_PROFILE',
        parameters: {
          name: 'BeatMaster Flex',
          genre: 'Country', // This genre does not match
          location: 'Atlanta',
        },
      });

      // Check that no artist is selected
      expect(component.selectedArtistProfile()).toBeNull();
    });
  });
});
