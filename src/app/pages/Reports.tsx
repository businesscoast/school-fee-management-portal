import { useMemo, useState } from 'react';
import { daysBetween, formatDateShort } from '../../domain/dates';
import { classRows, sectionRows, summarize } from '../../domain/metrics';
import { formatINR, formatPct } from '../../domain/money';
import type { FeeView } from '../../domain/types';
import { toCSV } from '../../store/sample';
import { useStore, type StoreApi } from '../../store/store';
import { IconClasses, IconClock, IconCollections, IconDownload, IconEye, IconPrint, IconReports, IconRupee, IconSheet, IconWarning } from '../components/Icons';
import { useToast } from '../components/Toast';
import { Card, MiniMeter, Tag } from '../components/ui';
import { downloadText } from '../format';

type Fmt = 'text' | 'int' | 'inr' | 'pct' | 'date';
interface ReportColumn {
  header: string;
  fmt: Fmt;
}
interface ReportData {
  columns: ReportColumn[];
  rows: (string | number)[][];
  footer?: (string | number)[];
}
interface ReportDef {
  id: string;
  title: string;
  description: string;
  Icon: typeof IconRupee;
}

const REPORTS: ReportDef[] = [
  { id: 'collection', title: 'Fee Collection Report', description: 'Expected, collected and outstanding fee with collection percentage, by class and overall.', Icon: IconRupee },
  { id: 'outstanding', title: 'Student Outstanding Report', description: 'Every student with an unpaid balance, sorted by amount.', Icon: IconReports },
  { id: 'due', title: 'Due-Date Report', description: 'Students whose payment is due within the next 7 days.', Icon: IconClock },
  { id: 'overdue', title: 'Overdue Report', description: 'Students whose payment has crossed the due date.', Icon: IconWarning },
  { id: 'class', title: 'Class-Wise Report', description: 'Collection and outstanding amounts for each class and section.', Icon: IconClasses },
  { id: 'history', title: 'Payment History', description: 'Every payment recorded in the academic year with date, receipt number and mode.', Icon: IconSheet },
  { id: 'years', title: 'Academic Year Report', description: 'Year-on-year comparison of expected, collected and outstanding fee.', Icon: IconCollections },
];

function fmt(value: string | number, f: Fmt): string {
  if (typeof value === 'string') return f === 'date' ? formatDateShort(value) : value;
  if (f === 'inr') return formatINR(value);
  if (f === 'pct') return formatPct(value);
  return value.toLocaleString('en-IN');
}

interface BuildOptions {
  window: number;
  search: string;
}

