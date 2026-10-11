'use client';

import { useEffect, useState } from 'react';
import { rpc } from '@/shared/api';
import { asset, env } from '@/shared/config';
import { errorMessage } from '@/shared/lib';
import { toast } from '@/shared/ui';

type Status = 'unsupported' | 'ios-hint' | 'off' | 'on' | 'denied';

function b64ToUint8(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const saveSubscription = (sub: PushSubscription) => {
  const json = sub.toJSON();
  return rpc('save_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
  });
};

export function NotifyButton() {
  const [status, setStatus] = useState<Status>('unsupported');
  const [busy, setBusy] = useState(false);
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !env.vapidPublicKey) return;
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone =
      matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;

    navigator.serviceWorker
      .register(asset('/sw.js'), { scope: asset('/') })
      .then(async (r) => {
        setReg(r);
        if (!('PushManager' in window) || !('Notification' in window)) {
          if (isIOS && !standalone) setStatus('ios-hint');
          return;
        }
        if (Notification.permission === 'denied') return setStatus('denied');
        const sub = await r.pushManager.getSubscription();
        const on = !!sub && Notification.permission === 'granted';
        setStatus(on ? 'on' : 'off');
        // Повторно сообщаем базе о подписке — на случай, если её удалили.
        if (on) saveSubscription(sub).catch(() => {});
      })
      .catch(() => {});
  }, []);

  async function toggle() {
    if (!reg) return;
    setBusy(true);
    try {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await rpc('remove_push_subscription', { p_endpoint: sub.endpoint });
        await sub.unsubscribe();
        setStatus('off');
        toast('Напоминания выключены');
      } else {
        const perm = await Notification.requestPermission();
        if (perm === 'denied') setStatus('denied');
        if (perm !== 'granted') throw new Error('Без разрешения уведомления не придут');
        const s = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: b64ToUint8(env.vapidPublicKey),
        });
        await saveSubscription(s);
        setStatus('on');
        toast('Готово! Напомним, когда пора голосовать 🔔');
      }
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (status === 'unsupported') return null;
  if (status === 'ios-hint') {
    return (
      <p className="hint">
        🔔 Чтобы получать напоминания на iPhone: нажми «Поделиться» → «На экран „Домой“» и открой сайт с иконки.
      </p>
    );
  }
  return (
    <button
      type="button"
      className={`btn btn-light${status === 'on' ? ' on' : ''}`}
      disabled={busy || status === 'denied'}
      onClick={toggle}
    >
      {status === 'on' && '🔕 Выключить напоминания'}
      {status === 'off' && '🔔 Включить напоминания'}
      {status === 'denied' && 'Уведомления запрещены в настройках браузера'}
    </button>
  );
}
