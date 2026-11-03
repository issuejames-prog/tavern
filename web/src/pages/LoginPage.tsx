import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { IS_DEMO } from '../api';
import { useLogin, useMe } from '../api/queries';
import { Button, ErrorNote, Field, MugIcon } from '../components/common/ui';
import { t } from '../i18n/zh-TW';

export function LoginPage() {
  const [password, setPassword] = useState('');
  const login = useLogin();
  const me = useMe();
  const navigate = useNavigate();

  if (me.data?.authenticated) return <Navigate to="/" replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate(password, { onSuccess: () => navigate('/', { replace: true }) });
  };

  return (
    <div className="lamp-glow flex min-h-full items-center justify-center px-4 py-12">
      <form onSubmit={submit} className="rise w-full max-w-sm rounded-lg border border-line bg-surface p-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent">
            <MugIcon className="size-9" />
          </span>
          <h1 className="font-serif text-2xl font-semibold tracking-wide">{t.login.title}</h1>
          <p className="mt-2 text-sm text-muted">{t.login.subtitle}</p>
        </div>

        <div className="space-y-5">
          <Field label={t.login.password} type="password" value={password} onChange={setPassword} autoFocus />
          {login.error && <ErrorNote message={login.error.message} />}
          <Button type="submit" variant="primary" className="w-full" disabled={login.isPending || !password}>
            {login.isPending ? t.login.submitting : t.login.submit}
          </Button>
        </div>

        {IS_DEMO && <p className="mt-6 rounded-lg bg-accent-soft px-4 py-3 text-xs leading-relaxed text-muted">{t.login.demoHint}</p>}
      </form>
    </div>
  );
}
