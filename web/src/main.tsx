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
      // Auth and not-found errors won't fix themselves by retrying.
      retry: (count, err) => !(err instanceof ApiRequestError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

// A 401 anywhere (e.g. expired session) sends the user back to the login page.
queryClient.getQueryCache().subscribe((event) => {
  const err = event.query.state.error;
  if (err instanceof ApiRequestError && err.status === 401 && event.query.queryKey[0] !== 'me') {
    queryClient.setQueryData(['me'], { authenticated: false });
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
