'use client';

import { useEffect, useState } from 'react';

// Текущее время, обновляемое с заданным шагом. До монтирования — null, чтобы не было расхождений при гидрации.
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
