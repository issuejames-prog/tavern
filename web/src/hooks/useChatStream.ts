import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ChatDetail, MessageRecord } from '@tavern/shared';
import { api, ApiRequestError } from '../api';
import { keys } from '../api/queries';
import { t } from '../i18n/zh-TW';

export interface StreamError {
  code: string;
  message: string;
}

/** Drives one streamed turn and keeps the TanStack Query cache in sync. */
export function useChatStream(chatId: number) {
  const qc = useQueryClient();
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [error, setError] = useState<StreamError | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const appendMessage = useCallback(
    (msg: MessageRecord) => {
      qc.setQueryData<ChatDetail>(keys.chat(chatId), (old) =>
        old && !old.messages.some((m) => m.id === msg.id) ? { ...old, messages: [...old.messages, msg] } : old,
      );
    },
    [qc, chatId],
  );

  // Leaving the page cancels an in-flight generation; the server keeps the partial text.
  useEffect(() => () => controllerRef.current?.abort(), [chatId]);

  const send = useCallback(
    async (content: string): Promise<boolean> => {
      if (controllerRef.current) return false;
      const controller = new AbortController();
      controllerRef.current = controller;
      setError(null);
      setStreamingText('');
      let accepted = false;

      try {
        await api.generate(
          chatId,
          content,
          (event) => {
            switch (event.type) {
              case 'user_saved':
                accepted = true;
                appendMessage(event.message);
                break;
              case 'delta':
                setStreamingText((prev) => (prev ?? '') + event.text);
                break;
              case 'done':
                appendMessage(event.message);
                setStreamingText(null);
                break;
              case 'error':
                if (event.partial) appendMessage(event.partial);
                setError({ code: event.code, message: event.message });
                setStreamingText(null);
                break;
            }
          },
          controller.signal,
        );
      } catch (err) {
        setError({
          code: err instanceof ApiRequestError ? err.code : 'UNKNOWN',
          message: err instanceof Error ? err.message : t.errors.unknown,
        });
      } finally {
        controllerRef.current = null;
        setStreamingText(null);
        if (controller.signal.aborted) {
          // The server stores the partial reply on abort; give it a moment, then resync.
          setTimeout(() => void qc.invalidateQueries({ queryKey: keys.chat(chatId) }), 400);
        }
        void qc.invalidateQueries({ queryKey: keys.chats, exact: true });
      }
      return accepted;
    },
    [chatId, appendMessage, qc],
  );

  const stop = useCallback(() => controllerRef.current?.abort(), []);

  return { send, stop, streamingText, isStreaming: streamingText !== null, error, clearError: () => setError(null) };
}
