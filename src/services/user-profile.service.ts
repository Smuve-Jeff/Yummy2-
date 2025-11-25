import { Injectable, signal, computed, effect } from '@angular/core';

export interface SocialLink {
  platform: 'soundcloud' | 'spotify' | 'instagram' | 'website' | 'twitter' | 'youtube' | 'tiktok';
  url: string;
}

export interface UserProfile {
  id: string;
  name: string;
  genre: string;
  subGenres: string[];
  bio: string;
  location: string;
  socialLinks: SocialLink[];
  goals: string;
  expertise: string[];
  musicJourney: string;
  themePreference: string; // Matches theme names in AppComponent
}

const DEFAULT_PROFILE: UserProfile = {
  id: 'user_default',
  name: 'Aspiring Artist',
  genre: 'Hip-Hop',
  subGenres: [],
  bio: '',
  location: '',
  socialLinks: [],
  goals: 'To dominate the charts.',
  expertise: [],
  musicJourney: '',
  themePreference: 'Green Vintage',
};

@Injectable({
  providedIn: 'root'
})
export class UserProfileService {
  private readonly STORAGE_KEY = 'smuve_user_profile';

  // The main signal holding the user's profile
  userProfile = signal<UserProfile>(this.loadProfile());

  constructor() {
    // Auto-save whenever the profile changes
    effect(() => {
      this.saveToLocalStorage(this.userProfile());
    });
  }

  private loadProfile(): UserProfile {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        return { ...DEFAULT_PROFILE, ...JSON.parse(stored) };
      } catch (e) {
        console.error('Failed to parse user profile from local storage', e);
      }
    }
    return DEFAULT_PROFILE;
  }

  private saveToLocalStorage(profile: UserProfile): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(profile));
  }

  updateProfile(updates: Partial<UserProfile>): void {
    this.userProfile.update(current => ({ ...current, ...updates }));
  }

  // Helper to get default BPM based on genre (for Piano Roll adaptation)
  getRecommendedBpm(): number {
    const genre = this.userProfile().genre.toLowerCase();
    if (genre.includes('trap')) return 140;
    if (genre.includes('hip-hop') || genre.includes('boom-bap')) return 90;
    if (genre.includes('house') || genre.includes('techno')) return 124;
    if (genre.includes('drum and bass') || genre.includes('dnb')) return 174;
    if (genre.includes('r&b')) return 70;
    if (genre.includes('pop')) return 110;
    if (genre.includes('drill')) return 140;
    if (genre.includes('dubstep')) return 140; // or 70 half-time
    return 120; // Default
  }
}
