import { useRef, useState } from 'react';
import { EXTERNAL_LINKS } from '../config';
import { useI18n } from '../i18n';
import { telegram } from '../telegram';

export function EmailContact() {
  const {t} = useI18n();
  const email = EXTERNAL_LINKS.SUPPORT_EMAIL.replace(/^mailto:/, '');
  const field = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState('');
  const [compose, setCompose] = useState(false);
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`;
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
      <button onClick={() => void copy()}>{t('copyEmail')}</button>
      <button aria-expanded={compose} onClick={() => setCompose(value => !value)}>{t('emailUs')}</button>
      <a href={gmail} target="_blank" rel="noopener noreferrer" onClick={event => {event.preventDefault();telegram.openBrowser(gmail);}}>Gmail ↗</a>
    </div>
    {compose && <div className="email-composer">
      <p>{t('emailComposeChoice')}</p>
      <div className="email-actions">
        <a href={EXTERNAL_LINKS.SUPPORT_EMAIL} target="_blank" rel="noopener noreferrer" onClick={() => setStatus(t('emailCopyFailed'))}>{t('defaultMail')}</a>
        <a href={gmail} target="_blank" rel="noopener noreferrer" onClick={event => {event.preventDefault();telegram.openBrowser(gmail);}}>Gmail ↗</a>
      </div>
    </div>}
    {status && <p role="status">{status}</p>}
  </section>;
}
