import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function Dialog({ title, subtitle, children, onClose, busy = false, wide = false, className = '' }: {
  title: string; subtitle?: string; children: ReactNode; onClose: () => void; busy?: boolean; wide?: boolean; className?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const busyRef = useRef(busy); busyRef.current = busy;
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const getElements = () => [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') ?? [])];
    (ref.current?.querySelector<HTMLElement>('[data-autofocus]') || getElements()[0] || ref.current)?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) { event.preventDefault(); closeRef.current(); }
      if (event.key === 'Tab') {
        const elements = getElements();
        const first = elements[0]; const last = elements.at(-1);
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || !ref.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, []);
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div className={`dialog ${wide ? 'dialog-wide' : ''} ${className}`} ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <div className="dialog-heading"><div><h2 id={id}>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>
          <button className="icon-button" aria-label="关闭弹窗" onClick={onClose} disabled={busy}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>, document.body,
  );
}
