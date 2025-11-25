// --- START: Critical API_KEY sanitization for @google/genai ---
// This block runs BEFORE any other module imports or Angular bootstrapping.
// Its purpose is to prepare a clean API key that will be used by the @google/genai library,
// bypassing problematic globalThis.process.env.API_KEY values (especially the literal string "undefined")
// that cause a JSON parsing error during static initialization.

// --- ULTIMATE AGGRESSIVE NEUTRALIZATION ATTEMPT AT GLOBAL LEVEL ---
// The goal is to ensure globalThis.process.env.API_KEY is either 'undefined' (primitive) or ''
// BEFORE any @google/genai module is loaded/evaluated, by forcefully controlling globalThis.process.env.

// 1. Ensure globalThis.process and globalThis.process.env exist and are mutable.
declare global {
  interface Window {
    AURA_GEMINI_API_KEY: string;
    // We declare window.process for robust access, but its env.API_KEY is now guaranteed to be sanitized.
    process: {
        env: {
            API_KEY?: string;
            [key: string]: any;
        };
        [key: string]: any;
    };
  }
}

// FIX: Use window.process consistently and ensure it's a mutable object
if (typeof window.process === 'undefined' || window.process === null) {
  (window as any).process = { env: {} };
  console.warn("index.tsx: Forcibly initialized window.process.");
} else if (typeof (window.process as any).env !== 'object' || (window.process as any).env === null || Object.isFrozen((window.process as any).env) || !Object.isExtensible((window.process as any).env)) {
  const oldEnv = (window.process as any).env;
  (window.process as any).env = {}; // Replace with a fresh, mutable object
  // Copy existing safe properties if any, but specifically avoid problematic API_KEY
  if (oldEnv && typeof oldEnv === 'object') {
    for (const key in oldEnv) {
      if (key !== 'API_KEY' && Object.prototype.hasOwnProperty.call(oldEnv, key)) {
        (window.process as any).env[key] = oldEnv[key];
      }
    }
  }
  console.warn("index.tsx: Replaced/initialized window.process.env object to ensure mutability and extensibility.");
}


// Now window.process.env is guaranteed to be a mutable object.
let originalApiKeyFromEnv = (window.process as any).env.API_KEY;

// 2. Sanitize the API_KEY value itself.
let finalSanitizedApiKey: string = '';
const currentApiKeyString = (typeof originalApiKeyFromEnv === 'string' ? originalApiKeyFromEnv : '').trim();

if (currentApiKeyString.toLowerCase() === 'undefined' || currentApiKeyString === '' || currentApiKeyString.length < 30) {
  finalSanitizedApiKey = '';
  console.warn(`index.tsx: Detected problematic API_KEY in window.process.env (original value: "${originalApiKeyFromEnv}"). Setting to empty string.`);
} else {
  finalSanitizedApiKey = currentApiKeyString;
  console.log(`index.tsx: Valid API_KEY detected from window.process.env (length: ${finalSanitizedApiKey.length}).`);
}

// 3. Forcefully apply the sanitized key to window.process.env.API_KEY
// This ensures that any static access to process.env.API_KEY by modules will get the sanitized value.
(window.process as any).env.API_KEY = finalSanitizedApiKey;
console.log(`index.tsx: window.process.env.API_KEY is now explicitly set to a sanitized value (length: ${((window.process as any).env.API_KEY as string).length}).`);


// Store the final rigorously sanitized key globally for consistent access by the Angular app.
// The AiService will exclusively use window.AURA_GEMINI_API_KEY.
window.AURA_GEMINI_API_KEY = finalSanitizedApiKey;

// Log the final state that the Angular app will use.
if (window.AURA_GEMINI_API_KEY === '') {
  console.warn("index.tsx: Final AURA_GEMINI_API_KEY for application use is empty. AI features will be disabled.");
} else {
  console.log(`index.tsx: AURA_GEMINI_API_KEY is available for application use (length: ${window.AURA_GEMINI_API_KEY.length}).`);
}

// --- END: Critical API_KEY sanitization for @google/genai ---

import { bootstrapApplication } from '@angular/platform-browser';
// FIX: Import InjectionToken for API_KEY_TOKEN
import { provideZonelessChangeDetection, InjectionToken } from '@angular/core';
import { AppComponent } from './src/components/video-editor/app.component'; // Corrected path
import { AiService } from './src/services/ai.service';

// NEW: Define and export the InjectionToken for the API Key
export const API_KEY_TOKEN = new InjectionToken<string>('GEMINI_API_KEY');

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    AiService,
    // NEW: Provide the API_KEY_TOKEN with the sanitized API key
    { provide: API_KEY_TOKEN, useValue: window.AURA_GEMINI_API_KEY },
  ],
}).catch(err => console.error(err));

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}

// AI Studio always uses an `index.tsx` file for all project types.