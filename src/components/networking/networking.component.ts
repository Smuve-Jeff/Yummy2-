import { Component, ChangeDetectionStrategy, input, signal, computed, inject, effect, output, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppTheme } from '../video-editor/app.component';
// FIX: Import all declared types from AiService for full static import compatibility
import { AiService, GenerateContentResponse, Type } from '../../services/ai.service'; // Use declared types

// Declare Leaflet global variable
declare const L: any;

export interface ArtistProfile {
  id: string; // NEW: Unique ID for easier lookup
  name: string;
  genre: string;
  location: string;
  locationLatLon?: { lat: number; lon: number }; // NEW: For potential map integration
  bio: string;
  contact: string;
  imageUrl: string;
  collaborationInterest: string[];
  genres: string[]; // NEW: More structured genre info
  influences: string[]; // NEW: Artist influences
  links: { type: 'soundcloud' | 'spotify' | 'instagram' | 'website'; url: string }[]; // NEW: Social/music links
  // NEW: Additional fields for enhanced profile
  specialties?: string[]; // e.g., "beatmaking", "lyricism", "mixing"
  targetAudience?: string; // e.g., "Gen Z Hip-Hop fans", "Indie folk listeners"
  careerGoals?: string; // e.g., "Touring extensively", "Licensing for film/TV"
}