/** Pure report builder so any report can be viewed or downloaded without being the active one. */
export function buildReport(id: string, views: FeeView[], store: StoreApi, opts: BuildOptions): ReportData {
  const studentCols: ReportColumn[] = [
    { header: 'Admission No', fmt: 'text' },
    { header: 'Student', fmt: 'text' },
    { header: 'Class', fmt: 'text' },
    { header: 'Total fee', fmt: 'inr' },
    { header: 'Paid', fmt: 'inr' },
    { header: 'Outstanding', fmt: 'inr' },
    { header: 'Due date', fmt: 'date' },
    { header: 'Status', fmt: 'text' },
  ];
  const studentRow = (v: FeeView) => [v.student.admissionNo, v.student.name, v.classLabel, v.record.totalFee, v.paid, v.outstanding, v.record.dueDate, v.status];
  switch (id) {
    case 'collection': {
      const rows = classRows(views);
      const s = summarize(views);
      return {
        columns: [
          { header: 'Class', fmt: 'text' },
          { header: 'Students', fmt: 'int' },
          { header: 'Expected', fmt: 'inr' },
          { header: 'Collected', fmt: 'inr' },
          { header: 'Outstanding', fmt: 'inr' },
          { header: 'Collection %', fmt: 'pct' },
        ],
        rows: rows.map((r) => [r.label, r.students, r.expected, r.collected, r.outstanding, r.pct]),
        footer: ['Total', s.totalStudents, s.expected, s.collected, s.outstanding, s.collectionPct],
      };
    }
    case 'outstanding':
      return { columns: studentCols, rows: views.filter((v) => v.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding).map(studentRow) };
    case 'due':
      return {
        columns: [...studentCols, { header: 'Days left', fmt: 'int' }],
        rows: views.filter((v) => v.outstanding > 0 && v.daysToDue >= 0 && v.daysToDue <= opts.window).sort((a, b) => a.daysToDue - b.daysToDue).map((v) => [...studentRow(v), v.daysToDue]),
      };
    case 'overdue':
      return {
        columns: [...studentCols, { header: 'Days overdue', fmt: 'int' }],
        rows: views.filter((v) => v.bucket === 'overdue').sort((a, b) => a.daysToDue - b.daysToDue).map((v) => [...studentRow(v), -v.daysToDue]),
      };
    case 'class':
      return {
        columns: [
          { header: 'Class', fmt: 'text' },
          { header: 'Students', fmt: 'int' },
          { header: 'Fully paid', fmt: 'int' },
          { header: 'Partially paid', fmt: 'int' },
          { header: 'Unpaid', fmt: 'int' },
          { header: 'Overdue', fmt: 'int' },
          { header: 'Expected', fmt: 'inr' },
          { header: 'Collected', fmt: 'inr' },
          { header: 'Outstanding', fmt: 'inr' },
          { header: 'Collection %', fmt: 'pct' },
        ],
        rows: sectionRows(views).map((r) => [r.label, r.students, r.fullyPaid, r.partiallyPaid, r.unpaid, r.overdue, r.expected, r.collected, r.outstanding, r.pct]),
      };
    case 'history': {
      const needle = opts.search.trim().toLowerCase();
      const rows = views
        .flatMap((v) => v.payments.map((p) => ({ p, v })))
        .filter(({ v, p }) => !needle || v.student.name.toLowerCase().includes(needle) || v.student.admissionNo.toLowerCase().includes(needle) || p.receiptNo.toLowerCase().includes(needle))
        .sort((a, b) => (a.p.date < b.p.date ? 1 : a.p.date > b.p.date ? -1 : 0));
      return {
        columns: [
          { header: 'Date', fmt: 'date' },
          { header: 'Receipt No', fmt: 'text' },
          { header: 'Admission No', fmt: 'text' },
          { header: 'Student', fmt: 'text' },
          { header: 'Class', fmt: 'text' },
          { header: 'Mode', fmt: 'text' },
          { header: 'Amount', fmt: 'inr' },
        ],
        rows: rows.map(({ p, v }) => [p.date, p.receiptNo, v.student.admissionNo, v.student.name, v.classLabel, p.mode, p.amount]),
        footer: ['Total', '', '', '', '', `${rows.length} payments`, rows.reduce((t, r) => t + r.p.amount, 0)],
      };
    }
    case 'years':
      return {
        columns: [
          { header: 'Academic year', fmt: 'text' },
          { header: 'Students', fmt: 'int' },
          { header: 'Fully paid', fmt: 'int' },
          { header: 'Partially paid', fmt: 'int' },
          { header: 'Unpaid', fmt: 'int' },
          { header: 'Expected', fmt: 'inr' },
          { header: 'Collected', fmt: 'inr' },
          { header: 'Outstanding', fmt: 'inr' },
          { header: 'Collection %', fmt: 'pct' },
        ],
        rows: store.data.years.map((y) => {
          const s = summarize(store.viewsFor(y));
          return [y + (y === store.data.currentYear ? ' (current)' : ''), s.totalStudents, s.fullyPaid, s.partiallyPaid, s.unpaid, s.expected, s.collected, s.outstanding, s.collectionPct];
        }),
      };
    default:
      return { columns: [], rows: [] };
  }
}

function toCSVRows(data: ReportData): (string | number)[][] {
  const pct = (v: string | number, i: number) => (data.columns[i]?.fmt === 'pct' && typeof v === 'number' ? Math.round(v * 1000) / 10 : v);
  const rows: (string | number)[][] = [data.columns.map((c) => c.header), ...data.rows.map((r) => r.map(pct))];
  if (data.footer) rows.push(data.footer.map(pct));
  return rows;
}

