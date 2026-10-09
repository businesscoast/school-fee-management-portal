import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { formatDate, formatDateShort } from '../../domain/dates';
import { formatINR, formatPct } from '../../domain/money';
import { PAYMENT_MODES, type FeeView, type PaymentMode } from '../../domain/types';
import { useStore, type StoreApi } from '../../store/store';
import { dueText, initials } from '../format';
import { IconClose, IconMail, IconPhone, IconPlus, IconSend } from './Icons';
import { ReminderComposer } from './ReminderComposer';
import { useToast } from './Toast';
import { StatusBadge } from './ui';

interface DrawerApi {
  open: (admissionNo: string) => void;
  close: () => void;
  current: string | null;
}

const DrawerContext = createContext<DrawerApi>({ open: () => undefined, close: () => undefined, current: null });

/** Opens the slide-in student fee drawer from any page inside the app shell. */
export function useStudentDrawer(): DrawerApi {
  return useContext(DrawerContext);
}

export function StudentDrawerProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<string | null>(null);
  const location = useLocation();
  const prevPath = useRef(location.pathname);

  // Close when the page changes, but not on the initial render (deep links open the drawer on mount).
  useEffect(() => {
    if (prevPath.current !== location.pathname) {
      prevPath.current = location.pathname;
      setCurrent(null);
    }
  }, [location.pathname]);

  const close = useCallback(() => setCurrent(null), []);
  const api = useMemo<DrawerApi>(() => ({ open: setCurrent, close, current }), [close, current]);

  return (
    <DrawerContext.Provider value={api}>
      {children}
      {current ? <StudentDrawer admissionNo={current} onClose={close} /> : null}
    </DrawerContext.Provider>
  );
}

function findView(store: StoreApi, admissionNo: string): FeeView | undefined {
  const inYear = store.views.find((v) => v.student.admissionNo === admissionNo);
  if (inYear) return inYear;
  for (let i = store.data.years.length - 1; i >= 0; i--) {
    const v = store.viewsFor(store.data.years[i]).find((x) => x.student.admissionNo === admissionNo);
    if (v) return v;
  }
  return undefined;
}

function dueTone(v: FeeView): string {
  if (v.outstanding <= 0) return 'muted';
  if (v.bucket === 'overdue') return 'due-overdue';
  if (v.bucket === 'today' || v.bucket === 'within3') return 'due-soon';
  if (v.bucket === 'within7') return 'due-week';
  return 'muted';
}

