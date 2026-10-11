'use client';

import { useEffect, useState } from 'react';
import { changePassword, register, signIn } from '@/entities/session';
import { errorMessage } from '@/shared/lib';
import { toast } from '@/shared/ui';
import { type AuthMode, useAuthDialog } from '../model/store';

const TITLES: Record<AuthMode, string> = {
  login: 'Вход',
  register: 'Регистрация',
  password: 'Новый пароль',
};

export function AuthDialog() {
  const { mode, open, close } = useAuthDialog();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', login: '', password: '', code: '' });

  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, close]);

  if (!mode) return null;

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'login') {
        await signIn(form.login, form.password);
        toast('С возвращением! 👋');
      } else if (mode === 'register') {
        const role = await register(form);
        toast(role === 'president' ? 'Аккаунт создан. Ты — президент 👑' : 'Аккаунт создан! Добро пожаловать 🎉');
      } else {
        await changePassword(form.password);
        toast('Пароль изменён');
      }
      setForm({ name: '', login: '', password: '', code: '' });
      close();
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop">
      <button type="button" className="dialog-dismiss" aria-label="Закрыть окно" tabIndex={-1} onClick={close} />
      <div className="dialog card" role="dialog" aria-modal="true" aria-label={TITLES[mode]}>
        <button type="button" className="dialog-close" aria-label="Закрыть" onClick={close}>
          ×
        </button>

        {mode !== 'password' && (
          <div className="tabs dialog-tabs" role="tablist">
            {(['login', 'register'] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => open(m)}>
                {TITLES[m]}
              </button>
            ))}
          </div>
        )}
        {mode === 'password' && <h2>{TITLES.password}</h2>}

        <form className="stack" onSubmit={submit}>
          {mode === 'register' && (
            <label className="field">
              <span>Имя</span>
              <input
                className="input"
                autoComplete="name"
                maxLength={40}
                placeholder="Например: Маша Иванова, 7Б"
                value={form.name}
                onChange={set('name')}
                required
              />
              <small className="muted">Видно только тебе и модераторам. Желания публикуются анонимно.</small>
            </label>
          )}

          {mode !== 'password' && (
            <label className="field">
              <span>Логин</span>
              <input
                className="input"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={20}
                placeholder="masha_7b"
                value={form.login}
                onChange={set('login')}
                required
              />
              {mode === 'register' && (
                <small className="muted">Латинские буквы, цифры, точка, дефис или _. От 3 до 20 символов.</small>
              )}
            </label>
          )}

          <label className="field">
            <span>{mode === 'password' ? 'Новый пароль' : 'Пароль'}</span>
            <input
              className="input"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'login' ? undefined : 6}
              value={form.password}
              onChange={set('password')}
              required
            />
            {mode !== 'login' && (
              <small className="muted">Минимум 6 символов. Запиши его — почты для восстановления нет.</small>
            )}
          </label>

          {mode === 'register' && (
            <label className="field">
              <span>Код школы</span>
              <input
                className="input"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Спроси у школьного совета"
                value={form.code}
                onChange={set('code')}
              />
            </label>
          )}

          <button className="btn" type="submit" disabled={busy}>
            {mode === 'login' ? 'Войти' : mode === 'register' ? 'Зарегистрироваться' : 'Сохранить'}
          </button>

          {mode === 'login' && (
            <p className="muted small center">Забыл пароль? Попроси модератора — он выдаст временный.</p>
          )}
        </form>
      </div>
    </div>
  );
}
