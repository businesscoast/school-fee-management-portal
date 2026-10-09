import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { IconSparkle } from './Icons';

interface ToastItem {
  id: number;
  title: string;
  sub?: string;
  time: string;
}

const ToastContext = createContext<(t: { title: string; sub?: string }) => void>(() => undefined);

function clock(): string {
  const d = new Date();
  const h = d.getHours();
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const push = useCallback((t: { title: string; sub?: string }) => {
    const id = ++seq.current;
    setItems((list) => [...list, { id, title: t.title, sub: t.sub, time: clock() }]);
    window.setTimeout(() => setItems((list) => list.filter((i) => i.id !== id)), 4200);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="toast">
            <span style={{ color: '#111' }}>
              <IconSparkle size={24} />
            </span>
            <div>
              <div className="t-title">{t.title}</div>
              {t.sub ? <div className="t-sub">{t.sub}</div> : null}
            </div>
            <span className="t-time">{t.time}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
