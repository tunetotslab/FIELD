import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
export function Dialog({ title, close, children, sheet=false }: { title: string; close: () => void; children: ReactNode; sheet?:boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return createPortal(<dialog ref={ref} className={`field-dialog${sheet?' world-city-dialog':''}`} aria-label={title} onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <div className="dialog-content"><h2>{title}</h2>{children}</div>
  </dialog>, document.body);
}
