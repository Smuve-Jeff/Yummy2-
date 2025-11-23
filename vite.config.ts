import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
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
    }
  };
});
