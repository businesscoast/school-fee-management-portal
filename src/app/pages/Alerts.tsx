import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatDateShort, formatDateTime } from '../../domain/dates';
import { formatINR, formatINRCompact } from '../../domain/money';
import type { DueBucket, FeeView, Reminder } from '../../domain/types';
import { useStore } from '../../store/store';
import { IconClock, IconSend, IconWarning } from '../components/Icons';
import { Modal } from '../components/Modal';
import { ReminderComposer } from '../components/ReminderComposer';
import { useStudentDrawer } from '../components/StudentDrawer';
import { Table, type Column } from '../components/Table';
import { Card, StatusBadge, Tag } from '../components/ui';
import { dueText } from '../format';

type TabKey = 'overdue' | 'today' | 'within3' | 'within7';

interface TabDef {
  key: TabKey;
  label: string;
  desc: string;
  tone: '' | 'pink';
  Icon: typeof IconClock;
  buckets: DueBucket[];
  sentence: (n: number) => string;
}

const TABS: TabDef[] = [
  { key: 'overdue', label: 'Overdue', desc: 'Due date has passed and a balance remains', tone: 'pink', Icon: IconWarning, buckets: ['overdue'], sentence: (n) => `${n} student${n === 1 ? ' has' : 's have'} not completed payment after the due date.` },
  { key: 'today', label: 'Due today', desc: 'Payment due today', tone: '', Icon: IconClock, buckets: ['today'], sentence: (n) => `${n} student${n === 1 ? ' has' : 's have'} payments due today.` },
  { key: 'within3', label: 'Due within 3 days', desc: 'Includes today', tone: '', Icon: IconClock, buckets: ['today', 'within3'], sentence: (n) => `${n} student${n === 1 ? ' has' : 's have'} outstanding fees due within 3 days.` },
  { key: 'within7', label: 'Due within 7 days', desc: 'Includes today and the next 3 days', tone: '', Icon: IconClock, buckets: ['today', 'within3', 'within7'], sentence: (n) => `${n} student${n === 1 ? ' has' : 's have'} fees due within the next 7 days.` },
];

