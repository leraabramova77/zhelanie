'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { modKeys } from '@/entities/moderation';
import { rpc } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { toast } from '@/shared/ui';

// Код школы нужен для регистрации — так на сайт попадают только ученики. Меняет только президент.
export function SchoolCodeForm({ current }: { current: string }) {
  const [code, setCode] = useState(current);
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: () => rpc<string>('set_school_code', { p_code: code }),
    onSuccess: (saved) => {
      setCode(saved);
      toast(saved ? 'Код школы сохранён' : 'Регистрация открыта без кода');
    },
    onError: (e) => toast(errorMessage(e)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: modKeys.overview }),
  });

  return (
    <section className="card">
      <h2>Код школы</h2>
      <p className="muted small">
        Без этого кода нельзя зарегистрироваться. Раздай его в чатах классов. Если код утёк к чужим — поменяй: уже
        зарегистрированные ученики продолжат входить как обычно.
      </p>
      <p className="school-code">{current || 'не задан — регистрация открыта всем'}</p>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <input
          className="input"
          maxLength={30}
          placeholder="Новый код, например shkola5"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button className="btn" type="submit" disabled={save.isPending}>
          Сохранить
        </button>
      </form>
    </section>
  );
}
