import { Component, AfterViewInit, ViewChild, ElementRef, input, OnChanges, SimpleChanges, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import 'leaflet.gridlayer.googlemutant';
import { ArtistProfile } from '../networking/networking.component';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements AfterViewInit, OnChanges {
  @ViewChild('map') private mapContainer!: ElementRef;
  private map!: L.Map;
  artists = input.required<ArtistProfile[]>();
  mapBoundsChanged = output<L.LatLngBounds>();

  private markers: L.Marker[] = [];

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['artists'] && this.map) {
      this.updateMarkers();
    }
  }

  private initMap(): void {
    this.map = L.map(this.mapContainer.nativeElement, {
      center: [39.8283, -98.5795],
      zoom: 4
    });

    const googleLayer = L.gridLayer.googleMutant({
        type: 'roadmap' // valid values are 'roadmap', 'satellite', 'terrain' and 'hybrid'
    }).addTo(this.map);

    this.map.on('moveend', () => {
      this.mapBoundsChanged.emit(this.map.getBounds());
    });
  }

  private updateMarkers(): void {
    // Clear existing markers
    this.markers.forEach(marker => marker.remove());
    this.markers = [];

    // Add new markers
    this.artists().forEach(artist => {
      if (artist.locationLatLon) {
        const marker = L.marker([artist.locationLatLon.lat, artist.locationLatLon.lon]);
        marker.bindPopup(`<b>${artist.name}</b><br>${artist.genre}`);
        marker.addTo(this.map);
        this.markers.push(marker);
      }
    });
  }
}
