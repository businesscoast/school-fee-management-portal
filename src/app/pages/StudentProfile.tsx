import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatDate, formatDateShort, formatDateTime } from '../../domain/dates';
import { formatINR } from '../../domain/money';
import { PAYMENT_MODES, type PaymentMode } from '../../domain/types';
import { useStore } from '../../store/store';
import { IconBack, IconMail, IconPhone, IconTrash } from '../components/Icons';
import { Modal } from '../components/Modal';
import { ReminderComposer } from '../components/ReminderComposer';
import { useToast } from '../components/Toast';
import { Card, Stat, StatusBadge } from '../components/ui';
import { dueText, initials } from '../format';

export function StudentProfile() {
  const { admissionNo = '' } = useParams();
  const store = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [feeOpen, setFeeOpen] = useState(false);
  const [composer, setComposer] = useState(false);

  const student = store.data.students.find((s) => s.admissionNo === admissionNo);
  const history = useMemo(() => store.data.years.map((y) => store.viewsFor(y).find((v) => v.student.admissionNo === admissionNo)).filter((v) => v !== undefined), [store, admissionNo]);
  const view = history.find((v) => v.record.academicYear === store.year) ?? history[history.length - 1];
  const reminders = useMemo(() => store.data.reminders.filter((r) => r.recipients.some((x) => x.admissionNo === admissionNo)), [store.data.reminders, admissionNo]);

  const [pay, setPay] = useState({ amount: '', date: store.today, mode: 'UPI' as PaymentMode, receiptNo: '' });
  const [edit, setEdit] = useState({ name: student?.name ?? '', guardianName: student?.guardianName ?? '', phone: student?.phone ?? '', email: student?.email ?? '' });
  const [fee, setFee] = useState({ totalFee: String(view?.record.totalFee ?? ''), dueDate: view?.record.dueDate ?? '' });

  if (!student || !view) {
    return (
      <Card>
        <div className="empty">
          <strong>Student not found</strong>
          No record for admission number {admissionNo}. <Link to="/app/students">Back to students</Link>
        </div>
      </Card>
    );
  }

  const amount = Number(pay.amount);
  const payValid = amount > 0 && amount <= view.outstanding + 0.001 && !!pay.date;

  const submitPayment = () => {
    store.addPayment({ admissionNo, year: view.record.academicYear, amount, date: pay.date, mode: pay.mode, receiptNo: pay.receiptNo });
    toast({ title: 'Payment recorded', sub: `${formatINR(amount)} received from ${student.name}` });
    setPayOpen(false);
    setPay({ amount: '', date: store.today, mode: 'UPI', receiptNo: '' });
  };

  const submitEdit = () => {
    store.upsertStudent({ admissionNo, ...edit, name: edit.name.trim() || student.name });
    toast({ title: 'Details updated', sub: `${edit.name || student.name}'s contact details saved` });
    setEditOpen(false);
  };

  const submitFee = () => {
    const total = Number(fee.totalFee);
    if (!(total >= 0) || !fee.dueDate) return;
    store.updateFeeRecord(view.record.id, { totalFee: total, dueDate: fee.dueDate });
    toast({ title: 'Fee record updated', sub: `${formatINR(total)} due ${formatDate(fee.dueDate)}` });
    setFeeOpen(false);
  };

  return (
    <div className="stack">
      <button type="button" className="btn ghost sm" onClick={() => navigate(-1)} style={{ alignSelf: 'flex-start' }}>
        <IconBack size={16} /> Back
      </button>
      <Card tint={view.status === 'Overdue' ? 'pink' : view.status === 'Fully Paid' ? 'lime' : 'peach'} className="rise">
        <div className="profile-head">
          <span className="avatar">{initials(student.name)}</span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h2 className="h2">{student.name}</h2>
            <p className="sub" style={{ marginTop: 4 }}>
              Admission No: {student.admissionNo} · Class: {view.classLabel} · Academic Year: {view.record.academicYear}
            </p>
            <div className="row" style={{ marginTop: 10 }}>
              <StatusBadge status={view.status} />
              <span className="small">{dueText(view)}</span>
            </div>
          </div>
          <div className="row">
            <button type="button" className="btn secondary sm" onClick={() => setEditOpen(true)}>
              Edit details
            </button>
            <button type="button" className="btn secondary sm" onClick={() => setComposer(true)} disabled={view.outstanding <= 0}>
              Send reminder
            </button>
            <button type="button" className="btn sm" onClick={() => setPayOpen(true)} disabled={view.outstanding <= 0}>
              Record payment
            </button>
          </div>
        </div>
        <div className="stat-row" style={{ marginTop: 22 }}>
          <Stat label="Total fee" value={formatINR(view.record.totalFee)} hint={view.record.feeStructure} />
          <Stat label="Paid" value={formatINR(view.paid)} hint={`${view.payments.length} payment${view.payments.length === 1 ? '' : 's'}`} />
          <Stat label="Outstanding" value={formatINR(view.outstanding)} />
          <Stat
            label="Due date"
            value={formatDateShort(view.record.dueDate)}
            hint={
              <button type="button" className="btn ghost sm" style={{ padding: 0, height: 'auto', fontSize: 12.5 }} onClick={() => setFeeOpen(true)}>
                Change fee or due date
              </button>
            }
          />
        </div>
      </Card>

      <div className="grid cols-2">
        <Card className="rise">
          <div className="card-head">
            <h3>Payment history · {view.record.academicYear}</h3>
          </div>
          {view.payments.length === 0 ? (
            <div className="empty">
              <strong>No payments recorded</strong>
              Record a payment or import a receipt file to build the history.
            </div>
          ) : (
            <ul className="timeline">
              {view.payments
                .slice()
                .reverse()
                .map((p) => (
                  <li key={p.id}>
                    <span>{formatDate(p.date)}</span>
                    <span>
                      <span className="strong">{p.receiptNo}</span>
                      <br />
                      <span className="muted small">
                        {p.mode}
                        {p.note ? ` · ${p.note}` : ''}
                      </span>
                    </span>
                    <span className="row">
                      <span className="amt">{formatINR(p.amount)}</span>
                      {p.source !== 'seed' ? (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label="Delete payment"
                          onClick={() => {
                            if (window.confirm(`Delete receipt ${p.receiptNo} for ${formatINR(p.amount)}?`)) store.deletePayment(p.id);
                          }}
                        >
                          <IconTrash size={15} />
                        </button>
                      ) : null}
                    </span>
                  </li>
                ))}
            </ul>
          )}
          <p className="small muted" style={{ marginTop: 12 }}>
            Current status: <strong>{view.status}</strong>
          </p>
        </Card>

        <div className="stack">
          <Card className="rise">
            <div className="card-head">
              <h3>Parent / guardian</h3>
            </div>
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
          </Card>
          <Card className="rise">
            <div className="card-head">
              <h3>Fee history by academic year</h3>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Class</th>
                    <th className="num">Total</th>
                    <th className="num">Paid</th>
                    <th className="num">Outstanding</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.record.id} className={h.record.academicYear === view.record.academicYear ? 'selected' : ''}>
                      <td className="strong">{h.record.academicYear}</td>
                      <td>{h.classLabel}</td>
                      <td className="num">{formatINR(h.record.totalFee)}</td>
                      <td className="num">{formatINR(h.paid)}</td>
                      <td className="num">{formatINR(h.outstanding)}</td>
                      <td>
                        <StatusBadge status={h.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card className="rise">
            <div className="card-head">
              <h3>Reminders sent</h3>
            </div>
            {reminders.length === 0 ? (
              <p className="small muted">No reminders have been sent to this family yet.</p>
            ) : (
              <ul className="activity">
                {reminders.map((r) => (
                  <li key={r.id}>
                    <span>
                      <strong>{r.channel}</strong> reminder · {formatINR(r.recipients.find((x) => x.admissionNo === admissionNo)?.outstanding ?? 0)} outstanding
                    </span>
                    <span className="when">{formatDateTime(r.sentAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Modal open={payOpen} title={`Record payment · ${student.name}`} onClose={() => setPayOpen(false)}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="pay-amount">Amount (outstanding {formatINR(view.outstanding)})</label>
            <input id="pay-amount" className={`input ${pay.amount && !payValid ? 'invalid' : ''}`} type="number" min={1} max={view.outstanding} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="pay-date">Payment date</label>
            <input id="pay-date" className="input" type="date" value={pay.date} max={store.today} onChange={(e) => setPay({ ...pay, date: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="pay-mode">Mode</label>
            <select id="pay-mode" className="select" value={pay.mode} onChange={(e) => setPay({ ...pay, mode: e.target.value as PaymentMode })}>
              {PAYMENT_MODES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pay-receipt">Receipt number (optional)</label>
            <input id="pay-receipt" className="input" value={pay.receiptNo} onChange={(e) => setPay({ ...pay, receiptNo: e.target.value })} placeholder="Generated if left blank" />
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="chip" onClick={() => setPay({ ...pay, amount: String(view.outstanding) })}>
            Full balance {formatINR(view.outstanding)}
          </button>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn secondary" onClick={() => setPayOpen(false)}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={submitPayment} disabled={!payValid}>
            Record {amount > 0 ? formatINR(amount) : 'payment'}
          </button>
        </div>
      </Modal>

      <Modal open={editOpen} title="Edit student details" onClose={() => setEditOpen(false)}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="ed-name">Student name</label>
            <input id="ed-name" className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="ed-guardian">Parent / guardian</label>
            <input id="ed-guardian" className="input" value={edit.guardianName} onChange={(e) => setEdit({ ...edit, guardianName: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="ed-phone">Mobile</label>
            <input id="ed-phone" className="input" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="ed-email">Email</label>
            <input id="ed-email" className="input" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn secondary" onClick={() => setEditOpen(false)}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={submitEdit}>
            Save
          </button>
        </div>
      </Modal>

      <Modal open={feeOpen} title={`Fee record · ${view.record.academicYear}`} onClose={() => setFeeOpen(false)}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="fee-total">Total fee</label>
            <input id="fee-total" className="input" type="number" min={0} value={fee.totalFee} onChange={(e) => setFee({ ...fee, totalFee: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="fee-due">Due date</label>
            <input id="fee-due" className="input" type="date" value={fee.dueDate} onChange={(e) => setFee({ ...fee, dueDate: e.target.value })} />
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn secondary" onClick={() => setFeeOpen(false)}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={submitFee}>
            Save
          </button>
        </div>
      </Modal>

      <ReminderComposer open={composer} onClose={() => setComposer(false)} recipients={[view]} />
    </div>
  );
}
