import { Component, ChangeDetectionStrategy, signal, output, ElementRef, viewChild, input, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
// FIX: Import only types from AiService for full static import compatibility
import { AiService, GenerateContentResponse, GenerateContentResult, Content, Type, Tool } from '../../../services/ai.service'; // Use declared types
import { AppTheme } from '../../video-editor/app.component';
import { MOCK_ARTISTS, ArtistProfile } from '../../networking/networking.component'; // NEW: Import MOCK_ARTISTS and ArtistProfile for AI context


// FIX: Correctly declare SpeechRecognition and related event types for TypeScript
declare interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

declare interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  // FIX: Added index signature for array-like access
  [index: number]: SpeechRecognitionResult;
}

declare interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

declare interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
  readonly resultIndex: number;
  // Add other properties if needed for detailed usage, but these are sufficient for the current code.
  readonly emma: Document | null;
  readonly interpretation: any;
}

declare interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string; // Simplified, could be a specific enum type
  readonly message: string;
}

// FIX: Augment the Window interface to include SpeechRecognition and webkitSpeechRecognition as constructors
// This ensures that `window.SpeechRecognition` and `window.webkitSpeechRecognition` are correctly typed as constructors
// and resolves the TypeScript errors.
declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition;
      prototype: SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognition;
      prototype: SpeechRecognition;
    };
  }
}


interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  urls?: { uri: string; title?: string }[]; // New: Optional field for grounding URLs
  imageUrl?: string; // NEW: For image analysis context
}

