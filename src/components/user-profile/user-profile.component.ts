import { Component, ChangeDetectionStrategy, input, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppTheme } from '../../models/theme';
import { UserProfileService, UserProfile } from '../../services/user-profile.service';

@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.css'],
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserProfileComponent {
  theme = input.required<AppTheme>();

  // Inject Service
  profileService = inject(UserProfileService);
  profile = this.profileService.userProfile;

  // Available Data Options
  readonly GENRES = ['Hip-Hop', 'Trap', 'R&B', 'Neo-Soul', 'Pop', 'Rock', 'Jazz', 'Electronic', 'House', 'Techno', 'Drum & Bass', 'Dubstep', 'Country', 'Classical', 'Experimental'];

  // HARDCODED THEMES from AppComponent (duplicated for now to avoid circular dependency or complex passing)
  // Ideally this should be provided via an input or a shared constant file
  readonly THEMES: {name: string}[] = [
    { name: 'Green Vintage' },
    { name: 'Blue Retro' },
    { name: 'Red Glitch' },
    { name: 'Amber Glow' },
    { name: 'Purple Haze' },
    { name: 'Cyan Wave' },
    { name: 'Yellow Neon' },
  ];

  // Computed Classes based on Theme
  themeClass = computed(() => `text-${this.theme().neutral}-200`);
  borderClass = computed(() => `border-${this.theme().primary}-500/30`);
  borderAccentClass = computed(() => `border-${this.theme().accent}-500`);
  textMainClass = computed(() => `text-${this.theme().primary}-400`);
  textAccentClass = computed(() => `text-${this.theme().accent}-400`);
  bg900Class = computed(() => `bg-${this.theme().primary}-950/40`);
  focusRingClass = computed(() => `focus:ring-${this.theme().accent}-500/50`);

  constructor() {}

  // Form Updates
  updateName(e: Event) {
    this.profileService.updateProfile({ name: (e.target as HTMLInputElement).value });
  }

  updateLocation(e: Event) {
    this.profileService.updateProfile({ location: (e.target as HTMLInputElement).value });
  }

  updateGenre(e: Event) {
    this.profileService.updateProfile({ genre: (e.target as HTMLSelectElement).value });
  }

  updateSubGenres(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    this.profileService.updateProfile({ subGenres: val.split(',').map(s => s.trim()).filter(s => !!s) });
  }

  updateBio(e: Event) {
    this.profileService.updateProfile({ bio: (e.target as HTMLTextAreaElement).value });
  }

  updateGoals(e: Event) {
    this.profileService.updateProfile({ goals: (e.target as HTMLTextAreaElement).value });
  }

  updateExpertise(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    this.profileService.updateProfile({ expertise: val.split(',').map(s => s.trim()).filter(s => !!s) });
  }

  updateMusicJourney(e: Event) {
    this.profileService.updateProfile({ musicJourney: (e.target as HTMLTextAreaElement).value });
  }

  updateTheme(e: Event) {
    this.profileService.updateProfile({ themePreference: (e.target as HTMLSelectElement).value });
  }
}
