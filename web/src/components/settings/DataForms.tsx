import { useEffect, useState } from 'react';
import type { AppSettings } from '@tavern/shared';
import { api, downloadFile } from '../../api';
import { useImportBackup, useUpdateSettings } from '../../api/queries';
import { t } from '../../i18n/zh-TW';
import { FileButton, Notice } from '../common/files';
import { Button, ConfirmDialog, ErrorNote, Field } from '../common/ui';
import { SaveRow } from './ModelForms';

export function ProfileSettings({ settings }: { settings: AppSettings }) {
  const update = useUpdateSettings();
  const [name, setName] = useState(settings.user_name);
  const [persona, setPersona] = useState(settings.user_persona);
  const [prompt, setPrompt] = useState(settings.system_prompt);
  useEffect(() => setName(settings.user_name), [settings.user_name]);
  useEffect(() => setPersona(settings.user_persona), [settings.user_persona]);
  useEffect(() => setPrompt(settings.system_prompt), [settings.system_prompt]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        update.mutate({ user_name: name, user_persona: persona, system_prompt: prompt });
      }}
      className="space-y-5"
    >
      <Field label={t.settings.userName} hint={t.settings.userNameHint} value={name} onChange={setName} />
      <Field label={t.settings.userPersona} hint={t.settings.userPersonaHint} value={persona} onChange={setPersona} multiline rows={3} />
      <Field label={t.settings.systemPrompt} hint={t.settings.systemPromptHint} value={prompt} onChange={setPrompt} multiline rows={5} />
      <SaveRow pending={update.isPending} saved={update.isSuccess} error={update.error} />
    </form>
  );
}

/** Global World Info activation settings (總體參數), shared by every world book. */
export function WorldSettingsForm({ settings }: { settings: AppSettings }) {
  const update = useUpdateSettings();
  const W = t.settings.world;
  const [f, setF] = useState(() => ({
    scan_depth: String(settings.world.scan_depth),
    context_percent: String(settings.world.context_percent),
    budget_cap: String(settings.world.budget_cap),
    recursive: settings.world.recursive,
    match_whole_words: settings.world.match_whole_words,
  }));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        update.mutate({
          world: {
            scan_depth: Number(f.scan_depth),
            context_percent: Number(f.context_percent),
            budget_cap: Number(f.budget_cap),
            recursive: f.recursive,
            match_whole_words: f.match_whole_words,
          },
        });
      }}
    >
      <p className="mb-5 text-sm text-muted">{W.lead}</p>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label={W.scanDepth} hint={W.scanDepthHint} value={f.scan_depth} onChange={(v) => setF((s) => ({ ...s, scan_depth: v }))} inputMode="numeric" />
        <Field label={W.contextPercent} hint={W.contextPercentHint} value={f.context_percent} onChange={(v) => setF((s) => ({ ...s, context_percent: v }))} inputMode="numeric" />
        <Field label={W.budgetCap} hint={W.budgetCapHint} value={f.budget_cap} onChange={(v) => setF((s) => ({ ...s, budget_cap: v }))} inputMode="numeric" />
      </div>
      <div className="mt-4 space-y-1">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" checked={f.recursive} onChange={(e) => setF((s) => ({ ...s, recursive: e.target.checked }))} className="size-5 accent-[var(--accent)]" />
          {W.recursive}
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" checked={f.match_whole_words} onChange={(e) => setF((s) => ({ ...s, match_whole_words: e.target.checked }))} className="size-5 accent-[var(--accent)]" />
          {W.matchWholeWords}
        </label>
      </div>
      <SaveRow pending={update.isPending} saved={update.isSuccess} error={update.error} />
    </form>
  );
}

export function BackupSection() {
  const restore = useImportBackup();
  const [file, setFile] = useState<File | null>(null);
  const [done, setDone] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const B = t.settings.backup;

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted">{B.body}</p>
      {done && <Notice message={B.done} onClose={() => setDone(false)} />}
      {(restore.error || exportError) && <ErrorNote message={restore.error?.message ?? exportError ?? ''} />}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="primary"
          onClick={async () => {
            setExportError(null);
            try {
              downloadFile(await api.exportBackup());
            } catch (err) {
              setExportError(err instanceof Error ? err.message : String(err));
            }
          }}
        >
          {B.export}
        </Button>
        <FileButton accept=".json,application/json" onFile={(f) => setFile(f)}>
          {B.import}
        </FileButton>
      </div>
      <ConfirmDialog
        open={file !== null}
        message={B.confirm}
        confirmLabel={B.confirmAction}
        busy={restore.isPending}
        onCancel={() => setFile(null)}
        onConfirm={() =>
          file &&
          restore.mutate(file, {
            onSuccess: () => setDone(true),
            onSettled: () => setFile(null),
          })
        }
      />
    </div>
  );
}