export const MOCK_ARTISTS: ArtistProfile[] = [
  {
    id: "flex101",
    name: "BeatMaster Flex",
    genre: "Hip-Hop Producer",
    location: "Brooklyn, NY",
    locationLatLon: { lat: 40.6782, lon: -73.9442 },
    bio: "Award-winning producer with a knack for soulful beats and hard-hitting drums. Always looking for fresh vocalists and lyricists to elevate tracks. Specializing in old-school boom-bap and modern trap sounds.",
    contact: "flexbeats@email.com",
    imageUrl: "https://picsum.photos/seed/flex/150/150",
    collaborationInterest: ["Vocalist", "Lyricist", "Rapper", "Mixing Engineer"],
    genres: ["Hip-Hop", "Boom-Bap", "Trap", "Southern Rap"],
    influences: ["J Dilla", "DJ Premier", "Madlib", "Metro Boomin"],
    links: [{ type: "soundcloud", url: "https://soundcloud.com/beatmasterflex" }],
    specialties: ["Sampling", "Drum Programming", "Arrangement"],
    targetAudience: "Underground Hip-Hop, Trap, and R&B fans",
    careerGoals: "Produce a platinum album, mentor new artists"
  },
  {
    id: "mae202",
    name: "Melody Mae",
    genre: "Indie Pop Vocalist",
    location: "Los Angeles, CA",
    locationLatLon: { lat: 34.0522, lon: -118.2437 },
    bio: "Ethereal vocals with a dreamy vibe. Seeking producers for new tracks and live musicians for touring. Inspired by nature and introspection.",
    contact: "melodymae@email.com",
    imageUrl: "https://picsum.photos/seed/mae/150/150",
    collaborationInterest: ["Producer", "Guitarist", "Songwriter", "Keyboardist"],
    genres: ["Indie Pop", "Dream Pop", "Alternative", "R&B"],
    influences: ["Fiona Apple", "Lana Del Rey", "Mazzy Star", "SZA"],
    links: [{ type: "spotify", url: "https://open.spotify.com/artist/melodymae" }, { type: "instagram", url: "https://instagram.com/melodymae" }],
    specialties: ["Vocal Harmony", "Lyric Writing", "Live Performance"],
    targetAudience: "Indie Pop, Dream Pop, and soulful R&B listeners",
    careerGoals: "Release a critically acclaimed album, headline festivals"
  },
  {
    id: "sammy303",
    name: "Synthwave Sammy",
    genre: "Electronic / Synthwave",
    location: "Miami, FL",
    locationLatLon: { lat: 25.7617, lon: -80.1918 },
    bio: "Master of retro synths and driving basslines, creating nostalgic soundscapes. Open to scoring short films, collaborating with vocalists, or DJing events.",
    contact: "sammywave@email.com",
    imageUrl: "https://picsum.photos/seed/sammy/150/150",
    collaborationInterest: ["Vocalist", "Filmmaker", "DJ", "Sound Designer"],
    genres: ["Synthwave", "Electronic", "Vaporwave"],
    influences: ["Com Truise", "Kavinsky", "Daft Punk"],
    links: [{ type: "soundcloud", url: "https://soundcloud.com/synthwavesammy" }, { type: "website", url: "https://synthwavesammy.com" }]
  },
  {
    id: "jake404",
    name: "Jazz Fusion Jake",
    genre: "Jazz / Fusion Guitarist",
    location: "New Orleans, LA",
    locationLatLon: { lat: 29.9511, lon: -90.0715 },
    bio: "Complex harmonies and intricate solos define my style. Looking for drummers, bassists, and horn players for a new progressive jazz project.",
    contact: "jakejazz@email.com",
    imageUrl: "https://picsum.photos/seed/jake/150/150",
    collaborationInterest: ["Drummer", "Bassist", "Saxophonist", "Keyboardist"],
    genres: ["Jazz Fusion", "Progressive Jazz", "Funk"],
    influences: ["Pat Metheny", "John Scofield", "Frank Gambale"],
    links: [{ type: "spotify", url: "https://open.spotify.com/artist/jazzfusionjake" }]
  },
  {
    id: "rina505",
    name: "Rhythm Queen Rina",
    genre: "Afrobeat Drummer",
    location: "London, UK",
    locationLatLon: { lat: 51.5074, lon: 0.1278 },
    bio: "High-energy percussionist bringing vibrant global rhythms to any track. Collaborations in world music, hip-hop, or pop welcome. Specializing in intricate polyrhythms.",
    contact: "rina.drums@email.com",
    imageUrl: "https://picsum.photos/seed/rina/150/150",
    collaborationInterest: ["Producer", "Bassist", "Vocalist", "Guitarist"],
    genres: ["Afrobeat", "World Music", "Funk", "Hip-Hop"],
    influences: ["Tony Allen", "Fela Kuti", "Ginger Baker"],
    links: [{ type: "instagram", url: "https://instagram.com/rhythmqueenrina" }]
  },
  {
    id: "keys606",
    name: "Electro Keys Eva",
    genre: "Electronic Keyboardist",
    location: "Berlin, DE",
    locationLatLon: { lat: 52.5200, lon: 13.4050 },
    bio: "Versatile keyboardist exploring ambient, techno, and house. Seeking DJs, producers, and experimental vocalists for live and studio projects.",
    contact: "eva.keys@email.com",
    imageUrl: "https://picsum.photos/seed/eva/150/150",
    collaborationInterest: ["Producer", "DJ", "Vocalist", "Sound Designer"],
    genres: ["Techno", "House", "Ambient", "Electronic"],
    influences: ["Kraftwerk", "Aphex Twin", "Four Tet"],
    links: [{ type: "soundcloud", url: "https://soundcloud.com/electrokeys" }]
  },
  {
    id: "rhyme707",
    name: "Poetic Rhyme Rex",
    genre: "Spoken Word / Hip-Hop",
    location: "Chicago, IL",
    locationLatLon: { lat: 41.8781, lon: -87.6298 },
    bio: "Lyricist and spoken word artist with a powerful message. Collaborations with producers across genres, from jazz to trap.",
    contact: "rexrhymes@email.com",
    imageUrl: "https://picsum.photos/seed/rex/150/150",
    collaborationInterest: ["Producer", "Vocalist", "Jazz Musician"],
    genres: ["Spoken Word", "Hip-Hop", "Poetry", "Trap"],
    influences: ["Gil Scott-Heron", "Kendrick Lamar", "Saul Williams", "J. Cole"],
    links: [{ type: "instagram", url: "https://instagram.com/poeticrex" }],
    specialties: ["Freestyle", "Storytelling", "Performance Art"],
    targetAudience: "Conscious Hip-Hop and Spoken Word enthusiasts",
    careerGoals: "Release a conceptual album, perform at major poetry slams"
  },
  {
    id: "south808",
    name: "Southern Siren Sia",
    genre: "R&B / Trap Soul Vocalist",
    location: "Atlanta, GA",
    locationLatLon: { lat: 33.7488, lon: -84.3877 },
    bio: "Sultry vocals blending R&B smoothness with trap grit. Collaborating with producers for new EPs and visual artists for music videos. Deeply inspired by Atlanta's vibrant music scene.",
    contact: "siasounds@email.com",
    imageUrl: "https://picsum.photos/seed/sia/150/150",
    collaborationInterest: ["Producer", "Beatmaker", "Video Director", "Songwriter"],
    genres: ["R&B", "Trap Soul", "Neo-Soul", "Southern Rap"],
    influences: ["Summer Walker", "SZA", "Future", "Jhené Aiko"],
    links: [{ type: "instagram", url: "https://instagram.com/southernsirensia" }, { type: "spotify", url: "https://open.spotify.com/artist/southernsirensia" }],
    specialties: ["Vocal production", "Ad-libs", "Melody creation"],
    targetAudience: "R&B and Trap music listeners, especially in the South",
    careerGoals: "Build a strong brand, perform at A3C, release a full-length album"
  },
  {
    id: "beatrix909",
    name: "Beatrix B",
    genre: "Trap Producer",
    location: "Houston, TX",
    locationLatLon: { lat: 29.7604, lon: -95.3698 },
    bio: "Hard-hitting trap beats with cinematic undertones. Always on the lookout for new vocalists, especially those in Southern Rap and R&B, for joint projects. Ready to drop bangers.",
    contact: "beatrixb@email.com",
    imageUrl: "https://picsum.photos/seed/beatrix/150/150",
    collaborationInterest: ["Vocalist", "Rapper", "Mixing Engineer", "Songwriter"],
    genres: ["Trap", "Southern Rap", "Hip-Hop"],
    influences: ["Zaytoven", "Cardo", "Tay Keith"],
    links: [{ type: "soundcloud", url: "https://soundcloud.com/beatrixb" }],
    specialties: ["Beatmaking", "Sound Design", "Mixing"],
    targetAudience: "Trap and Southern Hip-Hop fans",
    careerGoals: "Secure major placements, build a production team"
  },
  {
    id: "soulful1010",
    name: "Soulful Sam",
    genre: "Neo-Soul / R&B Producer",
    location: "New Orleans, LA",
    locationLatLon: { lat: 29.9511, lon: -90.0715 },
    bio: "Crafting lush, soulful soundscapes with a modern twist. Seeking R&B and Neo-Soul vocalists, instrumentalists (especially horns and strings), for studio and live collaborations.",
    contact: "soulfulsam@email.com",
    imageUrl: "https://picsum.photos/seed/sam/150/150",
    collaborationInterest: ["Vocalist", "Instrumentalist", "Songwriter", "Mixing Engineer"],
    genres: ["Neo-Soul", "R&B", "Jazz", "Funk"],
    influences: ["D'Angelo", "Erykah Badu", "Robert Glasper"],
    links: [{ type: "spotify", url: "https://open.spotify.com/artist/soulfulsam" }],
    specialties: ["Arrangement", "Keys", "Live instrumentation recording"],
    targetAudience: "Neo-Soul, R&B, and Jazz fusion listeners",
    careerGoals: "Release collaborative EPs, perform at jazz/soul festivals"
  }
];


