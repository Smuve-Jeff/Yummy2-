import { ComponentFixture, TestBed, getTestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { NetworkingComponent } from './networking.component';
import { GeocodingService } from '../../services/geocoding.service';
import { AiService } from '../../services/ai.service';
import { UserProfileService } from '../../services/user-profile.service';
import { signal, computed } from '@angular/core';
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { MapComponent } from '../map/map.component';
import { AppTheme } from '../../models/theme';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

// --- Mocks ---

const mockAiService = {
  isAiAvailable: computed(() => true),
  genAI: { models: { generateContent: vi.fn() } },
  getApiKey: vi.fn(() => 'mock-key'),
};

const mockGeocodingService = {
  geocode: vi.fn().mockResolvedValue({ lat: 1, lon: 1 })
};

const mockUserProfileService = {
  userProfile: signal({ name: 'Test' })
};

describe('NetworkingComponent', () => {
  let component: NetworkingComponent;
  let fixture: ComponentFixture<NetworkingComponent>;

  beforeAll(() => {
    getTestBed().initTestEnvironment(
      BrowserDynamicTestingModule,
      platformBrowserDynamicTesting()
    );
  });

  beforeEach(async () => {
    // Mock the MapComponent to avoid its template dependencies
    vi.mock('../map/map.component', () => ({
        MapComponent: vi.fn()
    }));

    await TestBed.configureTestingModule({
      imports: [NetworkingComponent, NoopAnimationsModule], // Import the standalone component and disable animations
      providers: [
        { provide: AiService, useValue: mockAiService },
        { provide: GeocodingService, useValue: mockGeocodingService },
        { provide: UserProfileService, useValue: mockUserProfileService }
      ]
    })
    .overrideComponent(NetworkingComponent, {
        remove: { imports: [MapComponent] },
        add: { imports: [] }
    })
    .compileComponents();

    fixture = TestBed.createComponent(NetworkingComponent);
    component = fixture.componentInstance;

    // Manually set required input `theme`
    component.theme = () => ({ name: 'dark', blue: { '400': '#60a5fa' } } as unknown as AppTheme);

    fixture.detectChanges(); // Trigger initial data binding
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should filter artists by location with basic filter', async () => {
    vi.spyOn(mockAiService, 'isAiAvailable', 'get').mockReturnValue(false);
    component.searchLocation.set('New Orleans');

    await component.searchArtists();

    expect(component.filteredArtists().length).toBe(2);
  });

  it('should filter with AI search', async () => {
    vi.spyOn(mockAiService, 'isAiAvailable', 'get').mockReturnValue(true);
    const mockResponse = { text: JSON.stringify({ matchingArtistIds: ["flex101"] }) };
    mockAiService.genAI.models.generateContent.mockResolvedValue(mockResponse);

    component.searchLocation.set('Brooklyn');
    await component.searchArtists();

    expect(mockAiService.genAI.models.generateContent).toHaveBeenCalled();
    expect(component.filteredArtists().length).toBe(1);
    expect(component.filteredArtists()[0].id).toBe('flex101');
  });

  it('should geocode search location for radius search', async () => {
    vi.spyOn(mockAiService, 'isAiAvailable', 'get').mockReturnValue(false);
    component.searchLocation.set('New York, NY');
    component.radiusFilter.set(50);

    await component.searchArtists();

    expect(mockGeocodingService.geocode).toHaveBeenCalledWith('New York, NY');
  });

  it('should update displayed artists after search', async () => {
    vi.spyOn(mockAiService, 'isAiAvailable', 'get').mockReturnValue(false);
    component.searchLocation.set('New Orleans');

    await component.searchArtists();

    expect(component.displayedArtists().length).toBe(2);
  });
});
