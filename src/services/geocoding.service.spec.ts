import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { GeocodingService } from './geocoding.service';

describe('GeocodingService', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it('should return coordinates for a valid address', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve([{ lat: '40.7128', lon: '-74.0060' }]),
    };
    fetchSpy.mockResolvedValue(mockResponse);

    const service = new GeocodingService();
    const result = await service.geocode('New York, NY');

    expect(result).toEqual({ lat: 40.7128, lon: -74.006 });
    expect(fetchSpy).toHaveBeenCalledWith('https://geocode.maps.co/search?q=New%20York%2C%20NY');
  });

  it('should return null for an invalid address or API error', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve([]),
    };
    fetchSpy.mockResolvedValue(mockResponse);

    const service = new GeocodingService();
    const result = await service.geocode('Invalid Address');

    expect(result).toBeNull();
    expect(fetchSpy).toHaveBeenCalledWith('https://geocode.maps.co/search?q=Invalid%20Address');
  });

  it('should return null when fetch fails', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const service = new GeocodingService();
    const result = await service.geocode('Any Address');

    expect(result).toBeNull();
  });
});
