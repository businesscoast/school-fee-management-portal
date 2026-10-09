import type { CSSProperties, ReactNode } from 'react';
import type { DisplayStatus } from '../../domain/types';

export type Tint = 'white' | 'pink' | 'cool' | 'lime' | 'peach' | 'lavender';

export function Card({ tint = 'white', className = '', children, style, id }: { tint?: Tint; className?: string; children: ReactNode; style?: CSSProperties; id?: string }) {
  return (
    <section id={id} className={`card ${tint === 'white' ? '' : `tint-${tint}`} ${className}`.trim()} style={style}>
      {children}
    </section>
  );
}

export function Tag({ children, tone = '' }: { children: ReactNode; tone?: '' | 'green' | 'pink' | 'lavender' | 'cool' }) {
  return <span className={`tag ${tone}`.trim()}>{children}</span>;
}

const STATUS_CLASS: Record<DisplayStatus, string> = {
  'Fully Paid': 'paid',
  'Partially Paid': 'partial',
  Unpaid: 'unpaid',
  Overdue: 'overdue',
};

export function statusClass(status: DisplayStatus): string {
  return STATUS_CLASS[status];
}

export function StatusBadge({ status }: { status: DisplayStatus }) {
  return <span className={`badge ${STATUS_CLASS[status]}`}>{status}</span>;
}

export function Stat({ label, value, hint, large }: { label: string; value: ReactNode; hint?: ReactNode; large?: boolean }) {
  return (
    <div className="stat">
      <span className="label">{label}</span>
      <span className={`value ${large ? 'lg' : ''}`.trim()}>{value}</span>
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, ariaLabel }: { options: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; ariaLabel: string }) {
  return (
    <div className="seg" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined ? <span className="n">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {body}
    </div>
  );
}

export function StackedStatus({ fullyPaid, partiallyPaid, unpaid, legend = 'count' }: { fullyPaid: number; partiallyPaid: number; unpaid: number; legend?: 'count' | 'pct' | 'none' }) {
  const total = fullyPaid + partiallyPaid + unpaid || 1;
  const pct = (n: number) => `${(n / total) * 100}%`;
  const show = (n: number) => (legend === 'pct' ? `${Math.round((n / total) * 100)}%` : n.toLocaleString('en-IN'));
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="stacked" role="img" aria-label={`${fullyPaid} fully paid, ${partiallyPaid} partially paid, ${unpaid} unpaid`}>
        <span style={{ width: pct(fullyPaid), background: '#6a9a44' }} />
        <span style={{ width: pct(partiallyPaid), background: '#e9a23b' }} />
        <span style={{ width: pct(unpaid), background: '#8f8bc4' }} />
      </div>
      {legend !== 'none' ? (
        <ul className="legend">
          <li>
            <i className="dot paid" /> Fully paid <b>{show(fullyPaid)}</b>
          </li>
          <li>
            <i className="dot partial" /> Partially paid <b>{show(partiallyPaid)}</b>
          </li>
          <li>
            <i className="dot unpaid" /> Unpaid <b>{show(unpaid)}</b>
          </li>
        </ul>
      ) : null}
    </div>
  );
}

/** Inline collection meter for table cells: a short track with the percentage beside it. */
export function MiniMeter({ ratio }: { ratio: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((Number.isFinite(ratio) ? ratio : 0) * 100)));
  return (
    <span className="mini-meter" role="img" aria-label={`${pct}% collected`}>
      <span className="track">
        <span style={{ width: `${pct}%` }} />
      </span>
      <span className="pct">{pct}%</span>
    </span>
  );
}

export interface HBarItem {
  key: string;
  label: string;
  value: number;
  display: string;
  detail?: string;
}

/** Horizontal bar list (label · track · value); the largest bar gets the highlight gradient. */
export function HBars({ items, onSelect, ariaLabel }: { items: HBarItem[]; onSelect?: (item: HBarItem) => void; ariaLabel: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const hiKey = items.reduce((best, i) => (i.value > best.value ? i : best), items[0] ?? { key: '', value: -1 }).key;
  return (
    <div className="hbars" aria-label={ariaLabel}>
      {items.map((it) => (
        <button key={it.key} type="button" className="hbar" onClick={onSelect ? () => onSelect(it) : undefined} title={it.detail} aria-label={it.detail ?? `${it.label}: ${it.display}`}>
          <span className="lbl">{it.label}</span>
          <span className="track">
            <span className={it.key === hiKey ? 'hi' : ''} style={{ width: `${Math.max(2, Math.round((it.value / max) * 100))}%` }} />
          </span>
          <span className="v">{it.display}</span>
        </button>
      ))}
    </div>
  );
}
