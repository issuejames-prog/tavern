import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { isPersistent } from '../../api/browser-db';
import { useChats } from '../../api/queries';
import { t } from '../../i18n/zh-TW';
import { plainPreview } from '../../lib/format';
import { useUiStore, type ThemeChoice } from '../../stores/ui-store';
import { Avatar } from '../common/Avatar';
import { IconButton, MugIcon } from '../common/ui';

const navItems = [
  { to: '/', label: t.nav.home, icon: 'M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z', end: true },
  { to: '/characters', label: t.nav.characters, icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c1.5-4 4.5-6 8-6s6.5 2 8 6' },
  { to: '/worlds', label: t.nav.worlds, icon: 'M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4zM5 16a4 4 0 0 1 4-4h10' },
  { to: '/settings', label: t.nav.settings, icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12h2m12 0h2M12 4v2m0 12v2M6.3 6.3l1.4 1.4m8.6 8.6 1.4 1.4m0-11.4-1.4 1.4m-8.6 8.6-1.4 1.4' },
];

function NavIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-[18px]" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const themeOrder: ThemeChoice[] = ['system', 'light', 'dark'];
const themeIcon: Record<ThemeChoice, string> = {
  system: 'M4 5h16v11H4zM9 20h6M12 16v4',
  light: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  dark: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
};

function Sidebar() {
  const { data: chats } = useChats();
  const { theme, setTheme } = useUiStore();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] transition-colors ${
      isActive ? 'bg-accent-soft text-ink font-medium' : 'text-muted hover:bg-surface-2 hover:text-ink'
    }`;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pb-6 pt-7">
        <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-ink">
          <MugIcon className="size-7" />
        </span>
        <div className="leading-tight">
          <p className="font-serif text-xl font-semibold tracking-wide">{t.brand.name}</p>
          <p className="text-xs text-muted">{t.brand.tagline}</p>
        </div>
      </div>

      <nav className="space-y-0.5 px-3">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
            <NavIcon d={item.icon} />
            <span className="flex-1">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <p className="mt-8 px-6 pb-2 text-xs font-medium tracking-widest text-muted">{t.nav.chats}</p>
      <div className="scroll-soft min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {chats?.length === 0 && <p className="px-3 py-2 text-sm leading-relaxed text-muted">{t.nav.noChats}</p>}
        {chats?.map((chat) => (
          <NavLink
            key={chat.id}
            to={`/chat/${chat.id}`}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${isActive ? 'bg-surface-2' : 'hover:bg-surface-2/70'}`
            }
          >
            <Avatar name={chat.character_name} color={chat.avatar_color} src={chat.avatar_url} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{chat.character_name}</span>
              <span className="block truncate text-xs text-muted">{plainPreview(chat.last_message, 28)}</span>
            </span>
          </NavLink>
        ))}
      </div>

      <div className="flex items-center gap-1 border-t border-line px-3 py-3">
        <IconButton
          label={`${t.theme.toggle}：${t.theme[theme]}`}
          onClick={() => setTheme(themeOrder[(themeOrder.indexOf(theme) + 1) % themeOrder.length]!)}
        >
          <NavIcon d={themeIcon[theme]} />
        </IconButton>
        <span className="flex-1 text-xs text-muted">{t.theme[theme]}</span>
      </div>
    </div>
  );
}

export function AppShell() {
  const { sidebarOpen, setSidebarOpen } = useUiStore();
  const location = useLocation();
  useEffect(() => setSidebarOpen(false), [location.pathname, setSidebarOpen]);
  const [canPersist, setCanPersist] = useState(true);
  useEffect(() => {
    void isPersistent().then(setCanPersist);
  }, []);

  return (
    <div className="flex h-full">
      {/* Desktop: fixed sidebar. Narrow screens: slide-over drawer. */}
      <aside className="hidden w-72 shrink-0 border-r border-line bg-bg-soft md:block">
        <Sidebar />
      </aside>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" aria-label={t.nav.closeMenu} className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <aside className="rise absolute inset-y-0 left-0 w-72 border-r border-line bg-bg-soft">
            <Sidebar />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-line bg-bg-soft px-2 py-1 md:hidden">
          <IconButton label={t.nav.openMenu} onClick={() => setSidebarOpen(true)}>
            <NavIcon d="M4 7h16M4 12h16M4 17h16" />
          </IconButton>
          <span className="font-serif text-lg font-semibold">{t.brand.name}</span>
        </header>
        {!canPersist && (
          <p className="border-b border-line bg-danger-soft px-4 py-2 text-center text-xs text-danger" role="alert">
            {t.browser.storageWarning}
          </p>
        )}
        <main className="lamp-glow min-h-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
