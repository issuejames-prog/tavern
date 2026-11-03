import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useChat, useDeleteChat, useSettings } from '../api/queries';
import { ChatComposer } from '../components/chat/ChatComposer';
import { MessageBubble } from '../components/chat/MessageBubble';
import { Avatar } from '../components/common/Avatar';
import { Button, ConfirmDialog, ErrorNote, IconButton, Spinner } from '../components/common/ui';
import { useChatStream } from '../hooks/useChatStream';
import { t } from '../i18n/zh-TW';
import { useUiStore } from '../stores/ui-store';

export function ChatPage() {
  const chatId = Number(useParams().chatId);
  const chat = useChat(chatId);
  const settings = useSettings();
  const stream = useChatStream(chatId);
  const deleteChat = useDeleteChat();
  const navigate = useNavigate();
  const { readingSerif, setReadingSerif } = useUiStore();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  // Follow the stream only while the reader is already near the bottom.
  const onScroll = () => {
    const el = scrollRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [chat.data?.messages.length, stream.streamingText]);
  useEffect(() => {
    stickToBottom.current = true;
  }, [chatId]);

  if (chat.isPending) return <div className="px-10"><Spinner /></div>;
  if (chat.error || !chat.data) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <ErrorNote message={chat.error?.message ?? t.chat.notFound} />
        <Link to="/" className="mt-6 inline-block text-sm text-accent hover:underline">← {t.common.back}</Link>
      </div>
    );
  }

  const data = chat.data;
  const profile = settings.data?.profiles.find((p) => p.id === data.model_profile_id) ?? settings.data?.profiles[0];
  const lastTokens = [...data.messages].reverse().find((m) => m.prompt_tokens)?.prompt_tokens;

  return (
    <div className={`flex h-full flex-col ${readingSerif ? 'reading-serif' : ''}`}>
      <header className="flex items-center gap-3 border-b border-line bg-bg/80 px-4 py-3 backdrop-blur md:px-8">
        <Avatar name={data.character_name} color={data.avatar_color} size={40} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-serif text-lg font-semibold">{data.character_name}</h1>
          <p className="truncate text-xs text-muted">
            {profile ? `${t.chat.model}：${profile.model}` : data.title}
            {lastTokens ? ` · ${t.chat.tokens(lastTokens)}` : ''}
          </p>
        </div>
        <Button
          variant="quiet"
          className={`min-h-9 px-3 ${readingSerif ? 'text-accent' : ''}`}
          aria-pressed={readingSerif}
          onClick={() => setReadingSerif(!readingSerif)}
        >
          {t.chat.readingMode}
        </Button>
        <IconButton label={t.chat.deleteChat} onClick={() => setConfirmOpen(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="size-[18px]" aria-hidden>
            <path d="M5 7h14M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" />
          </svg>
        </IconButton>
      </header>

      <div ref={scrollRef} onScroll={onScroll} className="scroll-soft min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-8 px-5 py-10 md:px-8">
          {data.messages.length === 0 && <p className="text-center text-sm text-muted">{t.chat.emptyHint}</p>}
          {data.messages.map((m) => (
            <MessageBubble
              key={m.id}
              role={m.role}
              content={m.content}
              status={m.status}
              characterName={data.character_name}
              avatarColor={data.avatar_color}
            />
          ))}
          {stream.streamingText !== null && (
            <MessageBubble
              role="assistant"
              content={stream.streamingText}
              characterName={data.character_name}
              avatarColor={data.avatar_color}
              streaming
            />
          )}
          {stream.error && (
            <div>
              <p className="mb-2 text-sm font-medium text-danger">{t.chat.errorTitle}</p>
              <ErrorNote message={stream.error.message} />
              {['MISSING_API_KEY', 'PROVIDER_AUTH', 'PROVIDER_BAD_REQUEST'].includes(stream.error.code) && (
                <Link to="/settings" className="mt-3 inline-block text-sm text-accent hover:underline">
                  {t.nav.settings} →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pb-5 pt-2 md:px-8">
        <ChatComposer streaming={stream.isStreaming} onSend={stream.send} onStop={stream.stop} />
      </div>

      <ConfirmDialog
        open={confirmOpen}
        message={t.chat.deleteConfirm}
        busy={deleteChat.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() =>
          deleteChat.mutate(chatId, {
            onSuccess: () => {
              setConfirmOpen(false);
              navigate('/', { replace: true });
            },
          })
        }
      />
    </div>
  );
}