export function Reports() {
  const store = useStore();
  const toast = useToast();
  const [active, setActive] = useState('collection');
  const [window_, setWindow] = useState(7);
  const [search, setSearch] = useState('');
  const views = store.views;
  const opts = useMemo<BuildOptions>(() => ({ window: window_, search }), [window_, search]);

  const data = useMemo(() => buildReport(active, views, store, opts), [active, views, store, opts]);
  const def = REPORTS.find((r) => r.id === active)!;
  const yearRows = useMemo(() => store.data.years.map((y) => ({ year: y, s: summarize(store.viewsFor(y)) })), [store]);

  const exportCSV = (id: string) => {
    const report = REPORTS.find((r) => r.id === id)!;
    const d = id === active ? data : buildReport(id, views, store, opts);
    const fileName = `${report.title.toLowerCase().replace(/\s+/g, '-')}-${store.year}.csv`;
    downloadText(fileName, toCSV(toCSVRows(d)));
    toast({ title: 'CSV downloaded', sub: `${report.title} · ${d.rows.length.toLocaleString('en-IN')} rows` });
  };

  const view = (id: string) => {
    setActive(id);
    document.getElementById('report-view')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="stack">
      <Card className="rise no-print">
        <div className="card-head">
          <h3>Academic year comparison</h3>
          <span className="meta">Historical records stay available for every year</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Academic year</th>
                <th className="num">Students</th>
                <th className="num">Expected</th>
                <th className="num">Collected</th>
                <th className="num">Outstanding</th>
                <th>Collection</th>
              </tr>
            </thead>
            <tbody>
              {yearRows.map(({ year, s }) => (
                <tr key={year} className={year === store.year ? 'selected' : ''}>
                  <td>
                    <span className="row" style={{ gap: 8 }}>
                      <span className="strong">{year}</span>
                      {year === store.data.currentYear ? <Tag tone="green">Current</Tag> : null}
                      {year === store.year ? <span className="small muted">Selected</span> : null}
                    </span>
                  </td>
                  <td className="num">{s.totalStudents.toLocaleString('en-IN')}</td>
                  <td className="num">{formatINR(s.expected)}</td>
                  <td className="num">{formatINR(s.collected)}</td>
                  <td className="num">{formatINR(s.outstanding)}</td>
                  <td>
                    <MiniMeter ratio={s.collectionPct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="report-grid no-print">
        {REPORTS.map((r) => (
          <Card key={r.id} className={`rise report-card ${r.id === active ? 'active' : ''}`}>
            <button type="button" className="rt" onClick={() => view(r.id)}>
              <span className="ico">
                <r.Icon size={17} />
              </span>
              {r.title}
            </button>
            <p>{r.description}</p>
            <div className="row">
              <button type="button" className="btn secondary sm" onClick={() => view(r.id)} aria-label={`View ${r.title}`}>
                <IconEye size={15} /> View
              </button>
              <button type="button" className="btn secondary sm" onClick={() => exportCSV(r.id)} aria-label={`Download ${r.title} as CSV`}>
                <IconDownload size={15} /> Download CSV
              </button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="rise" id="report-view">
        <div className="card-head" style={{ alignItems: 'flex-start' }}>
          <div>
            <h2 className="h2">{def.title}</h2>
            <p className="sub" style={{ marginTop: 4 }}>
              {def.description} {active === 'years' ? '' : `Academic year ${store.year}.`} Generated {formatDateShort(store.today)}.
            </p>
          </div>
          <div className="row no-print">
            {active === 'due' ? (
              <select className="select sm" value={window_} onChange={(e) => setWindow(Number(e.target.value))} aria-label="Window" style={{ width: 150 }}>
                <option value={3}>Next 3 days</option>
                <option value={7}>Next 7 days</option>
                <option value={14}>Next 14 days</option>
                <option value={30}>Next 30 days</option>
              </select>
            ) : null}
            {active === 'history' ? <input className="input sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Student, admission no. or receipt" aria-label="Filter payments" style={{ width: 240 }} /> : null}
            <button type="button" className="btn secondary sm" onClick={() => exportCSV(active)}>
              <IconDownload size={15} /> CSV
            </button>
            <button type="button" className="btn secondary sm" onClick={() => window.print()}>
              <IconPrint size={15} /> Print
            </button>
          </div>
        </div>
        <div className="table-wrap" style={{ maxHeight: '70vh' }}>
          <table className="table">
            <thead>
              <tr>
                {data.columns.map((c) => (
                  <th key={c.header} className={c.fmt === 'text' || c.fmt === 'date' ? '' : 'num'}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={data.columns.length}>
                    <div className="empty">
                      <strong>No rows</strong>
                      Nothing matches this report right now.
                    </div>
                  </td>
                </tr>
              ) : (
                data.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((v, j) => (
                      <td key={j} className={data.columns[j].fmt === 'text' || data.columns[j].fmt === 'date' ? (j === 1 || (active === 'history' && j === 3) ? 'strong' : '') : 'num'}>
                        {fmt(v, data.columns[j].fmt)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
            {data.footer ? (
              <tfoot>
                <tr>
                  {data.footer.map((v, j) => (
                    <td key={j} className={data.columns[j].fmt === 'text' || data.columns[j].fmt === 'date' ? '' : 'num'}>
                      {typeof v === 'number' ? fmt(v, data.columns[j].fmt) : v}
                    </td>
                  ))}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
        <p className="help" style={{ marginTop: 10 }}>
          {data.rows.length.toLocaleString('en-IN')} row{data.rows.length === 1 ? '' : 's'}.{active === 'due' ? ` Due dates measured from ${formatDateShort(store.today)}; ${daysBetween(store.today, store.today)} means today.` : ''}
        </p>
      </Card>
    </div>
  );
}
