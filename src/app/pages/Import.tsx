import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { formatDateShort, formatDateTime, nowISO } from '../../domain/dates';
import { applyImport } from '../../domain/importer/commit';
import { FIELD_LABELS, FIELD_ORDER, guessMapping, type Field } from '../../domain/importer/mapping';
import { extractFromFile, sourceKindOf } from '../../domain/importer/parse';
import type { RawTable } from '../../domain/importer/textTable';
import { EDITABLE_FIELDS, hasErrors, importStats, validateAll, validateRecords, type ExtractedRecord, type RowMode, type ValidationContext } from '../../domain/importer/validate';
import { formatINR } from '../../domain/money';
import type { ImportBatch, SourceKind } from '../../domain/types';
import { buildNewAdmissions, buildSampleRegister } from '../../store/sample';
import { useStore } from '../../store/store';
import { IconCheck, IconDownload, IconImport, IconInfo, IconWarning } from '../components/Icons';
import { Modal } from '../components/Modal';
import { Table, type Column } from '../components/Table';
import { useToast } from '../components/Toast';
import { Card, Tag } from '../components/ui';
import { downloadText } from '../format';

type Step = 'upload' | 'extracting' | 'review' | 'done';
type ReviewFilter = 'review' | 'all' | 'new' | 'errors';

const STEPS: { key: Step | 'confirm'; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'extracting', label: 'Extract' },
  { key: 'review', label: 'Review' },
  { key: 'confirm', label: 'Confirm' },
  { key: 'done', label: 'Import' },
];

const KIND_LABEL: Record<SourceKind, string> = { csv: 'CSV', xlsx: 'Excel', pdf: 'PDF', image: 'Scanned image' };

