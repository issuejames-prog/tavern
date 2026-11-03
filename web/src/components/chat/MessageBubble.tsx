import { useState } from 'react';
import type { MessageRecord } from '@tavern/shared';
import { t } from '../../i18n/zh-TW';
import { renderRoleplay } from '../../lib/format';
import { Avatar } from '../common/Avatar';

interface Props {
  role: MessageRecord['role'];
  content: string;
  characterName: string;
  avatarColor: string;
  status?: MessageRecord['status'];
  streaming?: boolean;
}

export function MessageBubble({ role, content, characterName, avatarColor, status = 'complete', streaming }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked; nothing else to do
    }
  };

  if (role === 'user') {
    return (
      <div className="rise group flex justify-end">
        <div className="max-w-[min(70ch,85%)]">
          <div className="prose-chat rounded-lg rounded-br-sm border border-line bg-surface-2 px-4 py-3 text-ink">
            {renderRoleplay(content)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rise group flex gap-4">
      <Avatar name={characterName} color={avatarColor} size={36} />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2 text-sm">
          <span className="font-medium">{characterName}</span>
          {status === 'aborted' && <span className="text-xs text-muted">{t.chat.aborted}</span>}
          {!streaming && (
            <button
              type="button"
              onClick={copy}
              className="ml-auto rounded px-2 py-1 text-xs text-muted opacity-0 transition-opacity hover:text-ink focus:opacity-100 group-hover:opacity-100"
            >
              {copied ? t.common.copied : t.common.copy}
            </button>
          )}
        </div>
        <div className={`prose-chat text-ink ${streaming ? 'caret' : ''}`}>{renderRoleplay(content)}</div>
      </div>
    </div>
  );
}
