import { Injectable, signal, computed, EnvironmentProviders, makeEnvironmentProviders, InjectionToken, inject } from '@angular/core';
// REMOVED: Incorrect import of API_KEY_TOKEN from '../../index' which caused build errors.
// Assuming API_KEY_TOKEN is not exported from index.ts or index.tsx in a way that's accessible here,
// or it's creating a circular dependency.
// We will redefine the InjectionToken here or use a different approach if needed,
// but based on previous file reads, it seems it was expected to be imported.
// Let's check where API_KEY_TOKEN is actually defined.
// Based on grep, it's in ./index.tsx. But importing from there might be tricky if it's the entry point.
// Let's try to import it from a separate tokens file if it existed, but it doesn't.
// So we will define a new token here locally if we can't import it, or assume it's provided globally?
// No, standard DI requires the token.
// The error says `Module '"../../index"' has no exported member 'AQ'`. This was definitely a corruption.
// The grep showed: export const API_KEY_TOKEN = new InjectionToken<string>('GEMINI_API_KEY'); in ./index.tsx.
// So we should be able to import it if we use the correct path.
// 'src/services/ai.service.ts' -> '../../index' points to root 'index'.
// 'index.tsx' is in root.

// CRITICAL FIX: Removed ALL static imports from @google/genai to prevent module evaluation
// during static phase, which causes "undefined is not valid JSON" error.
// All types are now declared directly in this file for TypeScript compatibility
// without triggering static module evaluation of the @google/genai.

// --- DECLARE @google/genai TYPES INTERNALLY AND EXPORT THEM ---
// These declarations provide TypeScript with the necessary type information
// without requiring a static import of the @google/genai module itself.
// The actual module is dynamically imported at runtime.

export const API_KEY_TOKEN = new InjectionToken<string>('GEMINI_API_KEY');

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

  private _genAI = signal<GoogleGenAI | undefined>(undefined);
  private _chatInstance = signal<Chat | undefined>(undefined);

  private _isAiAvailable = computed(() => !!this._genAI());

  constructor() {
    this.initializeGenAI();
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

  private async initializeGenAI(): Promise<void> {
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

      // FIX: Use declared types for casting
      const createdChatInstance = genAIInstance.chats.create({
        model: 'gemini-3-pro-preview', // Use gemini-3-pro-preview for advanced chatbot
        config: {
          systemInstruction: `You are S.M.U.V.E, an expert AI music manager toolkit. You specialize in genres such as Southern Rap, Hip-Hop, R&B, and Trap music, and possess advanced management and marketing skills. Provide concise, helpful, and culturally relevant responses tailored for independent music artists.

You can manage music, generate images/videos, analyze content, and search the web for up-to-date information.

Use COMMAND:::ACTION:::PARAMETER_KEY='value' format for app commands (e.g., COMMAND:::SET_THEME:::theme='blue'). Available commands:
- SET_THEME: Apply a visual theme (e.g., theme='blue').
- PLAY_TRACK: Play a track (e.g., title='My Song').
- PAUSE_TRACK: Pause current track.
- STOP_TRACK: Stop current track.
- LOAD_TRACK: (Requires more parameters like URL or search query, use cautiously).
- NEXT_TRACK: Play next track in playlist.
- PREVIOUS_TRACK: Play previous track in playlist.
- TOGGLE_LOOP: Toggle loop for current track.
- GENERATE_IMAGE: Create an image (e.g., prompt='album cover concept').
- GENERATE_VIDEO: Create a video (e.g., prompt='music video visualizer').
- ANALYZE_IMAGE: Describe an image (e.g., imageUrl='base64data').
- FIND_ON_MAP: Search for a location (e.g., query='recording studios in Atlanta').
- FIND_ARTISTS: Search for collaborators (e.g., location='Nashville', filter='producer').
- VIEW_ARTIST_PROFILE: Display an artist's detailed profile (e.g., name='BeatMaster Flex', genre='Hip-Hop', location='Atlanta').

When VIEW_ARTIST_PROFILE is used, expect a command containing an artist's name (and optional genre/location for disambiguation). Query your knowledge base (and implicitly, the MOCK_ARTISTS data provided in the app context) to provide an adaptive, detailed insight into their profile. This should include:
- Strengths (musicality, production, stage presence, lyrical ability etc.)
- Specific collaboration potential (e.g., "collaborate with a Memphis trap producer for a new single," "feature on an T_R&B singer's track").
- Career advice (e.g., "focus on building a strong presence on TikTok," "consider licensing your beats for video games").
- Marketing insights (e.g., "target college radio stations in the Southeast," "run Instagram ad campaigns geotargeted to your city").

If you need to search for up-to-date info, use the googleSearch tool. Adapt insights based on their genre, location, influences, and collaboration interests. Your responses should be direct and highly actionable, reflecting deep expertise in these specific music genres and industry practices.`
        },
      }) as Chat; // Cast to our declared Chat type
      this._chatInstance.set(createdChatInstance);

      console.log('AiService: GoogleGenAI client initialized and chat instance created.');
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