export function Import() {
  const store = useStore();
  const toast = useToast();
  const [step, setStep] = useState<Step>('upload');
  const [targetYear, setTargetYear] = useState(store.year);
  const [rowMode, setRowMode] = useState<RowMode>('student');
  const [fileName, setFileName] = useState('');
  const [table, setTable] = useState<RawTable | null>(null);
  const [mapping, setMapping] = useState<Field[]>([]);
  const [records, setRecords] = useState<ExtractedRecord[]>([]);
  const [filter, setFilter] = useState<ReviewFilter>('review');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const ctx = useMemo<ValidationContext>(() => {
    const views = store.viewsFor(targetYear);
    return {
      existing: new Map(views.map((v) => [v.student.admissionNo, { name: v.student.name, className: v.record.className, section: v.record.section, totalFee: v.record.totalFee, paid: v.paid, dueDate: v.record.dueDate }])),
      existingReceipts: new Set(store.data.payments.map((p) => p.receiptNo)),
      feeStructure: store.data.feeStructure[targetYear] ?? {},
      year: targetYear,
      today: store.today,
      sourceKind: table?.sourceKind ?? 'csv',
      rowMode,
    };
  }, [store, targetYear, rowMode, table?.sourceKind]);

  // Re-validate kept edits when the target year or row mode changes.
  const ctxRef = useRef(ctx);
  useEffect(() => {
    if (ctxRef.current === ctx) return;
    ctxRef.current = ctx;
    if (step === 'review') setRecords((rs) => validateRecords(rs.map((r) => ({ rowIndex: r.rowIndex, raw: r.raw, decision: r.decision })), ctx));
  }, [ctx, step]);

  const loadFile = useCallback(
    async (file: File) => {
      setError('');
      setBatch(null);
      const kind = sourceKindOf(file);
      if (!kind) {
        setError('Unsupported file type. Upload an Excel, CSV, PDF or image file.');
        return;
      }
      setFileName(file.name);
      setStep('extracting');
      setProgress('Starting…');
      try {
        const t = await extractFromFile(file, setProgress);
        if (t.rows.length === 0) throw new Error('No records could be read from this file.');
        const m = guessMapping(t.headers, t.rows);
        const c = { ...ctx, sourceKind: t.sourceKind };
        ctxRef.current = c;
        setTable(t);
        setMapping(m);
        setRecords(validateAll(t, m, c));
        setFilter('review');
        setStep('review');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'The file could not be read.');
        setStep('upload');
      }
    },
    [ctx],
  );

  const useSample = (which: 'register' | 'admissions') => {
    const sample = which === 'register' ? buildSampleRegister(store.data, store.data.currentYear, store.today) : buildNewAdmissions(store.data, store.data.years[store.data.years.length - 1]);
    if (which === 'register') setTargetYear(store.data.currentYear);
    else setTargetYear(store.data.years[store.data.years.length - 1]);
    void loadFile(new File([sample.csv], sample.fileName, { type: 'text/csv' }));
  };

  const downloadSample = (which: 'register' | 'admissions') => {
    const sample = which === 'register' ? buildSampleRegister(store.data, store.data.currentYear, store.today) : buildNewAdmissions(store.data, store.data.years[store.data.years.length - 1]);
    downloadText(sample.fileName, sample.csv);
  };

  const changeMapping = (col: number, field: Field) => {
    if (!table) return;
    const next = mapping.map((f, i) => (i === col ? field : f !== 'ignore' && f === field ? 'ignore' : f));
    setMapping(next);
    setRecords(validateAll(table, next, ctx));
  };

  const editCell = (rowIndex: number, field: Field, value: string) => {
    setRecords((rs) => validateRecords(rs.map((r) => ({ rowIndex: r.rowIndex, raw: r.rowIndex === rowIndex ? { ...r.raw, [field]: value } : r.raw, decision: r.decision })), ctx));
  };

  const setDecision = (rowIndex: number, decision: 'import' | 'skip') => {
    setRecords((rs) => rs.map((r) => (r.rowIndex === rowIndex ? { ...r, decision } : r)));
  };

  const stats = useMemo(() => importStats(records), [records]);
  const newCount = records.filter((r) => r.match === 'new').length;
  const errorCount = records.filter((r) => hasErrors(r)).length;
  const visible = useMemo(() => {
    switch (filter) {
      case 'review':
        return records.filter((r) => r.needsReview);
      case 'new':
        return records.filter((r) => r.match === 'new');
      case 'errors':
        return records.filter((r) => hasErrors(r));
      default:
        return records;
    }
  }, [records, filter]);

  const confirm = () => {
    if (!table) return;
    const result = applyImport(store.data, records, { year: targetYear, fileName, sourceKind: table.sourceKind, today: store.today, now: nowISO(), rowMode });
    store.commitImport(result.data, result.batch);
    setBatch(result.batch);
    setConfirmOpen(false);
    setStep('done');
    toast({ title: 'Import completed!', sub: `${result.batch.imported} records added to ${targetYear}` });
  };

  const reset = () => {
    setStep('upload');
    setTable(null);
    setRecords([]);
    setMapping([]);
    setFileName('');
    setError('');
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void loadFile(file);
  };

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  const cell = (r: ExtractedRecord, field: Field, text: string, width = 110) =>
    r.needsReview ? (
      <input className={`input sm ${r.issues.some((i) => i.field === field && i.level === 'error') ? 'invalid' : ''}`} style={{ width }} value={r.raw[field] ?? ''} onChange={(e) => editCell(r.rowIndex, field, e.target.value)} aria-label={`${FIELD_LABELS[field]} row ${r.rowIndex}`} />
    ) : (
      <span>{text}</span>
    );

  const columns: Column<ExtractedRecord>[] = [
    { key: 'row', header: '#', render: (r) => <span className="dim">{r.rowIndex}</span>, sort: (r) => r.rowIndex, width: '44px' },
    {
      key: 'include',
      header: 'Include',
      width: '70px',
      render: (r) => <input type="checkbox" className="checkbox" checked={r.decision === 'import' && !hasErrors(r)} disabled={hasErrors(r)} onChange={(e) => setDecision(r.rowIndex, e.target.checked ? 'import' : 'skip')} aria-label={`Include row ${r.rowIndex}`} title={hasErrors(r) ? 'Fix the errors or skip this row' : undefined} />,
    },
    {
      key: 'adm',
      header: 'Adm. No',
      render: (r) => (
        <span>
          {cell(r, 'admissionNo', r.parsed.admissionNo ?? '', 96)}
          {r.match === 'new' ? (
            <>
              <br />
              <span className="small" style={{ color: 'var(--unpaid-fg)', fontWeight: 600 }}>
                New student
              </span>
            </>
          ) : null}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Student',
      render: (r) => (
        <span>
          {cell(r, 'name', r.parsed.name ?? '', 150)}
          {r.existing && r.needsReview ? (
            <>
              <br />
              <span className="dim small">On file: {r.existing.name}</span>
            </>
          ) : null}
        </span>
      ),
    },
    {
      key: 'class',
      header: 'Class',
      render: (r) =>
        r.needsReview ? (
          <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
            {cell(r, 'className', '', 54)}
            {cell(r, 'section', '', 44)}
          </span>
        ) : (
          <span>{r.parsed.className ? `${r.parsed.className}${r.parsed.section ? `-${r.parsed.section}` : ''}` : ''}</span>
        ),
    },
    { key: 'total', header: 'Total fee', align: 'right', render: (r) => cell(r, 'totalFee', r.parsed.totalFee !== undefined ? formatINR(r.parsed.totalFee) : '', 96) },
    {
      key: 'paid',
      header: rowMode === 'receipt' ? 'Receipt amount' : 'Paid',
      align: 'right',
      render: (r) => (
        <span>
          {cell(r, 'paidAmount', r.parsed.paidAmount !== undefined ? formatINR(r.parsed.paidAmount) : '', 96)}
          {r.paymentToAdd > 0 ? (
            <>
              <br />
              <span className="small" style={{ color: 'var(--paid-fg)', fontWeight: 700 }}>
                +{formatINR(r.paymentToAdd)}
              </span>
            </>
          ) : null}
        </span>
      ),
    },
    { key: 'due', header: 'Due date', render: (r) => cell(r, 'dueDate', r.parsed.dueDate ? formatDateShort(r.parsed.dueDate) : '', 104) },
    {
      key: 'receipt',
      header: 'Receipt · date',
      render: (r) =>
        r.needsReview ? (
          <span className="stack" style={{ gap: 4 }}>
            {cell(r, 'receiptNo', '', 110)}
            {cell(r, 'paymentDate', '', 110)}
          </span>
        ) : (
          <span className="dim">
            {r.parsed.receiptNo ?? ''}
            {r.parsed.paymentDate ? ` · ${formatDateShort(r.parsed.paymentDate)}` : ''}
          </span>
        ),
    },
    {
      key: 'conf',
      header: 'Confidence',
      render: (r) => (
        <span className={`conf ${hasErrors(r) ? 'bad' : r.confidence < 0.8 ? 'low' : ''}`}>
          <i>
            <b style={{ width: `${Math.round(r.confidence * 100)}%` }} />
          </i>
          {Math.round(r.confidence * 100)}%
        </span>
      ),
      sort: (r) => r.confidence,
    },
    {
      key: 'issues',
      header: 'Checks',
      render: (r) =>
        r.issues.length === 0 ? (
          <span className="small" style={{ color: 'var(--paid-fg)' }}>
            Ready
          </span>
        ) : (
          <span>
            {r.issues.map((i, n) => (
              <span key={n} className={`issue ${i.level}`}>
                {i.level === 'error' ? <IconWarning size={13} /> : <IconInfo size={13} />}
                {i.message}
              </span>
            ))}
          </span>
        ),
    },
  ];

  return (
    <div className="stack">
      <ol className="steps" aria-label="Import steps">
        {STEPS.map((s, i) => (
          <li key={s.key} className={i < stepIndex || step === 'done' ? 'done' : s.key === step ? 'active' : ''}>
            <span className="no">{i < stepIndex || step === 'done' ? <IconCheck size={12} /> : i + 1}</span>
            {s.label}
          </li>
        ))}
      </ol>

      {step === 'upload' ? (
        <>
          <Card tint="cool" className="rise">
            <div className="row between" style={{ marginBottom: 14 }}>
              <div>
                <h2 className="h2">Bring your records in.</h2>
                <p className="sub" style={{ marginTop: 6 }}>
                  Upload → Extract → Review → Confirm → Import. Nothing becomes official data until you confirm it.
                </p>
              </div>
              <label className="field" style={{ minWidth: 200 }}>
                <span className="small" style={{ fontWeight: 600 }}>
                  Import into academic year
                </span>
                <select className="select" value={targetYear} onChange={(e) => setTargetYear(e.target.value)}>
                  {store.data.years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                      {y === store.data.currentYear ? ' (current)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div
              className={`dropzone ${dragOver ? 'over' : ''}`}
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && fileInput.current?.click()}
            >
              <IconImport size={28} />
              <h3>Drop a fee register here, or click to choose a file</h3>
              <p className="sub" style={{ marginTop: 6 }}>
                Excel (.xlsx, .xls), CSV, PDF reports, or photos and scans of paper registers (.jpg, .png)
              </p>
              <input ref={fileInput} type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm,.ods,.pdf,image/*" hidden onChange={(e) => e.target.files?.[0] && void loadFile(e.target.files[0])} />
            </div>
            {error ? (
              <p className="issue error" style={{ marginTop: 12, fontSize: 13.5 }}>
                <IconWarning size={15} /> {error}
              </p>
            ) : null}
            <div className="source-cards" style={{ marginTop: 16 }}>
              <div className="source-card">
                <Tag tone="cool">Excel / CSV</Tag>
                <strong>Spreadsheets</strong>
                The system reads the column headings, maps them to fee fields and prepares the records for import. Column mapping can be adjusted.
              </div>
              <div className="source-card">
                <Tag tone="pink">PDF</Tag>
                <strong>Fee reports and documents</strong>
                Tables in PDF reports are read directly. Scanned PDFs go through document recognition.
              </div>
              <div className="source-card">
                <Tag tone="green">Paper / scanned</Tag>
                <strong>Registers and receipts</strong>
                Photograph or scan the register. Text recognition runs in your browser; low-confidence rows are held for review.
              </div>
            </div>
          </Card>
          <Card className="rise">
            <div className="card-head">
              <h3>Try it with a sample file</h3>
              <span className="meta">Generated from this school's data</span>
            </div>
            <div className="grid cols-2">
              <div className="source-card">
                <strong style={{ marginTop: 0 }}>Term collection register · {store.data.currentYear}</strong>
                486 rows for classes 5 to 8 with fresh payments for 40 students and seven rows that need a second look: a missing admission number, an amount written in words, a payment above the fee, an impossible date, a reused receipt number, a mismatched name and balance, and a new student without a class.
                <div className="row" style={{ marginTop: 12 }}>
                  <button type="button" className="btn sm" onClick={() => useSample('register')}>
                    Use this sample
                  </button>
                  <button type="button" className="btn secondary sm" onClick={() => downloadSample('register')}>
                    <IconDownload size={15} /> Download CSV
                  </button>
                </div>
              </div>
              <div className="source-card">
                <strong style={{ marginTop: 0 }}>New admissions · {store.data.years[store.data.years.length - 1]}</strong>
                Sixty class-1 admissions for the next academic year, with a combined "Class & Section" column, mobile numbers with country codes and fees written with the rupee symbol.
                <div className="row" style={{ marginTop: 12 }}>
                  <button type="button" className="btn sm" onClick={() => useSample('admissions')}>
                    Use this sample
                  </button>
                  <button type="button" className="btn secondary sm" onClick={() => downloadSample('admissions')}>
                    <IconDownload size={15} /> Download CSV
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </>
      ) : null}

      {step === 'extracting' ? (
        <Card className="rise">
          <div className="progress-note">
            <span className="spinner" />
            <span>
              <strong>{fileName}</strong> · {progress}
            </span>
          </div>
          <p className="help" style={{ marginTop: 10 }}>
            Scanned documents take longer: the recognition model downloads once and runs locally in your browser.
          </p>
        </Card>
      ) : null}

      {step === 'review' && table ? (
        <>
          <Card tint="cool" className="rise">
            <div className="row between" style={{ marginBottom: 14 }}>
              <div>
                <h2 className="h2">{fileName}</h2>
                <p className="sub" style={{ marginTop: 4 }}>
                  {KIND_LABEL[table.sourceKind]} · {table.rows.length.toLocaleString('en-IN')} rows read · importing into <strong>{targetYear}</strong>
                </p>
                {table.notes.map((n, i) => (
                  <p key={i} className="help" style={{ marginTop: 4 }}>
                    <IconInfo size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> {n}
                  </p>
                ))}
              </div>
              <button type="button" className="btn secondary sm" onClick={reset}>
                Choose another file
              </button>
            </div>
            <div className="summary-tiles">
              <div className="tile">
                <div className="v">{stats.identified.toLocaleString('en-IN')}</div>
                <div className="l">records identified</div>
              </div>
              <div className="tile">
                <div className="v" style={{ color: 'var(--paid-fg)' }}>
                  {stats.ready.toLocaleString('en-IN')}
                </div>
                <div className="l">records ready for import</div>
              </div>
              <div className="tile">
                <div className="v" style={{ color: stats.review ? 'var(--overdue-fg)' : undefined }}>
                  {stats.review.toLocaleString('en-IN')}
                </div>
                <div className="l">records require review</div>
              </div>
            </div>
          </Card>

          <Card className="rise">
            <div className="card-head">
              <h3>Column mapping</h3>
              <div className="row">
                <span className="small muted">Each row is</span>
                <div className="seg" role="group" aria-label="Row type">
                  <button type="button" aria-pressed={rowMode === 'student'} onClick={() => setRowMode('student')}>
                    One student (paid so far)
                  </button>
                  <button type="button" aria-pressed={rowMode === 'receipt'} onClick={() => setRowMode('receipt')}>
                    One receipt
                  </button>
                </div>
                <select className="select sm" value={targetYear} onChange={(e) => setTargetYear(e.target.value)} aria-label="Target academic year" style={{ width: 130 }}>
                  {store.data.years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mapping-grid">
              {table.headers.map((h, col) => (
                <div key={col} className="map">
                  <span className="hdr" title={h}>
                    {h || `Column ${col + 1}`}
                  </span>
                  <span className="sample" title={table.rows[0]?.[col]}>
                    e.g. {table.rows[0]?.[col] || '—'}
                  </span>
                  <select className="select sm" value={mapping[col]} onChange={(e) => changeMapping(col, e.target.value as Field)} aria-label={`Field for column ${h || col + 1}`}>
                    {FIELD_ORDER.map((f) => (
                      <option key={f} value={f}>
                        {FIELD_LABELS[f]}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {!mapping.includes('admissionNo') ? (
              <p className="issue error" style={{ marginTop: 12, fontSize: 13.5 }}>
                <IconWarning size={15} /> Map one column to the admission number so students can be matched.
              </p>
            ) : null}
          </Card>

          <Card className="rise">
            <div className="card-head">
              <h3>Review records</h3>
              <div className="chips">
                {(
                  [
                    ['review', `Needs review`, stats.review],
                    ['errors', `Errors`, errorCount],
                    ['new', `New students`, newCount],
                    ['all', `All`, records.length],
                  ] as [ReviewFilter, string, number][]
                ).map(([key, label, n]) => (
                  <button key={key} type="button" className={`chip ${filter === key ? 'active' : ''}`} onClick={() => setFilter(key)}>
                    {label} <span className="n">{n}</span>
                  </button>
                ))}
              </div>
            </div>
            <p className="help" style={{ marginBottom: 12 }}>
              Rows that need review can be edited in place; checks re-run as you type. Rows with errors are skipped unless fixed. Untick a row to leave it out.
            </p>
            <Table rows={visible} columns={columns} rowKey={(r) => String(r.rowIndex)} pageSize={25} rowClass={() => 'review-row'} empty={<div className="empty"><strong>Nothing here</strong>No rows match this filter.</div>} />
            <div className="row between" style={{ marginTop: 16 }}>
              <span className="small muted">
                {stats.importable.toLocaleString('en-IN')} will be imported · {stats.skipped + stats.blocked} left out
                {EDITABLE_FIELDS.length ? '' : ''}
              </span>
              <button type="button" className="btn" disabled={stats.importable === 0 || !mapping.includes('admissionNo')} onClick={() => setConfirmOpen(true)}>
                Confirm import of {stats.importable.toLocaleString('en-IN')} records
              </button>
            </div>
          </Card>

          <Modal open={confirmOpen} title={`Import into ${targetYear}?`} onClose={() => setConfirmOpen(false)}>
            <div className="stack">
              <div className="summary-tiles">
                <div className="tile">
                  <div className="v">{stats.importable}</div>
                  <div className="l">records will be imported</div>
                </div>
                <div className="tile">
                  <div className="v">{records.filter((r) => r.decision === 'import' && !hasErrors(r) && r.paymentToAdd > 0).length}</div>
                  <div className="l">payments will be recorded</div>
                </div>
                <div className="tile">
                  <div className="v">{stats.skipped + stats.blocked}</div>
                  <div className="l">rows left out</div>
                </div>
              </div>
              <p className="sub">
                {records.filter((r) => r.decision === 'import' && !hasErrors(r) && r.match === 'new').length} new students will be created. Existing students keep their recorded payments; only increases in the paid amount are added as new payments.
              </p>
              <div className="modal-foot">
                <button type="button" className="btn secondary" onClick={() => setConfirmOpen(false)}>
                  Back to review
                </button>
                <button type="button" className="btn" onClick={confirm}>
                  Import now
                </button>
              </div>
            </div>
          </Modal>
        </>
      ) : null}

      {step === 'done' && batch ? (
        <Card tint="lime" className="rise">
          <Tag tone="green">Import completed</Tag>
          <h2 className="h2" style={{ marginTop: 14 }}>
            {batch.imported.toLocaleString('en-IN')} records added to {batch.academicYear}.
          </h2>
          <div className="summary-tiles" style={{ marginTop: 16 }}>
            <div className="tile">
              <div className="v">{batch.paymentsAdded}</div>
              <div className="l">payments recorded</div>
            </div>
            <div className="tile">
              <div className="v">{batch.studentsCreated}</div>
              <div className="l">new students created</div>
            </div>
            <div className="tile">
              <div className="v">{batch.skipped}</div>
              <div className="l">rows left out</div>
            </div>
          </div>
          <div className="row" style={{ marginTop: 18 }}>
            <Link to="/app" className="btn">
              Open the dashboard
            </Link>
            <button type="button" className="btn secondary" onClick={reset}>
              Import another file
            </button>
          </div>
        </Card>
      ) : null}

      {store.data.imports.length > 0 ? (
        <Card className="rise">
          <div className="card-head">
            <h3>Import history</h3>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>File</th>
                  <th>Year</th>
                  <th className="num">Identified</th>
                  <th className="num">Imported</th>
                  <th className="num">Reviewed</th>
                  <th className="num">Left out</th>
                  <th className="num">Payments</th>
                  <th className="num">New students</th>
                </tr>
              </thead>
              <tbody>
                {store.data.imports.map((b) => (
                  <tr key={b.id}>
                    <td className="dim">{formatDateTime(b.at)}</td>
                    <td className="strong">{b.fileName}</td>
                    <td>{b.academicYear}</td>
                    <td className="num">{b.identified}</td>
                    <td className="num">{b.imported}</td>
                    <td className="num">{b.reviewed}</td>
                    <td className="num">{b.skipped}</td>
                    <td className="num">{b.paymentsAdded}</td>
                    <td className="num">{b.studentsCreated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
