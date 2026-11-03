import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { CharacterEditPage } from './pages/CharacterEditPage';
import { CharactersPage } from './pages/CharactersPage';
import { ChatPage } from './pages/ChatPage';
import { HomePage } from './pages/HomePage';
import { SettingsPage } from './pages/SettingsPage';
import { WorldEditPage } from './pages/WorldEditPage';
import { WorldsPage } from './pages/WorldsPage';

// GitHub Pages can't rewrite unknown paths to index.html, so routes live in the URL hash.
export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="chat/:chatId" element={<ChatPage />} />
          <Route path="characters" element={<CharactersPage />} />
          <Route path="characters/:id" element={<CharacterEditPage />} />
          <Route path="worlds" element={<WorldsPage />} />
          <Route path="worlds/:id" element={<WorldEditPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
