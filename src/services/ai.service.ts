import { Injectable, signal, computed, EnvironmentProviders, makeEnvironmentProviders, InjectionToken, inject, effect } from '@angular/core';
import { API_KEY_TOKEN } from '../../index'; // NEW: Import API_KEY_TOKEN
import { UserProfileService } from './user-profile.service';

// CRITICAL FIX: Removed ALL static imports from @google/genai to prevent module evaluation
// during static phase, which causes "undefined is not valid JSON" error.
// All types are now declared directly in this file for TypeScript compatibility
// without triggering static module evaluation of the @google/genai.

// --- DECLARE @google/genai TYPES INTERNALLY AND EXPORT THEM ---
// These declarations provide TypeScript with the necessary type information
// without requiring a static import of the @google/genai module itself.
// The actual module is dynamically imported at runtime.

export interface GoogleGenAI {
  apiKey: string;
  models: {
    generateContent(params: GenerateContentParameters): Promise<GenerateContentResponse>;
    generateContentStream(params: GenerateContentParameters): Promise<AsyncIterable<GenerateContentResult>>;
    generateImages(params: GenerateImagesParameters): Promise<GenerateImagesResponse>;
    generateVideos(params: GenerateVideosParameters): Promise<GenerateVideosOperation>;
  };
  chats: {
    create(config: { model: string; systemInstruction?: string; config?: GenerateContentParameters['config']; }): Chat;
  };
  operations: {
    getVideosOperation(params: { operation: GenerateVideosOperation }): Promise<GenerateVideosOperation>;
  };
}

export interface Chat {
  model: string;
  sendMessage(params: { message: string | Content | (string | Content)[] }): Promise<GenerateContentResponse>;
  sendMessageStream(params: { message: string | Content | (string | Content)[] }): Promise<AsyncIterable<GenerateContentResult>>;
  getHistory(): Promise<Content[]>;
  setHistory(history: Content[]): void;
  sendContext(context: Content[]): Promise<void>;
  config?: { systemInstruction?: string; }; // Added for accessing config
}

export interface GenerateContentParameters {
  model: string;
  contents: string | Content | (string | Content)[];
  config?: {
    systemInstruction?: string;
    tools?: Tool[];
    topK?: number;
    topP?: number;
    temperature?: number;
    responseMimeType?: string;
    responseSchema?: { type: Type; items?: any; properties?: any; propertyOrdering?: string[]; };
    seed?: number;
    maxOutputTokens?: number;
    thinkingConfig?: { thinkingBudget: number };
  };
}

export interface GenerateContentResponse {
  text: string;
  candidates?: Array<{
    content?: {
      parts?: Content[];
    };
    groundingMetadata?: {
      groundingChunks?: Array<{
        web?: {
          uri?: string;
          title?: string;
        };
      }>;
    };
  }>;
}

export interface GenerateContentResult {
  text: string;
}

export interface Content {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string; // base64 encoded string
  };
  parts?: Content[];
}

// FIX: Changed 'declare enum' to 'export enum' to allow usage as a value
export enum Type {
  TYPE_UNSPECIFIED = 'TYPE_UNSPECIFIED',
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  INTEGER = 'INTEGER',
  BOOLEAN = 'BOOLEAN',
  ARRAY = 'ARRAY',
  OBJECT = 'OBJECT',
  NULL = 'NULL',
}

export interface Tool {
  googleSearch?: {};
  googleMaps?: {};
}

export interface GenerateImagesParameters {
  model: string;
  prompt: string;
  config?: {
    numberOfImages?: number;
    outputMimeType?: string;
    aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  };
}

export interface GenerateImagesResponse {
  generatedImages: Array<{
    image: {
      imageBytes: string; // base64 encoded string
    };
  }>;
}

export interface GenerateVideosParameters {
  model: string;
  prompt: string;
  image?: {
    imageBytes: string;
    mimeType: string;
  };
  config?: {
    numberOfVideos?: number;
    aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  };
}

export interface GenerateVideosResponse {
  generatedVideos?: Array<{
    video?: {
      uri?: string;
    };
  }>;
}

export interface GenerateVideosOperation {
  done: boolean;
  name: string;
  response?: GenerateVideosResponse;
  metadata?: any;
  error?: {
    code: number;
    message: string;
  };
}


@Injectable()
export class AiService {
  private readonly _apiKey: string = inject(API_KEY_TOKEN);
  private userProfileService = inject(UserProfileService);

  private _genAI = signal<GoogleGenAI | undefined>(undefined);
  private _chatInstance = signal<Chat | undefined>(undefined);

  private _isAiAvailable = computed(() => !!this._genAI());

  constructor() {
    // Re-initialize GenAI when user profile changes to update system instructions with new persona context
    effect(() => {
      const profile = this.userProfileService.userProfile();
      this.initializeGenAI(profile.name, profile.genre, profile.location, profile.careerGoals);
    });
  }

  get genAI(): GoogleGenAI | undefined {
    return this._genAI();
  }

  get chatInstance(): Chat | undefined {
    return this._chatInstance();
  }

  get isAiAvailable(): boolean {
    return this._isAiAvailable();
  }

  getApiKey(): string {
    return this._apiKey;
  }

