import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // The browser only ever talks to our own backend; the LLM key stays server-side.
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
});
