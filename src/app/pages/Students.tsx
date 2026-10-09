import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatDateShort } from '../../domain/dates';
import { formatINR } from '../../domain/money';
import { classSortKey, compareViews, matchesStatusFilter } from '../../domain/status';
import type { DisplayStatus, DueBucket, FeeView } from '../../domain/types';
import { toCSV } from '../../store/sample';
import { useStore } from '../../store/store';
import { IconDownload, IconSend } from '../components/Icons';
import { ReminderComposer } from '../components/ReminderComposer';
import { useStudentDrawer } from '../components/StudentDrawer';
import { Table, type Column } from '../components/Table';
import { useToast } from '../components/Toast';
import { Card, Segmented, StatusBadge } from '../components/ui';
import { downloadText, dueText } from '../format';

type Filter = 'All' | DisplayStatus | 'Outstanding';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'All', label: 'All' },
  { value: 'Outstanding', label: 'With balance' },
  { value: 'Fully Paid', label: 'Fully Paid' },
  { value: 'Partially Paid', label: 'Partially Paid' },
  { value: 'Unpaid', label: 'Unpaid' },
  { value: 'Overdue', label: 'Overdue' },
];

export type DueFilter = '' | 'overdue' | 'today' | 'within3' | 'within7';
const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: '', label: 'Any due date' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due today' },
  { value: 'within3', label: 'Due within 3 days' },
  { value: 'within7', label: 'Due within 7 days' },
];
const DUE_BUCKETS: Record<Exclude<DueFilter, ''>, DueBucket[]> = {
  overdue: ['overdue'],
  today: ['today'],
  within3: ['today', 'within3'],
  within7: ['today', 'within3', 'within7'],
};

export function matchesQuery(v: FeeView, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return v.student.name.toLowerCase().includes(needle) || v.student.admissionNo.toLowerCase().includes(needle) || v.classLabel.toLowerCase() === needle || v.student.guardianName.toLowerCase().includes(needle) || v.student.phone.includes(needle);
}

export function matchesDue(v: FeeView, due: DueFilter): boolean {
  if (!due) return true;
  return v.outstanding > 0 && DUE_BUCKETS[due].includes(v.bucket);
}

/** Overdue students first, then by balance, then the usual class order. */
export function compareForList(a: FeeView, b: FeeView): number {
  return Number(b.bucket === 'overdue') - Number(a.bucket === 'overdue') || b.outstanding - a.outstanding || compareViews(a, b);
}

export function dueTone(v: FeeView): string {
  if (v.outstanding <= 0) return 'muted';
  if (v.bucket === 'overdue') return 'due-overdue';
  if (v.bucket === 'today' || v.bucket === 'within3') return 'due-soon';
  if (v.bucket === 'within7') return 'due-week';
  return 'muted';
}

