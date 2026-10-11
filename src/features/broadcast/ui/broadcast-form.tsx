'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { getSupabase } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { toast } from '@/shared/ui';

async function broadcast(title: string, body: string) {
  const { data, error } = await getSupabase().functions.invoke<{ sent: number }>('push', {
    body: { kind: 'broadcast', title, body },
  });
  if (error) throw new Error('Не удалось отправить: функция push недоступна или нет прав');
  return data?.sent ?? 0;
}

// Рассылка уведомления всем подписчикам — только для президента (проверяет Edge Function).
export function BroadcastForm({ subscribers }: { subscribers: number }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const send = useMutation({
    mutationFn: () => broadcast(title, body),
    onSuccess: (sent) => {
      toast(`Отправлено: ${sent}`);
      setTitle('');
      setBody('');
    },
    onError: (e) => toast(errorMessage(e)),
  });

  return (
    <section className="card">
      <h2>Уведомление всем</h2>
      <p className="muted small">Подписаны на напоминания: {subscribers}</p>
      <form
        className="stack"
        style={{ marginTop: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate();
        }}
      >
        <input
          className="input"
          maxLength={80}
          placeholder="Заголовок"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="input"
          maxLength={200}
          placeholder="Текст"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button className="btn" type="submit" disabled={send.isPending}>
          Отправить всем
        </button>
      </form>
    </section>
  );
}
