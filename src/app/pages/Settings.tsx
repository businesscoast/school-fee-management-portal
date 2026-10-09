import { useMemo, useState } from 'react';
import { nextAcademicYear } from '../../domain/dates';
import { summarize } from '../../domain/metrics';
import { formatINR, formatINRCompact, formatPct } from '../../domain/money';
import { classSortKey } from '../../domain/status';
import type { AppData } from '../../domain/types';
import { CLASSES, DATA_VERSION } from '../../store/seed';
import { useStore } from '../../store/store';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { Card, Tag } from '../components/ui';
import { downloadText } from '../format';

export function Settings() {
  const store = useStore();
  const toast = useToast();
  const [schoolName, setSchoolName] = useState(store.data.schoolName);
  const [feeYear, setFeeYear] = useState(store.year);
  const [fees, setFees] = useState<Record<string, string>>(() => toStrings(store.data.feeStructure[store.year] ?? {}));
  const [applyToRecords, setApplyToRecords] = useState(false);
  const [promote, setPromote] = useState(true);
  const [resetOpen, setResetOpen] = useState(false);
  const years = store.data.years;
  const nextYear = nextAcademicYear(years[years.length - 1]);

  const yearStats = useMemo(() => Object.fromEntries(years.map((y) => [y, summarize(store.viewsFor(y))])), [years, store]);

  function toStrings(s: Record<string, number>): Record<string, string> {
    return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, String(v)]));
  }

  const chooseFeeYear = (y: string) => {
    setFeeYear(y);
    setFees(toStrings(store.data.feeStructure[y] ?? {}));
  };

  const saveFees = () => {
    const structure: Record<string, number> = {};
    for (const [cls, v] of Object.entries(fees)) {
      const n = Number(v);
      if (v !== '' && Number.isFinite(n) && n >= 0) structure[cls] = n;
    }
    store.setFeeStructure(feeYear, structure, applyToRecords);
    toast({ title: 'Fee structure saved', sub: `${feeYear}${applyToRecords ? ' · existing records updated' : ''}` });
  };

  const addYear = () => {
    store.addYear(nextYear, { promote });
    toast({ title: `${nextYear} added`, sub: promote ? 'Students promoted with the new fee structure' : 'Empty year ready for import' });
  };

  const exportBackup = () => downloadText(`school-fee-backup-${store.today}.json`, JSON.stringify(store.data), 'application/json');

  const importBackup = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as AppData;
      if (parsed.version !== DATA_VERSION || !Array.isArray(parsed.students) || !Array.isArray(parsed.feeRecords)) throw new Error('bad');
      store.replaceData(parsed);
      toast({ title: 'Backup restored', sub: `${parsed.students.length} students · ${parsed.years.join(', ')}` });
    } catch {
      toast({ title: 'Could not read backup', sub: 'The file is not a backup from this app.' });
    }
  };

  const classKeys = [...new Set([...CLASSES, ...Object.keys(store.data.feeStructure[feeYear] ?? {})])].sort((a, b) => classSortKey(a) - classSortKey(b));

  return (
    <div className="stack">
      <Card className="rise">
        <div className="card-head">
          <h3>Academic years</h3>
          <span className="meta">Each year keeps its own fee structure, records and reports.</span>
        </div>
        <div className="year-cards">
          {years.map((y) => {
            const s = yearStats[y];
            const kind = y === store.data.currentYear ? 'Current academic year' : y < store.data.currentYear ? 'Historical records' : 'Future / new year';
            return (
              <div key={y} className={`year-card ${y === store.data.currentYear ? 'current' : ''}`}>
                <div className="k">{kind}</div>
                <div className="y">{y}</div>
                <p className="small" style={{ marginTop: 6 }}>
                  {s.totalStudents.toLocaleString('en-IN')} students · {formatINRCompact(s.collected)} of {formatINRCompact(s.expected)} collected ({formatPct(s.collectionPct)})
                </p>
                <div className="row" style={{ marginTop: 12 }}>
                  <button type="button" className="btn secondary sm" onClick={() => store.setYear(y)}>
                    View {y}
                  </button>
                  {y !== store.data.currentYear ? (
                    <button type="button" className="btn ghost sm" onClick={() => store.setCurrentYear(y)}>
                      Set as current
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
          <div className="year-card" style={{ background: 'var(--tint-cool)' }}>
            <div className="k">Add the next year</div>
            <div className="y">{nextYear}</div>
            <label className="row small" style={{ marginTop: 8, gap: 8 }}>
              <input type="checkbox" className="checkbox" checked={promote} onChange={(e) => setPromote(e.target.checked)} />
              Promote students from {years[years.length - 1]} into it
            </label>
            <div className="row" style={{ marginTop: 12 }}>
              <button type="button" className="btn sm" onClick={addYear}>
                Add {nextYear}
              </button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid cols-2">
        <Card className="rise">
          <div className="card-head">
            <h3>Fee structure</h3>
            <select className="select sm" value={feeYear} onChange={(e) => chooseFeeYear(e.target.value)} aria-label="Year" style={{ width: 130 }}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <p className="help" style={{ marginBottom: 12 }}>
            Annual fee per class for {feeYear}. New students imported without a fee amount use these values.
          </p>
          <div className="fee-grid">
            {classKeys.map((cls) => (
              <div key={cls} className="field">
                <label htmlFor={`fee-${cls}`}>Class {cls}</label>
                <input id={`fee-${cls}`} className="input sm" type="number" min={0} step={500} value={fees[cls] ?? ''} onChange={(e) => setFees({ ...fees, [cls]: e.target.value })} />
              </div>
            ))}
          </div>
          <label className="row small" style={{ marginTop: 14, gap: 8 }}>
            <input type="checkbox" className="checkbox" checked={applyToRecords} onChange={(e) => setApplyToRecords(e.target.checked)} />
            Also update the total fee on existing {feeYear} records
          </label>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="btn sm" onClick={saveFees}>
              Save fee structure
            </button>
            <span className="small muted">Currently {formatINR(Object.values(store.data.feeStructure[feeYear] ?? {}).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(store.data.feeStructure[feeYear] ?? {}).length))} average per class</span>
          </div>
        </Card>

        <div className="stack">
          <Card className="rise">
            <div className="card-head">
              <h3>School</h3>
            </div>
            <div className="field">
              <label htmlFor="school-name">School name (used in reminders)</label>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input id="school-name" className="input" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => {
                    store.setSchoolName(schoolName.trim() || store.data.schoolName);
                    toast({ title: 'Saved', sub: schoolName });
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </Card>
          <Card tint="cool" className="rise">
            <div className="card-head">
              <h3>Data</h3>
              <Tag tone="cool">Stored in this browser</Tag>
            </div>
            <p className="sub" style={{ marginBottom: 12 }}>
              Records live in this browser's local storage. Export a backup before clearing the browser, and restore it on another machine.
            </p>
            <div className="row">
              <button type="button" className="btn secondary sm" onClick={exportBackup}>
                Export backup (JSON)
              </button>
              <label className="btn secondary sm" style={{ cursor: 'pointer' }}>
                Restore backup
                <input type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && void importBackup(e.target.files[0])} />
              </label>
              <button type="button" className="btn danger sm" onClick={() => setResetOpen(true)}>
                Reset demo data
              </button>
            </div>
            <p className="help" style={{ marginTop: 12 }}>
              Demo data seeded on {store.data.seededAt}: {store.data.students.length.toLocaleString('en-IN')} students, {store.data.payments.length.toLocaleString('en-IN')} payments, {store.data.years.length} academic years.
            </p>
          </Card>
        </div>
      </div>

      <Modal open={resetOpen} title="Reset demo data?" onClose={() => setResetOpen(false)}>
        <p className="sub">This replaces everything in this browser with a fresh set of demo records anchored to today's date. Imports, payments and reminders you added will be lost. Export a backup first if you want to keep them.</p>
        <div className="modal-foot">
          <button type="button" className="btn secondary" onClick={() => setResetOpen(false)}>
            Keep my data
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              store.resetData();
              setResetOpen(false);
              toast({ title: 'Demo data reset', sub: 'Fresh records generated for the current academic year' });
            }}
          >
            Reset
          </button>
        </div>
      </Modal>
    </div>
  );
}