@Component({
  selector: 'app-chatbot',
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.css'],
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatbotComponent {
  close = output<void>();
  appCommand = output<{ action: string; parameters: any; aiContext?: string }>(); // New: Output for application commands
  theme = input.required<AppTheme>(); // NEW: Input for current theme
  imageToAnalyzeUrl = input<string | null>(null); // NEW: Input for image to analyze
  imageAnalysisResult = output<string>(); // NEW: Output for image analysis result
  mapLocationQuery = input<string | null>(null); // NEW: Input for map location query
  mapLocationResult = output<string>(); // NEW: Output for map location result

  messages = signal<ChatMessage[]>([]);
  userMessage = signal('');
  isLoading = signal(false);
  isVoiceInputActive = signal(false); // NEW: Signal for voice input
  isSpeaking = signal(false); // NEW: Signal if the chatbot is speaking
  isDeepQueryActive = signal(false); // NEW: Signal for deep query mode

  private aiService = inject(AiService); // NEW: Import AiService as a value
  // FIX: Access isAiAvailable as a getter
  isAiAvailable = computed(() => this.aiService.isAiAvailable);

  chatHistoryRef = viewChild<ElementRef<HTMLDivElement>>('chatHistory');

  // Removed direct genAI and chatInstance, now accessed via aiService
  private speechRecognition: SpeechRecognition | null = null; // NEW: SpeechRecognition instance
  private speechUtterance: SpeechSynthesisUtterance | null = null; // NEW: SpeechSynthesisUtterance instance


  constructor() {
    // If AI is not available, add a message to the chat
    // FIX: Access isAiAvailable as a getter
    if (!this.aiService.isAiAvailable) {
      this.messages.update(msgs => [...msgs, { role: 'model', content: 'AI services are currently unavailable. An API key is required and was not found or was invalid in window.AURA_GEMINI_API_KEY.' }]);
    } else {
      // Chat instance created by AiService constructor if key is valid
      // No need to instantiate genAI and chatInstance here, aiService handles it
    }

    // NEW: Initialize SpeechRecognition
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      this.speechRecognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      this.speechRecognition.continuous = false; // Only get one result per speech segment
      this.speechRecognition.interimResults = false;
      this.speechRecognition.lang = 'en-US';

      this.speechRecognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        this.userMessage.set(transcript);
        this.sendMessage(); // Send the transcribed message
        this.stopVoiceInput(); // Stop listening after result
      };

      this.speechRecognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
          // Do nothing, just means no speech was detected.
        } else {
          this.messages.update(msgs => [...msgs, { role: 'model', content: `Voice input error: ${event.error}. Please try again.` }]);
        }
        this.stopVoiceInput();
      };

      this.speechRecognition.onend = () => {
        this.isVoiceInputActive.set(false);
      };
    } else {
      console.warn('Speech Recognition API not supported in this browser.');
    }

    // FIX: Imported effect from @angular/core
    // Effect to observe imageToAnalyzeUrl input and trigger analysis
    effect(() => {
      const imageUrl = this.imageToAnalyzeUrl();
      if (imageUrl && !this.isLoading()) {
        this.messages.update(msgs => [...msgs, { role: 'user', content: 'Please analyze this image.', imageUrl: imageUrl }]);
        this.analyzeImage(imageUrl, 'Describe this image in detail. Focus on elements relevant for an album cover or music video concept.');
      }
    });

    // FIX: Imported effect from @angular/core
    // Effect to observe mapLocationQuery input and trigger search
    effect(() => {
      const query = this.mapLocationQuery();
      if (query && !this.isLoading()) {
        this.messages.update(msgs => [...msgs, { role: 'user', content: `Find on map: ${query}` }]);
        this.sendGoogleMapsQuery(query);
      }
    });
  }

  async sendMessage(): Promise<void> {
    // FIX: Access isAiAvailable and chatInstance as properties, not methods
    if (!this.aiService.isAiAvailable || !this.aiService.chatInstance) return; // Use aiService's chatInstance
    const message = this.userMessage().trim();
    if (!message) return;

    this.messages.update(msgs => [...msgs, { role: 'user', content: message }]);
    this.userMessage.set(''); // Clear input
    this.isLoading.set(true);
    this.stopSpeaking(); // Stop any ongoing speech before processing new message

    if (this.isDeepQueryActive()) {
      await this.sendDeepQuery(message);
      this.isDeepQueryActive.set(false); // Reset deep query mode after one message
    } else if (message.toLowerCase().startsWith('search google for') || message.toLowerCase().startsWith('google for')) {
      const query = message.toLowerCase().startsWith('google for')
        ? message.substring('google for'.length).trim()
        : message.substring('search google for'.length).trim();
      await this.sendGoogleSearchQuery(query);
    } else if (message.toLowerCase().startsWith('find on map') || message.toLowerCase().startsWith('map for')) { // NEW: Handle Maps query
      const query = message.toLowerCase().startsWith('map for')
        ? message.substring('map for'.length).trim()
        : message.substring('find on map'.length).trim();
      await this.sendGoogleMapsQuery(query);
    } else if (message.toLowerCase().startsWith('view artist profile')) { // NEW: Handle VIEW_ARTIST_PROFILE
      const artistName = message.substring('view artist profile'.length).trim();
      if (artistName) {
        // Query Gemini to provide insight, then trigger app command
        const artist = MOCK_ARTISTS.find(a => a.name.toLowerCase() === artistName.toLowerCase());
        if (artist) {
          await this.getArtistInsight(artist); // Get AI insight
          this.appCommand.emit({ action: 'VIEW_ARTIST_PROFILE', parameters: { name: artistName } });
        } else {
          const errorContent = `S.M.U.V.E doesn't have data for "${artistName}". Please try searching for artists first.`;
          this.messages.update(msgs => [...msgs, { role: 'model', content: errorContent }]);
          this.speakResponse(errorContent);
        }
      } else {
        const errorContent = `Please specify an artist name to view their profile.`;
        this.messages.update(msgs => [...msgs, { role: 'model', content: errorContent }]);
        this.speakResponse(errorContent);
      }
    }
    else {
      try {
        // FIX: Use GenerateContentResponse type for the response from sendMessage
        // FIX: Access chatInstance as a property, not a method
        const response: GenerateContentResponse = await this.aiService.chatInstance.sendMessage({ message });
        const rawAiResponse = response.text;

        if (typeof rawAiResponse !== 'string' || rawAiResponse.trim() === '') {
          console.warn('Gemini API returned empty or non-string response:', rawAiResponse);
          const fallbackContent = 'S.M.U.V.E received an empty response. Please try rephrasing.';
          this.messages.update(msgs => [...msgs, { role: 'model', content: fallbackContent }]);
          this.speakResponse(fallbackContent);
          this.isLoading.set(false);
          this.scrollToBottom();
          return;
        }

        const trimmedResponse = rawAiResponse.trim();
        const parts = trimmedResponse.split(':::');

        if (parts.length >= 2 && parts[0] === 'CHAT') {
            const chatContent = parts.slice(1).join(':::');
            this.messages.update(msgs => [...msgs, { role: 'model', content: chatContent }]);
            this.speakResponse(chatContent);
        } else if (parts.length >= 2 && parts[0] === 'COMMAND') { // Can be 2 or 3 parts now
            const action = parts[1].trim();
            const paramsString = (parts[2] || '').trim();
            try {
                const parameters: { [key: string]: any } = {};
                if (paramsString) {
                  // FIX: Use a more robust regex for parsing key-value pairs
                  const regex = /(\w+)\s*=\s*'([^']*)'|(\w+)\s*=\s*(\d+)/g; // Match string in single quotes or pure numbers
                  let match;
                  while ((match = regex.exec(paramsString)) !== null) {
                      const key = match[1] || match[3]; // Key is in group 1 or 3
                      const value = match[2] !== undefined ? match[2] : match[4]; // Value is in group 2 (string) or 4 (number)
                      parameters[key] = value;
                  }
                }

                this.appCommand.emit({ action, parameters });
                const aiContent = `Executing command: ${action}`;
                this.messages.update(msgs => [...msgs, { role: 'model', content: aiContent }]);
                this.speakResponse(aiContent);
            } catch (parseError) {
                console.error("Failed to parse command parameters:", parseError, "from string:", paramsString);
                const errorContent = `S.M.U.V.E sent a command I couldn't understand. Please try again.`;
                this.messages.update(msgs => [...msgs, { role: 'model', content: errorContent }]);
                this.speakResponse(errorContent);
            }
        } else {
            // Fallback if the format is not recognized. This is important.
            console.warn('AI response did not match expected CHAT/COMMAND format:', trimmedResponse);
            this.messages.update(msgs => [...msgs, { role: 'model', content: trimmedResponse }]);
            this.speakResponse(trimmedResponse);
        }

      } catch (error) {
        console.error('Error sending message to Gemini API:', error);
        const errorContent = 'Oops! Something went wrong. Please try again.';
        this.messages.update(msgs => [...msgs, { role: 'model', content: errorContent }]);
        this.speakResponse(errorContent);
      }
    }
    this.isLoading.set(false);
    this.scrollToBottom();
  }

  // NEW: Method for Google Search Grounding
  private async sendGoogleSearchQuery(query: string): Promise<void> {
    // FIX: Access isAiAvailable and genAI as properties, not methods
    if (!this.aiService.isAiAvailable || !this.aiService.genAI) return; // Use aiService's genAI
    try {
      // FIX: The contents parameter should be a simple string for text-only input.
      // FIX: Use GenerateContentResponse type for the response
      // FIX: Access genAI as a property, not a method
      const response: GenerateContentResponse = await this.aiService.genAI.models.generateContent({
        model: 'gemini-2.5-flash', // UPDATED: Changed model to gemini-2.5-flash
        contents: query, // FIX: Pass the query string directly
        config: {
          tools: [{ googleSearch: {} }],
          // DO NOT set responseMimeType or responseSchema for googleSearch tool
          // Removed responseMimeType and responseSchema from here.
        },
      });
      const aiResponseText = response.text;

      // Extract grounding chunks for URLs
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const urls: { uri: string; title?: string }[] = [];
      if (groundingChunks) {
        for (const chunk of groundingChunks) {
          if (chunk.web && chunk.web.uri) {
            urls.push({ uri: chunk.web.uri, title: chunk.web.title });
          }
        }
      }

      const messageContent: ChatMessage = {
        role: 'model',
        content: aiResponseText,
        urls: urls.length > 0 ? urls : undefined,
      };
      this.messages.update(msgs => [...msgs, messageContent]);
      this.speakResponse(aiResponseText);
    } catch (error) {
      console.error('Error sending Google Search query to Gemini API:', error);
      const errorContent = 'Oops! Failed to perform Google Search. Please try again.';
      this.messages.update(msgs => [...msgs, { role: 'model', content: errorContent }]);
      this.speakResponse(errorContent);
    }
  }

  // NEW: Method for Google Maps Grounding
  private async sendGoogleMapsQuery(query: string): Promise<void> {
    // FIX: Access isAiAvailable and genAI as properties, not methods
    if (!this.aiService.isAiAvailable || !this.aiService.genAI) return;
    try {
      // FIX: Pass the query string directly
      // FIX: Use GenerateContentResponse type for the response
      // FIX: Access genAI as a property, not a method
      const response: GenerateContentResponse = await this.aiService.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: query, // FIX: Pass the query string directly
        config: {
          // The `googleMaps` tool is not a standard tool in @google/genai, this will likely fail
          // or be ignored. Sticking to `googleSearch` as per guidelines.
          // FIX: Changed `googleMaps` to `googleSearch` as it's the only supported tool.
          tools: [{ googleSearch: {} }],
        },
      });
      const aiResponseText = response.text;

      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const urls: { uri: string; title?: string }[] = [];
      if (groundingChunks) {
        for (const chunk of groundingChunks) {
          if (chunk.web && chunk.web.uri) {
            urls.push({ uri: chunk.web.uri, title: chunk.web.title });
          }
        }
      }

      const messageContent: ChatMessage = {
        role: 'model',
        content: aiResponseText,
        urls: urls.length > 0 ? urls : undefined,
      };
      this.messages.update(msgs => [...msgs, messageContent]);
      this.speakResponse(aiResponseText);
      this.mapLocationResult.emit(aiResponseText); // Emit result for modal
    } catch (error) {
      console.error('Error sending Google Maps query to Gemini API:', error);
      const errorContent = 'Oops! Failed to find location on map. Please try again.';
      this.messages.update(msgs => [...msgs, { role: 'model', content: errorContent }]);
      this.speakResponse(errorContent);
    }
  }

  // NEW: Method for Deep Query (gemini-3-pro-preview with thinking budget)
  async sendDeepQuery(message: string): Promise<void> {
    // FIX: Access isAiAvailable and genAI as properties, not methods
    if (!this.aiService.isAiAvailable || !this.aiService.genAI) return; // Use aiService's genAI
    try {
      // FIX: Use GenerateContentResponse type for the response
      // FIX: Access genAI as a property, not a method
      const response: GenerateContentResponse = await this.aiService.genAI.models.generateContent({
        model: "gemini-3-pro-preview", // UPDATED: Changed model to gemini-3-pro-preview
        contents: message, // FIX: Pass the message string directly
        config: {
          systemInstruction: this.aiService.chatInstance!.config!.systemInstruction, // Use S.M.U.V.E's enhanced system instruction
          topK: 64,
          topP: 0.95,
          temperature: 1,
          seed: 42,
          // For gemini-3-pro-preview, omit thinkingConfig if default thinking is desired.
          // Guidelines state: "For All Other Tasks: Omit thinkingConfig entirely (this defaults to enabling thinking for higher quality)."
          // Omitting thinkingConfig here for 3-pro-preview is preferred for "think more".
        },
      });
      const aiResponseText = response.text;

      this.messages.update(msgs => [...msgs, { role: 'model', content: `[DEEP QUERY RESPONSE]: ${aiResponseText}` }]);
      this.speakResponse(aiResponseText);
    } catch (error) {
      console.error('Error sending deep query to Gemini API:', error);
      const errorContent = 'Oops! Deep query failed. Please try again.';
      this.messages.update(msgs => [...msgs, { role: 'model', content: errorContent }]);
      this.speakResponse(errorContent);
    }
  }

  // NEW: Method for Image Understanding (gemini-3-pro-preview)
  async analyzeImage(base64ImageData: string, prompt: string = 'Describe this image in detail. Focus on elements relevant for an album cover or music video concept.'): Promise<void> {
    // FIX: Access isAiAvailable and genAI as properties, not methods
    if (!this.aiService.isAiAvailable || !this.aiService.genAI) {
      const errorContent = 'AI services are unavailable to analyze image. Please check API key.';
      this.messages.update(msgs => [...msgs, { role: 'model', content: errorContent }]);
      this.speakResponse(errorContent);
      return;
    }

    this.isLoading.set(true);
    try {
      const mimeType = base64ImageData.split(';')[0].split(':')[1];
      const data = base64ImageData.split(',')[1];

      const imagePart: Content = { // FIX: Explicitly type imagePart using Content
        inlineData: {
          mimeType: mimeType,
          data: data,
        },
      };
      const textPart: Content = { text: prompt }; // FIX: Explicitly type textPart using Content

      // FIX: Use GenerateContentResponse type for the response
      // FIX: Access genAI as a property, not a method
      const response: GenerateContentResponse = await this.aiService.genAI.models.generateContent({
        model: 'gemini-3-pro-preview', // UPDATED: Use gemini-3-pro-preview for image analysis
        contents: [imagePart, textPart], // FIX: contents should be an array of Content parts
      });

      const analysisResult = response.text;
      const messageContent: ChatMessage = {
        role: 'model',
        content: `IMAGE ANALYSIS: ${analysisResult}`,
        imageUrl: base64ImageData, // Include image URL in message for display
      };
      this.messages.update(msgs => [...msgs, messageContent]);
      this.speakResponse(`Image analysis complete. ${analysisResult}`);
      this.imageAnalysisResult.emit(analysisResult); // Emit result for modal
    } catch (error) {
      console.error('Error analyzing image with Gemini API:', error);
      const errorContent = 'Oops! Failed to analyze image. Please try again.';
      this.messages.update(msgs => [...msgs, { role: 'model', content: errorContent }]);
      this.speakResponse(errorContent);
    } finally {
      this.isLoading.set(false);
      this.scrollToBottom();
    }
  }

  // NEW: Get AI insight for an artist profile
  async getArtistInsight(artist: ArtistProfile): Promise<void> {
    if (!this.aiService.isAiAvailable || !this.aiService.genAI) return;

    this.isLoading.set(true);
    try {
      const prompt = `You are S.M.U.V.E, an expert AI music manager toolkit specialized in Southern Rap, Hip-Hop, R&B, and Trap music, with advanced management and marketing skills. Provide an adaptive, detailed insight into the following independent music artist's profile. Your insights should be highly specific to their genre(s) and location, and offer actionable advice. Include:
      - Strengths (musicality, production, stage presence, lyrical ability etc.)
      - Specific collaboration potential (e.g., "collaborate with a Memphis trap producer for a new single," "feature on an Atlanta R&B singer's track").
      - Career advice (e.g., "focus on building a strong presence on TikTok," "consider licensing your beats for video games").
      - Marketing insights (e.g., "target college radio stations in the Southeast," "run Instagram ad campaigns geotargeted to your city").

Artist Profile:
Name: ${artist.name}
Genre(s): ${artist.genres.join(', ')}
Location: ${artist.location}
Bio: ${artist.bio}
Collaboration Interests: ${artist.collaborationInterest.join(', ')}
Influences: ${artist.influences.join(', ')}
Contact: ${artist.contact}
Links: ${artist.links.map(link => `${link.type}: ${link.url}`).join(', ')}
Specialties: ${artist.specialties ? artist.specialties.join(', ') : 'N/A'}
Target Audience: ${artist.targetAudience || 'N/A'}
Career Goals: ${artist.careerGoals || 'N/A'}

Provide insights relevant to their profile and the independent music scene, focusing on growth, networking, and strategic moves within their specified genres. Be specific to Southern Rap, Hip-Hop, R&B, and Trap where appropriate.`;

      const response: GenerateContentResponse = await this.aiService.genAI.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: {
          systemInstruction: this.aiService.chatInstance!.config!.systemInstruction, // Use S.M.U.V.E's enhanced system instruction
          topK: 64,
          topP: 0.95,
          temperature: 1,
          seed: 42,
        },
      });
      const insight = response.text;
      this.messages.update(msgs => [...msgs, { role: 'model', content: `[INSIGHT for ${artist.name}]: ${insight}` }]);
      this.speakResponse(`Here's an insight for ${artist.name}. ${insight}`);

    } catch (error) {
      console.error('Error getting artist insight:', error);
      const errorContent = `S.M.U.V.E failed to provide insight for ${artist.name}.`;
      this.messages.update(msgs => [...msgs, { role: 'model', content: errorContent }]);
      this.speakResponse(errorContent);
    } finally {
      this.isLoading.set(false);
      this.scrollToBottom();
    }
  }

  // --- Voice Input ---

  toggleVoiceInput(): void {
    if (!this.speechRecognition) {
      alert('Speech Recognition is not supported in this browser.');
      return;
    }
    if (this.isVoiceInputActive()) {
      this.stopVoiceInput();
    } else {
      this.startVoiceInput();
    }
  }

  startVoiceInput(): void {
    if (this.speechRecognition) {
      this.stopSpeaking(); // Stop any ongoing speech
      this.isVoiceInputActive.set(true);
      this.speechRecognition.start();
      this.messages.update(msgs => [...msgs, { role: 'model', content: 'Listening for voice input...' }]);
    }
  }

  stopVoiceInput(): void {
    if (this.speechRecognition) {
      this.speechRecognition.stop();
      this.isVoiceInputActive.set(false);
    }
  }

  // --- Speech Output ---

  speakResponse(text: string): void {
    if ('speechSynthesis' in window) {
      this.stopSpeaking(); // Stop any previous speech
      this.speechUtterance = new SpeechSynthesisUtterance(text);
      this.speechUtterance.onstart = () => this.isSpeaking.set(true);
      this.speechUtterance.onend = () => this.isSpeaking.set(false);
      this.speechUtterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        this.isSpeaking.set(false);
      };
      window.speechSynthesis.speak(this.speechUtterance);
    } else {
      console.warn('Speech Synthesis API not supported in this browser.');
    }
  }

  stopSpeaking(): void {
    if (this.speechUtterance) {
      window.speechSynthesis.cancel();
      this.isSpeaking.set(false);
    }
  }

  // --- UI Utilities ---

  scrollToBottom(): void {
    // FIX: Using requestAnimationFrame to ensure DOM is updated before scrolling
    requestAnimationFrame(() => {
      if (this.chatHistoryRef()) {
        const element = this.chatHistoryRef()!.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    });
  }

  toggleDeepQuery(): void {
    this.isDeepQueryActive.update(val => !val);
    if (this.isDeepQueryActive()) {
      this.messages.update(msgs => [...msgs, { role: 'model', content: 'Deep Query mode activated. I will use Gemini 3 Pro for more complex reasoning. Please ask your question.' }]);
      this.speakResponse('Deep Query mode activated. Please ask your question.');
    } else {
      this.messages.update(msgs => [...msgs, { role: 'model', content: 'Deep Query mode deactivated.' }]);
      this.speakResponse('Deep Query mode deactivated.');
    }
  }

  onClose(): void {
    this.stopVoiceInput();
    this.stopSpeaking();
    this.close.emit();
  }
}