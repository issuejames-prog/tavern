import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The page keeps an API key in localStorage, so lock it down:
// scripts only from our own origin, network only to ourselves and OpenRouter.
// (GitHub Pages can't send headers, hence a <meta> tag; the dev server is left
// alone because Vite injects inline scripts there.)
function contentSecurityPolicy(): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    // blob: = avatar images held in IndexedDB; data: = small inline icons
    "img-src 'self' data: blob:",
    "connect-src 'self' https://openrouter.ai",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' },
      { tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' }, injectTo: 'head-prepend' },
    ],
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  server: { port: 5173 },
});
