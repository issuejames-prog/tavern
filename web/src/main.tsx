import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiRequestError } from './api';
import { App } from './App';
import { applyTheme, useUiStore } from './stores/ui-store';
import './styles/global.css';

applyTheme(useUiStore.getState().theme);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // Validation and not-found errors won't fix themselves by retrying.
      retry: (count, err) => !(err instanceof ApiRequestError) && count < 2,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