export function Students() {
  const store = useStore();
  const toast = useToast();
  const drawer = useStudentDrawer();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status = (params.get('status') as Filter) || 'All';
  const cls = params.get('class') ?? '';
  const section = params.get('section') ?? '';
  const due = (params.get('due') as DueFilter) || '';
  const deepLink = params.get('student');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [composer, setComposer] = useState(false);

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  // Deep link: /app/students?student=1001 opens that student's drawer once.
  useEffect(() => {
    if (!deepLink) return;
    drawer.open(deepLink);
    const next = new URLSearchParams(params);
    next.delete('student');
    setParams(next, { replace: true });
  }, [deepLink, drawer, params, setParams]);

  const classes = useMemo(() => [...new Set(store.views.map((v) => v.record.className))].sort((a, b) => classSortKey(a) - classSortKey(b)), [store.views]);
  const sections = useMemo(() => [...new Set(store.views.filter((v) => !cls || v.record.className === cls).map((v) => v.record.section))].sort(), [store.views, cls]);

  const base = useMemo(() => store.views.filter((v) => matchesQuery(v, q) && (!cls || v.record.className === cls) && (!section || v.record.section === section) && matchesDue(v, due)), [store.views, q, cls, section, due]);
  const rows = useMemo(() => base.filter((v) => matchesStatusFilter(v, status)).sort(compareForList), [base, status]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.value, base.filter((v) => matchesStatusFilter(v, f.value)).length])) as Record<Filter, number>, [base]);

  const selectable = rows.filter((v) => v.outstanding > 0);
  const allSelected = selectable.length > 0 && selectable.every((v) => selected.has(v.student.admissionNo));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectable.map((v) => v.student.admissionNo)));
  const toggle = (adm: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(adm)) next.delete(adm);
      else next.add(adm);
      return next;
    });
  const selectedViews = store.views.filter((v) => selected.has(v.student.admissionNo));

  const exportCSV = () => {
    const header = ['Admission No', 'Student', 'Guardian', 'Mobile', 'Class', 'Academic year', 'Total fee', 'Paid', 'Outstanding', 'Due date', 'Status'];
    const body = rows.map((v) => [v.student.admissionNo, v.student.name, v.student.guardianName, v.student.phone, v.classLabel, v.record.academicYear, v.record.totalFee, v.paid, v.outstanding, v.record.dueDate, v.status]);
    const fileName = `students-${store.year}${status !== 'All' ? `-${status.toLowerCase().replace(/\s+/g, '-')}` : ''}.csv`;
    downloadText(fileName, toCSV([header, ...body]));
    toast({ title: 'CSV downloaded', sub: `${rows.length.toLocaleString('en-IN')} students · ${fileName}` });
  };

  const columns: Column<FeeView>[] = [
    {
      key: 'sel',
      header: <input type="checkbox" className="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all students with a balance" />,
      width: '36px',
      render: (v) =>
        v.outstanding > 0 ? (
          <input type="checkbox" className="checkbox" checked={selected.has(v.student.admissionNo)} onChange={() => toggle(v.student.admissionNo)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${v.student.name}`} />
        ) : (
          <input type="checkbox" className="checkbox" disabled title="Nothing outstanding" aria-label={`${v.student.name} has nothing outstanding`} />
        ),
    },
    {
      key: 'name',
      header: 'Student',
      render: (v) => (
        <span>
          <span className="strong">{v.student.name}</span>
          <br />
          <span className="dim small">Adm. {v.student.admissionNo} · {v.student.guardianName}</span>
        </span>
      ),
      sort: (v) => v.student.name,
    },
    { key: 'class', header: 'Class', render: (v) => v.classLabel, sort: (v) => classSortKey(v.record.className) * 10 + v.record.section.charCodeAt(0) / 100 },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v.status} />, sort: (v) => v.status },
    { key: 'total', header: 'Total fee', align: 'right', render: (v) => formatINR(v.record.totalFee), sort: (v) => v.record.totalFee },
    { key: 'paid', header: 'Paid', align: 'right', render: (v) => formatINR(v.paid), sort: (v) => v.paid },
    { key: 'out', header: 'Balance', align: 'right', render: (v) => <span className={v.outstanding > 0 ? 'strong' : 'dim'}>{formatINR(v.outstanding)}</span>, sort: (v) => v.outstanding },
    {
      key: 'due',
      header: 'Due date',
      render: (v) => (
        <span>
          {formatDateShort(v.record.dueDate)}
          <br />
          <span className={`small ${dueTone(v)}`}>{v.outstanding > 0 ? dueText(v) : 'Nothing outstanding'}</span>
        </span>
      ),
      sort: (v) => v.record.dueDate,
    },
  ];

  return (
    <div className="stack">
      <Card className="rise">
        <div className="toolbar">
          <input className="input sm" value={q} onChange={(e) => set('q', e.target.value)} placeholder="Search name, admission no., guardian" aria-label="Search" style={{ width: 260 }} />
          <select className="select sm" value={cls} onChange={(e) => set('class', e.target.value)} aria-label="Class" style={{ width: 130 }}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c} value={c}>
                Class {c}
              </option>
            ))}
          </select>
          <select className="select sm" value={section} onChange={(e) => set('section', e.target.value)} aria-label="Section" style={{ width: 125 }}>
            <option value="">All sections</option>
            {sections.map((sec) => (
              <option key={sec} value={sec}>
                Section {sec}
              </option>
            ))}
          </select>
          <select className="select sm" value={due} onChange={(e) => set('due', e.target.value)} aria-label="Due date" style={{ width: 160 }}>
            {DUE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="spacer" />
          <button type="button" className="btn secondary sm" onClick={exportCSV} disabled={rows.length === 0}>
            <IconDownload size={15} /> Export CSV
          </button>
        </div>
        <div className="row between" style={{ margin: '12px 0 14px' }}>
          <Segmented options={FILTERS.map((f) => ({ value: f.value, label: f.label, count: counts[f.value] }))} value={status} onChange={(v) => set('status', v === 'All' ? '' : v)} ariaLabel="Payment status" />
          <span className="small muted">Click a row to open the fee drawer</span>
        </div>
        <Table rows={rows} columns={columns} rowKey={(v) => v.student.admissionNo} onRowClick={(v) => drawer.open(v.student.admissionNo)} pageSize={25} rowClass={(v) => (selected.has(v.student.admissionNo) ? 'selected' : '')} empty={<div className="empty"><strong>No students match these filters</strong>Try another filter or clear the search.</div>} />
      </Card>
      {selected.size > 0 ? (
        <div className="action-bar">
          <span>
            <strong>{selected.size}</strong> selected · {formatINR(selectedViews.reduce((sum, v) => sum + v.outstanding, 0))} outstanding
          </span>
          <span className="spacer" style={{ flex: 1 }} />
          <button type="button" className="btn ghost sm" onClick={() => setSelected(new Set())}>
            Clear
          </button>
          <button type="button" className="btn sm" onClick={() => setComposer(true)}>
            <IconSend size={14} /> Send reminder
          </button>
        </div>
      ) : null}
      <ReminderComposer open={composer} onClose={() => setComposer(false)} recipients={selectedViews} />
    </div>
  );
}
