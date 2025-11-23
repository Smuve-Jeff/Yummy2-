/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: '/smuve_4.5/',
    define: {
      'process.env': {
        API_KEY: JSON.stringify(env.API_KEY || '')
      }
    },
    // Make sure we can serve the app if someone runs 'vite' directly
    // This assumes index.html imports index.tsx
    server: {
      port: 4200
    },
    resolve: {
        alias: {
            // Add any necessary aliases here
        }
    },
    test: {
      environment: 'happy-dom',
      include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    },
  };
});