function StudentDrawer({ admissionNo, onClose }: { admissionNo: string; onClose: () => void }) {
  const store = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const view = useMemo(() => findView(store, admissionNo), [store, admissionNo]);
  const [composer, setComposer] = useState(false);
  const outstanding = view?.outstanding ?? 0;
  const [pay, setPay] = useState({ amount: outstanding > 0 ? String(outstanding) : '', date: store.today, mode: 'UPI' as PaymentMode, receiptNo: '' });

  // A fresh form whenever the student changes or a payment lands.
  useEffect(() => {
    setPay({ amount: outstanding > 0 ? String(outstanding) : '', date: store.today, mode: 'UPI', receiptNo: '' });
  }, [admissionNo, outstanding, store.today]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !composer) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [composer, onClose]);

  if (!view) {
    return (
      <>
        <div className="drawer-backdrop" onMouseDown={onClose} />
        <aside className="drawer" role="dialog" aria-modal="true" aria-label="Student not found">
          <div className="drawer-head">
            <h2>Student not found</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <IconClose size={18} />
            </button>
          </div>
          <div className="drawer-body">
            <div className="empty">
              <strong>No record for admission number {admissionNo}</strong>
              It may belong to a different academic year or has not been imported yet.
            </div>
          </div>
        </aside>
      </>
    );
  }

  const student = view.student;
  const ratio = view.record.totalFee > 0 ? Math.min(1, view.paid / view.record.totalFee) : 1;
  const amount = Number(pay.amount);
  const payValid = amount > 0 && amount <= view.outstanding + 0.001 && !!pay.date;

  const record = () => {
    store.addPayment({ admissionNo, year: view.record.academicYear, amount, date: pay.date, mode: pay.mode, receiptNo: pay.receiptNo });
    toast({ title: 'Payment recorded', sub: `${formatINR(amount)} received from ${student.name}` });
  };
  const viewClass = () => {
    onClose();
    navigate(`/app/students?class=${encodeURIComponent(view.record.className)}${view.record.section ? `&section=${encodeURIComponent(view.record.section)}` : ''}`);
  };
  const openProfile = () => {
    onClose();
    navigate(`/app/students/${admissionNo}`);
  };

  return (
    <>
      <div className="drawer-backdrop" onMouseDown={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`${student.name} fee profile`}>
        <div className="drawer-head">
          <span className="avatar">{initials(student.name)}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2>{student.name}</h2>
            <p className="sub" style={{ marginTop: 2 }}>
              Admission No. {student.admissionNo} · Class {view.classLabel} · {view.record.academicYear}
            </p>
            <div className="row" style={{ marginTop: 8 }}>
              <StatusBadge status={view.status} />
              <span className={`small ${dueTone(view)}`}>{dueText(view)}</span>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose size={18} />
          </button>
        </div>

        <div className="drawer-body">
          <div className="kv-tiles">
            <div className="tile">
              <div className="k">Total fee</div>
              <div className="v">{formatINR(view.record.totalFee)}</div>
            </div>
            <div className="tile">
              <div className="k">Paid</div>
              <div className="v">{formatINR(view.paid)}</div>
            </div>
            <div className="tile">
              <div className="k">Outstanding</div>
              <div className="v" style={{ color: view.outstanding > 0 ? 'var(--overdue-fg)' : 'var(--paid-fg)' }}>
                {formatINR(view.outstanding)}
              </div>
            </div>
          </div>
          <div className="progress" style={{ marginTop: 14 }} role="img" aria-label={`${formatPct(ratio)} collected`}>
            <span style={{ width: `${ratio * 100}%` }} />
          </div>
          <p className="small muted" style={{ marginTop: 6 }}>
            {formatPct(ratio)} collected · Due date <strong style={{ color: 'var(--ink)' }}>{formatDate(view.record.dueDate)}</strong>
          </p>

          <div className="section-title">Parent / guardian</div>
          <dl className="kv">
            <dt>Name</dt>
            <dd>{student.guardianName || '—'}</dd>
            <dt>
              <IconPhone size={14} />
            </dt>
            <dd>{student.phone || '—'}</dd>
            <dt>
              <IconMail size={14} />
            </dt>
            <dd>{student.email || '—'}</dd>
          </dl>

          <div className="section-title">Payment history · {view.record.academicYear}</div>
          {view.payments.length === 0 ? (
            <p className="small muted">No payments recorded yet.</p>
          ) : (
            <ul className="timeline">
              {view.payments
                .slice()
                .reverse()
                .map((p) => (
                  <li key={p.id}>
                    <span className="dim">{formatDateShort(p.date)}</span>
                    <span>
                      <span className="strong">{p.receiptNo}</span>
                      <br />
                      <span className="muted small">{p.mode}</span>
                    </span>
                    <span className="row" style={{ gap: 8, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                      <span className="amt">{formatINR(p.amount)}</span>
                      <span className="badge paid">Received</span>
                    </span>
                  </li>
                ))}
            </ul>
          )}

          {view.outstanding > 0 ? (
            <>
              <div className="section-title">Record a payment</div>
              <div className="pay-form">
                <div className="field">
                  <label htmlFor="drawer-pay-amount">Amount (₹)</label>
                  <input id="drawer-pay-amount" className={`input sm ${pay.amount && !payValid ? 'invalid' : ''}`} type="number" min={1} max={view.outstanding} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="drawer-pay-date">Date</label>
                  <input id="drawer-pay-date" className="input sm" type="date" value={pay.date} max={store.today} onChange={(e) => setPay({ ...pay, date: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="drawer-pay-mode">Mode</label>
                  <select id="drawer-pay-mode" className="select sm" value={pay.mode} onChange={(e) => setPay({ ...pay, mode: e.target.value as PaymentMode })}>
                    {PAYMENT_MODES.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="drawer-pay-receipt">Receipt No.</label>
                  <input id="drawer-pay-receipt" className="input sm" value={pay.receiptNo} placeholder="Generated if left blank" onChange={(e) => setPay({ ...pay, receiptNo: e.target.value })} />
                </div>
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <button type="button" className="btn sm" onClick={record} disabled={!payValid}>
                  <IconPlus size={14} /> Record {amount > 0 ? formatINR(amount) : 'payment'}
                </button>
                <button type="button" className="chip" style={{ height: 32 }} onClick={() => setPay({ ...pay, amount: String(view.outstanding) })}>
                  Full balance {formatINR(view.outstanding)}
                </button>
              </div>
            </>
          ) : null}
        </div>

        <div className="drawer-foot">
          {view.outstanding > 0 ? (
            <button type="button" className="btn sm" onClick={() => setComposer(true)}>
              <IconSend size={14} /> Send reminder
            </button>
          ) : null}
          <button type="button" className="btn secondary sm" onClick={viewClass}>
            View class {view.classLabel}
          </button>
          <button type="button" className="btn secondary sm" onClick={openProfile} style={{ marginLeft: 'auto' }}>
            Open full profile
          </button>
        </div>
      </aside>
      <ReminderComposer open={composer} onClose={() => setComposer(false)} recipients={[view]} />
    </>
  );
}
