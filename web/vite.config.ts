import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Browser mode keeps an API key in localStorage, so lock the page down:
// scripts only from our own origin, network only to ourselves and OpenRouter.
// (GitHub Pages can't send headers, hence a <meta> tag; dev mode is left alone
// because Vite's dev server injects inline scripts.)
function browserModeCsp(): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self' https://openrouter.ai",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  return {
    name: 'browser-mode-csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' },
      { tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' }, injectTo: 'head-prepend' },
    ],
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'browser' ? [browserModeCsp()] : [])],
  server: {
    port: 5173,
    // In server mode the browser only talks to our own backend; the key stays server-side.
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
}));
