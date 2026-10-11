'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { modKeys } from '@/entities/moderation';
import { rpc } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { toast } from '@/shared/ui';

export function BannedWordsEditor({ words }: { words: string[] }) {
  const [word, setWord] = useState('');
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: modKeys.overview });

  const add = useMutation({
    mutationFn: (w: string) => rpc<string>('add_banned_word', { p_word: w }),
    onSuccess: (saved) => {
      setWord('');
      toast(`Добавлено: ${saved}`);
    },
    onError: (e) => toast(errorMessage(e)),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: (w: string) => rpc('remove_banned_word', { p_word: w }),
    onError: (e) => toast(errorMessage(e)),
    onSettled: refresh,
  });

  return (
    <section className="card">
      <h2>Запретные слова · {words.length}</h2>
      <p className="muted small">
        Желание с таким словом не получится отправить. Слово ищется внутри других слов («мудак» поймает «мудаки»),
        латинские буквы-двойники, повторы и пробелы между буквами учитываются. Значок <b>^</b> в начале — искать только
        в начале слова: «^бля» не тронет «рубля».
      </p>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate(word);
        }}
      >
        <input
          className="input"
          maxLength={41}
          placeholder="Новое слово или корень, например «x7» или «^дура»"
          value={word}
          onChange={(e) => setWord(e.target.value)}
        />
        <button className="btn" type="submit" disabled={add.isPending || word.trim().length < 2}>
          Добавить
        </button>
      </form>
      <div className="word-list">
        {words.map((w) => (
          <span key={w} className="word-chip">
            {w}
            <button type="button" aria-label={`Убрать «${w}»`} onClick={() => remove.mutate(w)}>
              ×
            </button>
          </span>
        ))}
      </div>
    </section>
  );
}
