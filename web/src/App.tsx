import type { ReactNode } from 'react';
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { IS_BROWSER } from './api';
import { useMe } from './api/queries';
import { AppShell } from './components/layout/AppShell';
import { ErrorNote, Spinner } from './components/common/ui';
import { CharacterEditPage } from './pages/CharacterEditPage';
import { CharactersPage } from './pages/CharactersPage';
import { ChatPage } from './pages/ChatPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { SettingsPage } from './pages/SettingsPage';
import { WorldsPage } from './pages/WorldsPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const me = useMe();
  if (me.isPending) return <div className="px-10"><Spinner /></div>;
  if (me.error) {
    return (
      <div className="mx-auto max-w-md px-6 py-20">
        <ErrorNote message={me.error.message} onRetry={() => void me.refetch()} />
      </div>
    );
  }
  return me.data.authenticated ? children : <Navigate to="/login" replace />;
}

// GitHub Pages can't rewrite unknown paths to index.html, so browser mode uses hash URLs.
const Router = IS_BROWSER ? HashRouter : BrowserRouter;

export function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="chat/:chatId" element={<ChatPage />} />
          <Route path="characters" element={<CharactersPage />} />
          <Route path="characters/:id" element={<CharacterEditPage />} />
          <Route path="worlds" element={<WorldsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}
