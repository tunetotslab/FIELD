import { useState } from 'react';
import { Shell } from './Shell';
import { useI18n } from '../i18n';
import { API_URL } from '../config';
import { Miley } from './Brand';
import type { Screen } from '../types';

export const DONATION_AMOUNTS = [5, 10, 25, 50, 75, 100, 1000, 10000, 1000000];
export function Donate({ go, random = false }: { go: (screen: Screen) => void; random?: boolean }) {
  const { t, locale } = useI18n();
  const [amount, setAmount] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const format = (value: number) => new Intl.NumberFormat(locale).format(value);
  async function pay() {
    const app = window.Telegram?.WebApp;
    if (!amount || !API_URL || !app?.initData || !app.openInvoice) return;
    setBusy(true); setNotice('');
    try {
      const response = await fetch(`${API_URL}/donations`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `tma ${app.initData}` }, body: JSON.stringify({ amount }), signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error();
      const { url } = await response.json();
      if (typeof url !== 'string' || !url.startsWith('https://t.me/$')) throw new Error();
      app.openInvoice(url, status => {
        setBusy(false);
        setNotice(t(status === 'paid' ? 'donateThanks' : status === 'cancelled' ? 'donateCancelled' : 'donatePending'));
      });
    } catch { setBusy(false); setNotice(t('donateError')); }
  }
  return <Shell title={t(random ? 'randomDonate' : 'donate')} back={() => go(random ? 'donate' : 'settings')}>
    <div className="donate-page">
      <Miley state="world" />
      <p>{t('donateIntro')}</p>
      {random ? <>
        <p>{t('randomRange')}</p>
        <output className="donate-amount" aria-live="polite">{amount ? `${format(amount)} ⭐` : '？'}</output>
        <button className="secondary-button" disabled={busy} onClick={() => { setAmount(5 + crypto.getRandomValues(new Uint32Array(1))[0] % 96); setNotice(''); }}>{t(amount ? 'rollAgain' : 'rollDonate')}</button>
      </> : <>
        <button className="secondary-button" onClick={() => go('randomDonate')}>{t('randomDonate')} 🎲</button>
        <div className="donate-grid">{DONATION_AMOUNTS.map(value => <button key={value} disabled={busy} aria-pressed={amount === value} onClick={() => { setAmount(value); setNotice(''); }}>{format(value)} ⭐</button>)}</div>
      </>}
      <p className="donate-note">{t('donateConfirm')}</p>
      {!API_URL ? <p role="status">{t('donateUnavailable')}</p> : !window.Telegram?.WebApp?.initData ? <p role="status">{t('donateTelegram')}</p> : null}
      <button className="primary-button" disabled={!amount || busy || !API_URL || !window.Telegram?.WebApp?.initData} onClick={() => void pay()}>{busy ? '…' : `${t('donate')} ${amount ? `${format(amount)} ⭐` : ''}`}</button>
      {notice && <p role="status">{notice}</p>}
    </div>
  </Shell>;
}
