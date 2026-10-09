import { useMemo, useState } from 'react';
import { formatDate } from '../../domain/dates';
import { formatINR } from '../../domain/money';
import type { Channel, FeeView, ReminderRecipient } from '../../domain/types';
import { useStore } from '../../store/store';
import { IconSend } from './Icons';
import { Modal } from './Modal';
import { useToast } from './Toast';

const LONG_TEMPLATE =
  'Dear Parent,\n\nThis is a reminder from {school} that the school fee for {student} (Class {class}, Adm. No. {admission}) has an outstanding balance of {outstanding}, due on {due_date}.\n\nYou can pay via UPI, bank transfer, or at the school office between 9 AM and 2 PM.\n\nThank you,\n{school}';
const SHORT_TEMPLATE = 'Dear Parent, fee of {outstanding} for {student} (Class {class}) is due on {due_date}. Pay via UPI or at the school office. - {school}';

/** Stock message per channel; SMS gets the short form. */
export const TEMPLATES: Record<Channel, string> = {
  WhatsApp: LONG_TEMPLATE,
  SMS: SHORT_TEMPLATE,
  Email: LONG_TEMPLATE,
};

const CHANNELS: Channel[] = ['WhatsApp', 'SMS', 'Email'];

export function fillTemplate(template: string, v: FeeView, school: string): string {
  return template
    .replace(/\{school\}/g, school)
    .replace(/\{student\}/g, v.student.name)
    .replace(/\{class\}/g, v.classLabel)
    .replace(/\{admission\}/g, v.student.admissionNo)
    .replace(/\{outstanding\}/g, formatINR(v.outstanding))
    .replace(/\{due_date\}/g, formatDate(v.record.dueDate))
    .replace(/\{guardian\}/g, v.student.guardianName || 'Parent');
}

export function ReminderComposer({ open, onClose, recipients }: { open: boolean; onClose: () => void; recipients: FeeView[] }) {
  const store = useStore();
  const toast = useToast();
  const [channel, setChannel] = useState<Channel>('WhatsApp');
  const [template, setTemplate] = useState(TEMPLATES.WhatsApp);
  const eligible = useMemo(() => recipients.filter((r) => r.outstanding > 0), [recipients]);
  const total = eligible.reduce((s, v) => s + v.outstanding, 0);
  const preview = eligible[0] ? fillTemplate(template, eligible[0], store.data.schoolName) : '';
  const missingContact = eligible.filter((r) => (channel === 'Email' ? !r.student.email : !r.student.phone)).length;

  // Switching channel swaps in that channel's stock message unless the text has been customised.
  const pickChannel = (c: Channel) => {
    setChannel(c);
    if (Object.values(TEMPLATES).includes(template)) setTemplate(TEMPLATES[c]);
  };

  const send = () => {
    const list: ReminderRecipient[] = eligible.map((v) => ({
      admissionNo: v.student.admissionNo,
      name: v.student.name,
      classLabel: v.classLabel,
      outstanding: v.outstanding,
      dueDate: v.record.dueDate,
      to: channel === 'Email' ? v.student.email : v.student.phone,
    }));
    store.sendReminders({ channel, message: template, recipients: list });
    toast({ title: 'Reminders sent!', sub: `${list.length} parent${list.length === 1 ? '' : 's'} notified via ${channel}` });
    onClose();
  };

  return (
    <Modal open={open} title="Send fee reminder" onClose={onClose} width={640}>
      <div className="stack">
        <p className="sub">
          To <strong>{eligible.length} parent{eligible.length === 1 ? '' : 's'}</strong> · {formatINR(total)} outstanding in total
        </p>
        <div className="field">
          <label>Channel</label>
          <div className="chips">
            {CHANNELS.map((c) => (
              <button key={c} type="button" className={`chip ${channel === c ? 'active' : ''}`} onClick={() => pickChannel(c)} aria-pressed={channel === c}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="rem-template">Message template</label>
          <textarea id="rem-template" className="textarea" value={template} onChange={(e) => setTemplate(e.target.value)} rows={channel === 'SMS' ? 3 : 7} />
          <span className="help">Placeholders: {'{student} {class} {admission} {outstanding} {due_date} {school} {guardian}'}</span>
        </div>
        {preview ? (
          <div className="field">
            <label>Preview for {eligible[0].student.name}</label>
            <div className="template-preview">{preview}</div>
          </div>
        ) : null}
        <div className="field">
          <label>Recipients</label>
          <ul className="recipients">
            {eligible.map((v) => (
              <li key={v.student.admissionNo}>
                <span>
                  {v.student.name} <span className="muted">· {v.classLabel} · {formatINR(v.outstanding)}</span>
                </span>
                <span className="muted">{channel === 'Email' ? v.student.email || 'no email' : v.student.phone || 'no mobile'}</span>
              </li>
            ))}
          </ul>
          {missingContact > 0 ? (
            <span className="help">
              {missingContact} recipient{missingContact === 1 ? ' has' : 's have'} no {channel === 'Email' ? 'email address' : 'mobile number'} on file.
            </span>
          ) : null}
        </div>
        <p className="help">Demo mode: reminders are recorded in the reminder log instead of being delivered. Connect an SMS, WhatsApp or email gateway to send them for real.</p>
        <div className="modal-foot">
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={send} disabled={eligible.length === 0}>
            <IconSend size={15} /> Send to {eligible.length} via {channel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
