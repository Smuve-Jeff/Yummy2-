import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapComponent } from './map.component';
import { MOCK_ARTISTS } from '../networking/networking.component';
import * as L from 'leaflet';
import { SimpleChange } from '@angular/core';

// Mock the leaflet plugin to prevent resolution errors
vi.mock('leaflet.gridlayer.googlemutant', () => ({}));

describe('MapComponent', () => {
  let component: MapComponent;
  let fixture: ComponentFixture<MapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MapComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize the map', () => {
    const mapContainer = document.createElement('div');
    Object.defineProperty(component, 'mapContainer', {
        value: { nativeElement: mapContainer },
        writable: false,
        configurable: true
    });
    component.ngAfterViewInit();
    expect(component['map']).toBeDefined();
  });

  it('should update markers when artists change', () => {
    const mapContainer = document.createElement('div');
    Object.defineProperty(component, 'mapContainer', {
        value: { nativeElement: mapContainer },
        writable: false,
        configurable: true
    });
    component.ngAfterViewInit();
    const artists = MOCK_ARTISTS.slice(0, 2);
    artists[0].locationLatLon = { lat: 40.6782, lon: -73.9442 };
    artists[1].locationLatLon = { lat: 34.0522, lon: -118.2437 };
    component.artists = () => artists;
    component.ngOnChanges({
        artists: new SimpleChange([], artists, true)
    });
    expect(component['markers'].length).toBe(2);
  });
});
