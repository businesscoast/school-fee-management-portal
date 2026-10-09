export interface BarItem {
  key: string;
  label: string; // axis label
  value: number;
  display: string; // short value label on the bar
  detail?: string; // tooltip text
  ghost?: boolean; // outline-only (comparison series)
}

interface Props {
  items: BarItem[];
  height?: number;
  highlight?: 'max' | 'none' | string;
  ariaLabel: string;
  minBar?: number;
}

/**
 * Column chart in the mosaic style: quiet bars with the value label inside,
 * one highlighted bar in the gold-to-green gradient. Labels that do not fit
 * sit above the bar instead.
 */
export function BarChart({ items, height = 240, highlight = 'max', ariaLabel, minBar = 6 }: Props) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const hiKey = highlight === 'max' ? items.reduce((best, i) => (i.value > best.value ? i : best), items[0] ?? { key: '', value: -1 }).key : highlight;
  const labelBand = 26;
  const dense = items.length > 8;
  return (
    <div className="chart-wrap">
      <div className="chart" style={{ height }} role="img" aria-label={ariaLabel}>
        {items.map((item) => {
          const h = item.value <= 0 ? minBar : Math.max(minBar, Math.round(((height - labelBand) * item.value) / max));
          const isHi = item.key === hiKey && highlight !== 'none' && item.value > 0;
          const showLabel = item.value > 0 && (!dense || isHi);
          const inside = !dense && h >= 30;
          return (
            <div key={item.key} className="col" tabIndex={0} aria-label={item.detail ?? `${item.label}: ${item.display}`}>
              {item.detail ? <span className="tip">{item.detail}</span> : null}
              {showLabel && !inside ? <span className={`above ${isHi ? 'hi' : ''}`.trim()}>{item.display}</span> : null}
              <div className={`bar ${isHi ? 'hi' : ''} ${item.ghost ? 'ghost' : ''}`.trim()} style={{ height: h }}>
                {showLabel && inside ? item.display : ''}
              </div>
              <span className="day">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