@Component({
  selector: 'app-networking',
  templateUrl: './networking.component.html',
  styleUrls: ['./networking.component.css'],
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetworkingComponent implements AfterViewInit, OnDestroy {
  theme = input.required<AppTheme>();
  initialSearchQuery = input<string | null>(null);

  searchLocation = signal('');
  collaborationFilter = signal<string>('');
  displayedArtists = signal<ArtistProfile[]>([]);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  selectedArtistProfile = signal<ArtistProfile | null>(null); // NEW: For showing detailed profile
  showArtistDetailModal = signal(false); // NEW: Controls the detail modal

  private aiService = inject(AiService);
  isAiAvailable = computed(() => this.aiService.isAiAvailable);

  artistProfileSelected = output<ArtistProfile>(); // NEW: Output for parent to react to selection

  // Map Properties
  private map: any;
  private markers: any[] = [];

  constructor() {
    effect(() => {
      const query = this.initialSearchQuery();
      if (query && query !== this.searchLocation()) {
        this.searchLocation.set(query);
        this.searchArtists();
      }
    });

    // Initial display of all artists
    this.displayedArtists.set(MOCK_ARTISTS);

    // Effect to close detail modal if selectedArtistProfile is cleared
    effect(() => {
      if (!this.selectedArtistProfile()) {
        this.showArtistDetailModal.set(false);
      } else {
        this.showArtistDetailModal.set(true);
      }
    });

    // Effect to update map markers when displayedArtists changes
    effect(() => {
      const artists = this.displayedArtists();
      // Check if map is initialized before updating markers
      if (this.map) {
        this.updateMapMarkers(artists);
      }
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private initMap(): void {
    // Check if L (Leaflet) is available
    if (typeof L === 'undefined') {
      console.warn('Leaflet not loaded. Map will not be available.');
      return;
    }

    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;

    // Initialize map focused on US/Atlantic area
    this.map = L.map('map').setView([35, -95], 3);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(this.map);

    this.updateMapMarkers(this.displayedArtists());
  }

  private updateMapMarkers(artists: ArtistProfile[]): void {
    if (!this.map) return;

    // Clear existing markers
    this.markers.forEach(marker => this.map.removeLayer(marker));
    this.markers = [];

    artists.forEach(artist => {
      if (artist.locationLatLon) {
        const marker = L.marker([artist.locationLatLon.lat, artist.locationLatLon.lon])
          .addTo(this.map)
          .bindPopup(`<b>${artist.name}</b><br>${artist.genre}`);

        marker.on('click', () => {
          this.viewArtistDetail(artist);
        });

        this.markers.push(marker);
      }
    });
  }

  onSearchLocationInput(event: Event): void {
    this.searchLocation.set((event.target as HTMLInputElement).value);
  }

  onCollaborationFilterInput(event: Event): void {
    this.collaborationFilter.set((event.target as HTMLSelectElement).value);
  }

  async searchArtists(): Promise<void> {
    const locationQuery = this.searchLocation().trim();
    const filter = this.collaborationFilter().trim();

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.displayedArtists.set([]); // Clear previous results

    if (!this.aiService.isAiAvailable) {
      console.warn('AI services unavailable for networking search enhancement. Falling back to basic filter.');
      let filtered = MOCK_ARTISTS.filter(artist => {
        const locationMatch = !locationQuery || artist.location.toLowerCase().includes(locationQuery.toLowerCase());
        const collabMatch = !filter || artist.collaborationInterest.some(interest => interest.toLowerCase().includes(filter.toLowerCase()));
        return locationMatch && collabMatch;
      });
      this.displayedArtists.set(filtered);
      if (filtered.length === 0) {
        this.errorMessage.set('No artists found matching your criteria with basic filter.');
      }
      this.isLoading.set(false);
      return;
    }

    try {
      // Prompt updated to leverage S.M.U.V.E's enhanced knowledge
      const prompt = `You are an expert music industry scout specializing in Southern Rap, Hip-Hop, R&B, and Trap music genres, with advanced management and marketing skills. Given the following artists' profiles (as JSON array):\n\n${JSON.stringify(MOCK_ARTISTS)}\n\nFind artists who match the location "${locationQuery}" (if provided, prioritize this) and are interested in collaborations that include "${filter}" (if provided, prioritize this). Consider their primary genre, influences, and bio for a holistic match. Provide the IDs of the top matching artists in a JSON array: {"matchingArtistIds": ["id1", "id2"]}. If no artists match, return an empty array.`;

      const response: GenerateContentResponse = await this.aiService.genAI!.models.generateContent({
        model: 'gemini-3-pro-preview', // Using Pro for complex filtering
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT, // Use Type as a value
            properties: {
              matchingArtistIds: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            propertyOrdering: ["matchingArtistIds"],
          },
        },
      });

      const aiResult = JSON.parse(response.text);
      const matchingIds: string[] = aiResult.matchingArtistIds || [];

      const filtered = MOCK_ARTISTS.filter(artist => matchingIds.includes(artist.id));
      this.displayedArtists.set(filtered);

      if (filtered.length === 0) {
        this.errorMessage.set('AI found no artists matching your criteria. Try different terms.');
      }
    } catch (error) {
      console.error('AI failed to enhance networking search:', error);
      this.errorMessage.set('AI search enhancement failed. Falling back to basic filter.');
      // Fallback to basic filtering if AI fails
      let filtered = MOCK_ARTISTS.filter(artist => {
        const locationMatch = !locationQuery || artist.location.toLowerCase().includes(locationQuery.toLowerCase());
        const collabMatch = !filter || artist.collaborationInterest.some(interest => interest.toLowerCase().includes(filter.toLowerCase()));
        return locationMatch && collabMatch;
      });
      this.displayedArtists.set(filtered);
      if (filtered.length === 0) {
        this.errorMessage.set('No artists found matching your criteria with basic filter.');
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  clearSearch(): void {
    this.searchLocation.set('');
    this.collaborationFilter.set('');
    this.displayedArtists.set(MOCK_ARTISTS);
    this.errorMessage.set(null);
  }

  viewArtistDetail(artist: ArtistProfile): void {
    this.selectedArtistProfile.set(artist);
    this.artistProfileSelected.emit(artist); // Emit to parent
  }

  closeArtistDetailModal(): void {
    this.selectedArtistProfile.set(null);
  }
}
