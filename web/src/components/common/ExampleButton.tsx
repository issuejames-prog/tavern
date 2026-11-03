import { useAddFantasyExample } from '../../api/queries';
import { t } from '../../i18n/zh-TW';
import { Button } from './ui';

/** Adds the bundled western-fantasy character + world book, so users can see the writing guide in practice. */
export function ExampleButton({ onDone, onError }: { onDone: (message: string) => void; onError: (message: string) => void }) {
  const add = useAddFantasyExample();
  return (
    <Button
      variant="quiet"
      title={t.examples.hint}
      disabled={add.isPending}
      onClick={() =>
        add.mutate(undefined, {
          onSuccess: ({ character, world }) => onDone(t.examples.added(character.name, world?.name ?? '')),
          onError: (err) => onError(err.message),
        })
      }
    >
      {add.isPending ? t.examples.adding : t.examples.add}
    </Button>
  );
}
