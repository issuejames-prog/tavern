import { EmptyState, PageHeader } from '../components/common/ui';
import { t } from '../i18n/zh-TW';

// Placeholder: world books are stage 2 on the roadmap.
export function WorldsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:px-10">
      <PageHeader title={t.worlds.title} />
      <EmptyState title={t.worlds.soon} />
    </div>
  );
}
