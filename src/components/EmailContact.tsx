import { useRef, useState } from 'react';
import { EXTERNAL_LINKS } from '../config';
import { useI18n } from '../i18n';

export function EmailContact() {
  const {t} = useI18n();
  const email = EXTERNAL_LINKS.SUPPORT_EMAIL.replace(/^mailto:/, '');
  const field = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState('');
  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(email);
      else {
        field.current?.focus(); field.current?.select();
        if (!document.execCommand('copy')) throw Error('Copy unavailable');
      }
      setStatus(t('emailCopied'));
    } catch {
      field.current?.focus(); field.current?.select();
      setStatus(t('emailCopyFailed'));
    }
  };
  return <section className="email-contact">
    <input ref={field} aria-label="Tune Tots Lab email" value={email} readOnly onFocus={event => event.currentTarget.select()} />
    <div className="email-actions">
      <button className="secondary-button" onClick={() => void copy()}>{t('copyEmail')}</button>
      <a href={EXTERNAL_LINKS.SUPPORT_EMAIL}>{t('emailUs')}</a>
      <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`} target="_blank" rel="noopener noreferrer">Gmail ↗</a>
    </div>
    {status && <p role="status">{status}</p>}
  </section>;
}
