import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { classRows, sectionRows, type ClassRow } from '../../domain/metrics';
import { formatINR, formatINRCompact, formatPct } from '../../domain/money';
import { classSortKey } from '../../domain/status';
import { useStore } from '../../store/store';
import { BarChart } from '../components/BarChart';
import { Table, type Column } from '../components/Table';
import { Card, MiniMeter, Segmented, Tag } from '../components/ui';

export function Classes() {
  const store = useStore();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'section' | 'class'>('section');
  const bySection = useMemo(() => sectionRows(store.views), [store.views]);
  const byClass = useMemo(() => classRows(store.views), [store.views]);
  const rows = mode === 'section' ? bySection : byClass;
  const totals = rows.reduce(
    (t, r) => ({ students: t.students + r.students, fullyPaid: t.fullyPaid + r.fullyPaid, partiallyPaid: t.partiallyPaid + r.partiallyPaid, unpaid: t.unpaid + r.unpaid, overdue: t.overdue + r.overdue, expected: t.expected + r.expected, collected: t.collected + r.collected, outstanding: t.outstanding + r.outstanding }),
    { students: 0, fullyPaid: 0, partiallyPaid: 0, unpaid: 0, overdue: 0, expected: 0, collected: 0, outstanding: 0 },
  );
  const maxOutstanding = Math.max(0, ...rows.map((r) => r.outstanding));

  const bars = byClass.map((r) => ({ key: r.className, label: `Class ${r.className}`, value: r.outstanding, display: formatINRCompact(r.outstanding), detail: `Class ${r.className}: ${formatINR(r.outstanding)} outstanding · ${r.students - r.fullyPaid} of ${r.students} students` }));

  const columns: Column<ClassRow>[] = [
    { key: 'label', header: 'Class', render: (r) => <span className="strong">{r.label}</span>, sort: (r) => classSortKey(r.className) * 10 + (r.section ? r.section.charCodeAt(0) / 100 : 0) },
    { key: 'students', header: 'Students', align: 'right', render: (r) => r.students, sort: (r) => r.students },
    { key: 'paid', header: 'Fully paid', align: 'right', render: (r) => r.fullyPaid, sort: (r) => r.fullyPaid },
    { key: 'partial', header: 'Partial', align: 'right', render: (r) => r.partiallyPaid, sort: (r) => r.partiallyPaid },
    { key: 'unpaid', header: 'Unpaid', align: 'right', render: (r) => r.unpaid, sort: (r) => r.unpaid },
    { key: 'overdue', header: 'Overdue', align: 'right', render: (r) => (r.overdue ? <span className="badge overdue">{r.overdue}</span> : <span className="dim">0</span>), sort: (r) => r.overdue },
    { key: 'pct', header: 'Collection', render: (r) => <MiniMeter ratio={r.pct} />, sort: (r) => r.pct },
    { key: 'expected', header: 'Expected', align: 'right', render: (r) => formatINR(r.expected), sort: (r) => r.expected },
    { key: 'collected', header: 'Collected', align: 'right', render: (r) => formatINR(r.collected), sort: (r) => r.collected },
    {
      key: 'outstanding',
      header: 'Outstanding',
      align: 'right',
      render: (r) => (
        <span className={r.outstanding ? 'strong' : 'dim'} style={r.outstanding > 0 && r.outstanding === maxOutstanding ? { color: 'var(--overdue-fg)' } : undefined}>
          {formatINR(r.outstanding)}
        </span>
      ),
      sort: (r) => r.outstanding,
    },
  ];

  return (
    <div className="stack">
      <Card tint="peach" className="rise">
        <div className="row between">
          <Tag>Outstanding by class · {store.year}</Tag>
          <span className="small muted">Highest: {bars.length ? bars.reduce((a, b) => (b.value > a.value ? b : a)).label : '—'}</span>
        </div>
        <div className="hero-num" style={{ marginTop: 18 }}>
          {formatINRCompact(totals.outstanding)}
        </div>
        <div className="hero-sub">outstanding across {totals.partiallyPaid + totals.unpaid} students</div>
        <div style={{ marginTop: 16 }}>
          <BarChart items={bars} height={230} ariaLabel={`Outstanding per class: ${bars.map((b) => `${b.label} ${b.display}`).join(', ')}`} />
        </div>
      </Card>
      <Card className="rise">
        <div className="card-head">
          <div>
            <h3>Class-wise fee overview</h3>
            <span className="meta">Academic year {store.year} · click a row to see students with a balance</span>
          </div>
          <Segmented options={[{ value: 'section', label: 'By section' }, { value: 'class', label: 'By class' }]} value={mode} onChange={setMode} ariaLabel="Grouping" />
        </div>
        <Table
          rows={rows}
          columns={columns}
          rowKey={(r) => r.label}
          onRowClick={(r) => navigate(`/app/students?class=${encodeURIComponent(r.className)}${r.section ? `&section=${encodeURIComponent(r.section)}` : ''}&status=Outstanding`)}
          footer={
            <tr>
              <td>Total</td>
              <td className="num">{totals.students}</td>
              <td className="num">{totals.fullyPaid}</td>
              <td className="num">{totals.partiallyPaid}</td>
              <td className="num">{totals.unpaid}</td>
              <td className="num">{totals.overdue}</td>
              <td>
                <MiniMeter ratio={totals.expected ? totals.collected / totals.expected : 0} />
              </td>
              <td className="num">{formatINR(totals.expected)}</td>
              <td className="num">{formatINR(totals.collected)}</td>
              <td className="num">{formatINR(totals.outstanding)}</td>
            </tr>
          }
        />
        <p className="help" style={{ marginTop: 10 }}>
          Overall collection {formatPct(totals.expected ? totals.collected / totals.expected : 0)}. The row with the highest outstanding amount is marked in red. This replaces manually preparing class-wise fee reports.
        </p>
      </Card>
    </div>
  );
}
