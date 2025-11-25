import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GeocodingService {

  private readonly API_URL = 'https://geocode.maps.co/search';

  async geocode(address: string): Promise<{ lat: number; lon: number } | null> {
    try {
      const response = await fetch(`${this.API_URL}?q=${encodeURIComponent(address)}`);
      if (!response.ok) {
        console.error('Geocoding API request failed:', response.statusText);
        return null;
      }
      const data = await response.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon)
        };
      }
    } catch (error) {
      console.error('Error during geocoding:', error);
    }
    return null;
  }
}