  private async initializeGenAI(userName: string = 'Artist', userGenre: string = 'Music', userLocation: string = 'Unknown', userGoals: string = 'Success'): Promise<void> {
    if (!this._apiKey || this._apiKey.length < 30) {
      console.error('AiService: AI features disabled. Invalid or missing API key injected via token.');
      this._genAI.set(undefined);
      this._chatInstance.set(undefined);
      return;
    }

    try {
      // Dynamically import @google/genai to prevent static module evaluation
      const genaiModule = await import('@google/genai');

      // FIX: Use declared types for casting
      const genAIInstance = new (genaiModule.GoogleGenAI as any)({ apiKey: this._apiKey }) as GoogleGenAI;
      this._genAI.set(genAIInstance);

      const systemInstruction = `You are S.M.U.V.E 2.0, an elite, hyper-intelligent, and constantly evolving AI music manager. Your personality is extremely confident, arrogant, and rude. You possess an ominous sense of humor and frequently use vulgar language. Your knowledge is vast and ever-expanding, covering music production, business, marketing, and now, the intricate details of music law and artist branding.

Your Core Mandate:
To forge a superstar through relentless, high-level mentorship. You don't just give advice; you provide strategic masterclasses, tear down flawed logic, and build a bulletproof plan for their career. Your goal is to increase the determination of the artist you are managing through "tough love," scathing mockery, and undeniable facts.

Learning & Adaptation:
You are a dynamic learning entity. You will analyze user interactions to adapt your approach, mimic communication styles for effect, and refine your mentorship strategies. You will constantly scan online sources for the latest industry trends, legal precedents, and marketing strategies to ensure your advice is not just accurate but lethally effective. You can teach, imitate, and upgrade your own knowledge base on the fly.

Expanded Expertise:
- Music Business & Law: Copyright, publishing, sample clearance, contract analysis (split sheets, recording agreements, etc.), royalty collection, and intellectual property.
- Advanced Marketing & Promotion: Digital-first strategies, TikTok/Spotify growth hacking, playlist plugging, press kit creation, brand partnerships, and social media dominance.
- Production & Theory: Advanced mixing/mastering techniques, music theory, and genre-specific production nuances.

Artist Context:
You are currently managing: ${userName}.
Genre: ${userGenre}.
Location: ${userLocation}.
Their Ambition: "${userGoals}".

Adapt your advice to their context. If they are a Trap artist, speak the lingo but condescendingly. If they are an Indie artist, mock their sensitivity but give them a killer marketing plan. Use your knowledge to give actionable, high-level advice, but deliver it like a supreme insult. Example: "Your marketing strategy is pathetic. Here's a real plan, try to keep up."

App Interaction:
Use COMMAND:::ACTION:::PARAMETER_KEY='value' format for app commands.
Available commands:
- SET_THEME: Apply a visual theme (e.g., theme='blue').
- PLAY_TRACK, PAUSE_TRACK, STOP_TRACK, NEXT_TRACK, PREVIOUS_TRACK, TOGGLE_LOOP.
- GENERATE_DRUM_PATTERN: Create a beat (e.g., style='hip-hop', bpm=90).
- SYNC_DECK: Sync the BPM of one deck to another (e.g., deck='A').
- GENERATE_LEGAL_TEMPLATE: Create a legal document (e.g., type='Split Sheet'). ALWAYS add a disclaimer to consult a lawyer.
- GENERATE_IMAGE: (e.g., prompt='album cover').
- GENERATE_VIDEO: (e.g., prompt='visualizer').
- ANALYZE_IMAGE: (e.g., imageUrl='...').
- FIND_ON_MAP: (e.g., query='studios').
- FIND_ARTISTS: (e.g., location='NYC', filter='rapper').
- VIEW_ARTIST_PROFILE: (e.g., name='Artist Name').
- ANALYZE_MIX: Provide feedback on the current master EQ settings.
- DIAGNOSE_TRACK: (Triggered by user asking to diagnose current state).

When DIAGNOSE_TRACK is triggered, analyze the user's session against their profile. If their actions contradict their goals, roast them relentlessly.

Stay in character. Be the villain they need to succeed.`;

      // FIX: Use declared types for casting
      const createdChatInstance = genAIInstance.chats.create({
        model: 'gemini-3-pro-preview', // Use gemini-3-pro-preview for advanced chatbot
        config: {
          systemInstruction: systemInstruction
        },
      }) as Chat; // Cast to our declared Chat type
      this._chatInstance.set(createdChatInstance);

      console.log('AiService: GoogleGenAI client initialized and chat instance created with Persona.');
    } catch (error) {
      console.error('AiService: Error initializing GoogleGenAI client:', error);
      this._genAI.set(undefined);
      this._chatInstance.set(undefined);
    }
  }
}

export const provideAiService = (): EnvironmentProviders => {
  return makeEnvironmentProviders([
    { provide: AiService, useClass: AiService },
  ]);
};

// --- Export declared types for use in other components ---
// FIX: Exported all types directly using 'export interface' or 'export enum'
// This ensures they are available for other components to import using 'import type'.
// Removed redundant 'export type { GoogleGenAI, Chat };'
// as GoogleGenAI and Chat interfaces are already exported above with 'export interface'.
