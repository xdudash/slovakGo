import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

/** Replaces %%VITE_FIREBASE_*%% placeholders in the built firebase-messaging-sw.js */
function injectFcmConfig() {
  return {
    name: 'inject-fcm-config',
    closeBundle() {
      const swPath = resolve(process.cwd(), 'dist/firebase-messaging-sw.js');
      if (!existsSync(swPath)) return;
      const keys = [
        'VITE_FIREBASE_API_KEY',
        'VITE_FIREBASE_AUTH_DOMAIN',
        'VITE_FIREBASE_PROJECT_ID',
        'VITE_FIREBASE_STORAGE_BUCKET',
        'VITE_FIREBASE_MESSAGING_SENDER_ID',
        'VITE_FIREBASE_APP_ID',
      ] as const;
      let content = readFileSync(swPath, 'utf-8');
      for (const key of keys) {
        content = content.replaceAll(`%%${key}%%`, process.env[key] ?? '');
      }
      writeFileSync(swPath, content);
    },
  };
}

export default defineConfig({
  plugins: [react(), injectFcmConfig()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