export function Alerts() {
  const store = useStore();
  const drawer = useStudentDrawer();
  const [params, setParams] = useSearchParams();
  const tabKey = (TABS.find((t) => t.key === params.get('tab'))?.key ?? 'within3') as TabKey;
  const tab = TABS.find((t) => t.key === tabKey)!;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [composer, setComposer] = useState<{ list: FeeView[]; fromSelection: boolean } | null>(null);
  const [viewing, setViewing] = useState<Reminder | null>(null);

  const lists = useMemo(() => Object.fromEntries(TABS.map((t) => [t.key, store.views.filter((v) => t.buckets.includes(v.bucket))])) as Record<TabKey, FeeView[]>, [store.views]);
  const rows = useMemo(() => lists[tabKey].slice().sort((a, b) => a.daysToDue - b.daysToDue || b.outstanding - a.outstanding), [lists, tabKey]);
  const total = rows.reduce((s, v) => s + v.outstanding, 0);
  const allSelected = rows.length > 0 && rows.every((v) => selected.has(v.student.admissionNo));
  const selectedViews = store.views.filter((v) => selected.has(v.student.admissionNo));
  const yearReminders = store.data.reminders.filter((r) => r.academicYear === store.year);

  const toggle = (adm: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(adm)) next.delete(adm);
      else next.add(adm);
      return next;
    });

  const columns: Column<FeeView>[] = [
    {
      key: 'sel',
      header: <input type="checkbox" className="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((v) => v.student.admissionNo)))} aria-label="Select all" />,
      width: '36px',
      render: (v) => <input type="checkbox" className="checkbox" checked={selected.has(v.student.admissionNo)} onChange={() => toggle(v.student.admissionNo)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${v.student.name}`} />,
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
    { key: 'class', header: 'Class', render: (v) => v.classLabel, sort: (v) => v.classLabel },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v.status} /> },
    { key: 'paid', header: 'Paid', align: 'right', render: (v) => <span className="dim">{formatINR(v.paid)}</span>, sort: (v) => v.paid },
    { key: 'out', header: 'Balance', align: 'right', render: (v) => <span className="strong">{formatINR(v.outstanding)}</span>, sort: (v) => v.outstanding },
    {
      key: 'due',
      header: 'Due date',
      render: (v) => (
        <span>
          {formatDateShort(v.record.dueDate)}
          <br />
          <span className={`small ${v.bucket === 'overdue' ? 'due-overdue' : 'due-soon'}`}>{dueText(v)}</span>
        </span>
      ),
      sort: (v) => v.record.dueDate,
    },
    { key: 'contact', header: 'Parent contact', render: (v) => <span className="dim">{v.student.phone || '—'}</span> },
    {
      key: 'act',
      header: '',
      align: 'right',
      render: (v) => (
        <button
          type="button"
          className="btn ghost sm"
          onClick={(e) => {
            e.stopPropagation();
            setComposer({ list: [v], fromSelection: false });
          }}
          aria-label={`Send reminder to ${v.student.name}`}
        >
          <IconSend size={14} /> Remind
        </button>
      ),
    },
  ];

  return (
    <div className="stack">
      <div className="grid cols-4">
        {TABS.map((t) => {
          const list = lists[t.key];
          const amount = list.reduce((s, v) => s + v.outstanding, 0);
          return (
            <button
              key={t.key}
              type="button"
              className={`card rise ${t.key === tabKey ? 'tint-pink' : ''}`}
              style={{ textAlign: 'left', cursor: 'pointer' }}
              onClick={() => {
                setParams({ tab: t.key }, { replace: true });
                setSelected(new Set());
              }}
              aria-pressed={t.key === tabKey}
            >
              <Tag tone={t.tone}>
                <t.Icon size={13} />
                {t.label}
              </Tag>
              <div className="hero-num" style={{ marginTop: 14, fontSize: 32 }}>
                {list.length}
              </div>
              <div className="hero-sub">{t.sentence(list.length)}</div>
              <div className="small muted" style={{ marginTop: 8 }}>
                {formatINRCompact(amount)} outstanding
              </div>
            </button>
          );
        })}
      </div>

      <Card className="rise">
        <div className="card-head">
          <div>
            <h3>{tab.label}</h3>
            <span className="meta">
              {tab.desc} · {formatINR(total)} outstanding · {rows.length} student{rows.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="row">
            <button type="button" className="btn secondary sm" disabled={rows.length === 0} onClick={() => setSelected(new Set(rows.map((v) => v.student.admissionNo)))}>
              Select all {rows.length}
            </button>
            <button type="button" className="btn sm" disabled={rows.length === 0} onClick={() => setComposer({ list: rows, fromSelection: false })}>
              <IconSend size={14} /> Remind all
            </button>
          </div>
        </div>
        <Table rows={rows} columns={columns} rowKey={(v) => v.student.admissionNo} onRowClick={(v) => drawer.open(v.student.admissionNo)} pageSize={25} rowClass={(v) => (selected.has(v.student.admissionNo) ? 'selected' : '')} empty={<div className="empty"><strong>Nothing here</strong>No students fall into this window right now.</div>} />
        <p className="help" style={{ marginTop: 10 }}>
          View students → select students → send reminder. Click a row to open the fee drawer.
        </p>
      </Card>

      {selected.size > 0 ? (
        <div className="action-bar">
          <span>
            <strong>{selected.size}</strong> selected · {formatINR(selectedViews.reduce((sum, v) => sum + v.outstanding, 0))} outstanding
          </span>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn ghost sm" onClick={() => setSelected(new Set())}>
            Clear
          </button>
          <button type="button" className="btn sm" onClick={() => setComposer({ list: selectedViews, fromSelection: true })}>
            <IconSend size={14} /> Send reminder
          </button>
        </div>
      ) : null}

      <Card className="rise">
        <div className="card-head">
          <h3>Reminder history · {store.year}</h3>
          <span className="meta">{yearReminders.length} batch{yearReminders.length === 1 ? '' : 'es'}</span>
        </div>
        {yearReminders.length === 0 ? (
          <div className="empty">
            <strong>No reminders sent yet</strong>
            Select students above and send a reminder. Each batch is logged here with its recipients.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Sent</th>
                  <th>Channel</th>
                  <th className="num">Recipients</th>
                  <th className="num">Outstanding covered</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {yearReminders.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDateTime(r.sentAt)}</td>
                    <td className="strong">{r.channel}</td>
                    <td className="num">{r.recipients.length}</td>
                    <td className="num">{formatINR(r.recipients.reduce((s, x) => s + x.outstanding, 0))}</td>
                    <td className="num">
                      <button type="button" className="btn secondary sm" onClick={() => setViewing(r)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ReminderComposer
        open={composer !== null}
        onClose={() => {
          if (composer?.fromSelection) setSelected(new Set());
          setComposer(null);
        }}
        recipients={composer?.list ?? []}
      />

      <Modal open={viewing !== null} title={viewing ? `${viewing.channel} reminder · ${formatDateTime(viewing.sentAt)}` : ''} onClose={() => setViewing(null)} width={620}>
        {viewing ? (
          <div className="stack">
            <div className="template-preview">{viewing.message}</div>
            <ul className="recipients" style={{ maxHeight: 280 }}>
              {viewing.recipients.map((x) => (
                <li key={x.admissionNo}>
                  <span>
                    {x.name} <span className="muted">· {x.classLabel}</span>
                  </span>
                  <span className="muted">
                    {formatINR(x.outstanding)} · {x.to || 'no contact'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
