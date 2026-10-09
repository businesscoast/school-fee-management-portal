import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { academicYearFor, formatDateTime, monthKey, monthLabelLong } from '../../domain/dates';
import { formatINR, formatINRCompact, formatPct } from '../../domain/money';
import { classRows, monthlyCollection, sectionRows, summarize } from '../../domain/metrics';
import { useStore } from '../../store/store';
import { BarChart } from '../components/BarChart';
import { IconAlerts, IconCheck, IconChevron, IconClasses, IconClock, IconImport, IconRupee, IconSearch, IconSend, IconUsers, IconWarning } from '../components/Icons';
import { Card, HBars, StackedStatus, Stat, Tag } from '../components/ui';

type Severity = 'critical' | 'serious' | 'warning' | 'info';

interface Attention {
  key: string;
  sev: Severity;
  Icon: typeof IconWarning;
  num: string;
  text: string;
  small: string;
  to: string;
}

const n = (v: number) => v.toLocaleString('en-IN');
const studentsWord = (count: number, verb: [string, string]) => `student${count === 1 ? ` ${verb[0]}` : `s ${verb[1]}`}`;

export function Dashboard() {
  const store = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const views = store.views;
  const s = useMemo(() => summarize(views), [views]);
  const sections = useMemo(() => sectionRows(views), [views]);
  const classes = useMemo(() => classRows(views), [views]);
  const allMonths = useMemo(() => monthlyCollection(views, store.year), [views, store.year]);

  // The collection report only runs up to the current month when looking at the current academic year.
  const isCurrentYear = academicYearFor(store.today) === store.year;
  const thisMonth = monthKey(store.today);
  const months = isCurrentYear ? allMonths.filter((m) => m.key <= thisMonth) : allMonths;
  const monthBars = months.map((m) => ({
    key: m.key,
    label: m.label,
    value: m.amount,
    display: m.amount ? formatINRCompact(m.amount) : '',
    detail: `${monthLabelLong(m.key)}${isCurrentYear && m.key === thisMonth ? ' (so far)' : ''}: ${formatINR(m.amount)} from ${m.count} payment${m.count === 1 ? '' : 's'}`,
    ghost: isCurrentYear && m.key === thisMonth,
  }));
  const collectedInMonths = months.reduce((t, m) => t + m.amount, 0);
  const avgPerMonth = months.length ? collectedInMonths / months.length : 0;
  const bestMonth = months.reduce<(typeof months)[number] | null>((best, m) => (best === null || m.amount > best.amount ? m : best), null);

  const due3Amount = useMemo(() => views.reduce((t, v) => (v.bucket === 'today' || v.bucket === 'within3' ? t + v.outstanding : t), 0), [views]);
  const topSections = useMemo(() => sections.filter((r) => r.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding).slice(0, 7), [sections]);
  const hbars = topSections.map((r) => ({ key: r.label, label: r.label, value: r.outstanding, display: formatINRCompact(r.outstanding), detail: `${r.label}: ${formatINR(r.outstanding)} outstanding across ${r.students - r.fullyPaid} students` }));
  const worstSection = topSections[0];
  const withBalance = s.partiallyPaid + s.unpaid;
  const followUp = s.overdue + s.dueWithin3;

  const attention: Attention[] = [];
  if (s.overdue > 0) attention.push({ key: 'overdue', sev: 'critical', Icon: IconWarning, num: n(s.overdue), text: `${studentsWord(s.overdue, ['has', 'have'])} overdue payments`, small: `${formatINRCompact(s.overdueAmount)} past the due date`, to: '/app/alerts?tab=overdue' });
  if (s.dueToday > 0) attention.push({ key: 'today', sev: 'serious', Icon: IconClock, num: n(s.dueToday), text: `${studentsWord(s.dueToday, ['has', 'have'])} payments due today`, small: 'Reminder recommended', to: '/app/alerts?tab=today' });
  if (s.dueWithin3 > 0) attention.push({ key: 'within3', sev: 'warning', Icon: IconClock, num: n(s.dueWithin3), text: `${studentsWord(s.dueWithin3, ['has', 'have'])} payments due within 3 days`, small: `${formatINRCompact(due3Amount)} expected`, to: '/app/alerts?tab=within3' });
  attention.push({ key: 'outstanding', sev: 'info', Icon: IconRupee, num: formatINRCompact(s.outstanding), text: 'is currently outstanding', small: `${n(withBalance)} students have a balance`, to: '/app/students?status=Outstanding' });
  if (s.topOutstandingClass) {
    attention.push({ key: 'class', sev: 'info', Icon: IconClasses, num: formatINRCompact(s.topOutstandingClass.outstanding), text: `${s.topOutstandingClass.label} has the highest outstanding amount`, small: worstSection ? `${worstSection.label} highest at ${formatINRCompact(worstSection.outstanding)}` : '', to: '/app/classes' });
  }

  const activity = useMemo(() => {
    const items: { key: string; kind: 'import' | 'reminder'; title: string; sub: string; at: string }[] = [];
    for (const b of store.data.imports) items.push({ key: b.id, kind: 'import', title: `${b.fileName} imported into ${b.academicYear}`, sub: `${b.imported} records · ${b.paymentsAdded} payments · ${b.studentsCreated} new students`, at: b.at });
    for (const r of store.data.reminders) items.push({ key: r.id, kind: 'reminder', title: `${r.recipients.length} reminder${r.recipients.length === 1 ? '' : 's'} sent via ${r.channel}`, sub: r.recipients.slice(0, 3).map((x) => x.name).join(', ') + (r.recipients.length > 3 ? ` and ${r.recipients.length - 3} more` : ''), at: r.sentAt });
    return items.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 6);
  }, [store.data.imports, store.data.reminders]);

  const openSection = (label: string) => {
    const r = topSections.find((x) => x.label === label);
    if (!r) return;
    navigate(`/app/students?class=${encodeURIComponent(r.className)}${r.section ? `&section=${encodeURIComponent(r.section)}` : ''}&status=Outstanding`);
  };

  return (
    <div className="dash">
      <Card className="flat kpi-strip span-3 rise">
        <Link className="kpi" to="/app/students">
          <span className="ico lime">
            <IconUsers size={20} />
          </span>
          <span>
            <span className="value">{n(s.totalStudents)}</span>
            <span className="label">Total students</span>
            <span className="hint">
              {sections.length} sections · {classes.length} classes
            </span>
          </span>
        </Link>
        <Link className="kpi" to="/app/students">
          <span className="ico peach">
            <IconRupee size={20} />
          </span>
          <span>
            <span className="value">{formatINRCompact(s.expected)}</span>
            <span className="label">Expected fees</span>
            <span className="hint">Academic year {store.year}</span>
          </span>
        </Link>
        <Link className="kpi" to={`/app/students?status=${encodeURIComponent('Fully Paid')}`}>
          <span className="ico cool">
            <IconCheck size={20} />
          </span>
          <span>
            <span className="value">{formatINRCompact(s.collected)}</span>
            <span className="label">Fees collected</span>
            <span className="hint">{formatPct(s.collectionPct)} of expected</span>
          </span>
        </Link>
        <Link className="kpi" to="/app/students?status=Outstanding">
          <span className="ico pink">
            <IconWarning size={20} />
          </span>
          <span>
            <span className="value">{formatINRCompact(s.outstanding)}</span>
            <span className="label">Outstanding</span>
            <span className="hint">{n(withBalance)} students with a balance</span>
          </span>
        </Link>
      </Card>

      <Card tint="lime" className="rise support-card">
        <div className="body">
          <div className="row between">
            <Tag tone="green">Collection rate</Tag>
            <span className="small muted">{store.year}</span>
          </div>
          <div className="hero-num" style={{ marginTop: 16 }}>
            {formatPct(s.collectionPct)}
          </div>
          <div className="hero-sub">of {formatINRCompact(s.expected)} expected has been collected.</div>
          <div className="progress" style={{ marginTop: 14 }} role="img" aria-label={`${formatPct(s.collectionPct)} collected`}>
            <span style={{ width: `${Math.min(100, s.collectionPct * 100)}%` }} />
          </div>
        </div>
        <div className="support-foot dark">
          <Link to={`/app/students?status=${encodeURIComponent('Fully Paid')}`}>
            <span className="v">{formatINRCompact(s.collected)}</span>
            <span className="l">Collected</span>
          </Link>
          <Link to="/app/students?status=Outstanding">
            <span className="v">{formatINRCompact(s.outstanding)}</span>
            <span className="l">Outstanding</span>
          </Link>
          <Link to="/app/students">
            <span className="v">{formatINRCompact(s.expected)}</span>
            <span className="l">Expected</span>
          </Link>
        </div>
      </Card>

      <Card tint="pink" className="rise support-card">
        <div className="body">
          <div className="row between">
            <Tag tone="pink">Needs follow-up</Tag>
            <IconAlerts size={18} />
          </div>
          <div className="hero-num" style={{ marginTop: 16 }}>
            {n(followUp)}
          </div>
          <div className="hero-sub">students are overdue or due within the next 3 days.</div>
          <Link to="/app/alerts?tab=within3" className="btn sm" style={{ marginTop: 14 }}>
            <IconSend size={14} /> Go to follow-ups
          </Link>
        </div>
        <div className="support-foot">
          <Link to="/app/alerts?tab=overdue">
            <span className="v">{n(s.overdue)}</span>
            <span className="l">Overdue</span>
          </Link>
          <Link to="/app/alerts?tab=today">
            <span className="v">{n(s.dueToday)}</span>
            <span className="l">Due today</span>
          </Link>
          <Link to="/app/alerts?tab=within7">
            <span className="v">{n(s.dueWithin7)}</span>
            <span className="l">Due in 7 days</span>
          </Link>
        </div>
      </Card>

      <Card className="rise">
        <div className="card-head">
          <h3>Payment status</h3>
          <span className="meta">Click a status to see the students</span>
        </div>
        <div className="status-row">
          <Link to={`/app/students?status=${encodeURIComponent('Fully Paid')}`} className="status-box">
            <i className="dot paid" />
            <span>
              <span className="n">{n(s.fullyPaid)}</span>
              <span className="l">Fully paid</span>
            </span>
          </Link>
          <Link to={`/app/students?status=${encodeURIComponent('Partially Paid')}`} className="status-box">
            <i className="dot partial" />
            <span>
              <span className="n">{n(s.partiallyPaid)}</span>
              <span className="l">Partially paid</span>
            </span>
          </Link>
          <Link to="/app/students?status=Unpaid" className="status-box">
            <i className="dot unpaid" />
            <span>
              <span className="n">{n(s.unpaid)}</span>
              <span className="l">Unpaid</span>
            </span>
          </Link>
        </div>
        <div style={{ marginTop: 16 }}>
          <StackedStatus fullyPaid={s.fullyPaid} partiallyPaid={s.partiallyPaid} unpaid={s.unpaid} legend="pct" />
        </div>
        <p className="small muted" style={{ marginTop: 12 }}>
          {n(s.overdue)} of the {n(withBalance)} with a balance are past their due date.
        </p>
      </Card>

      <Card className="rise">
        <div className="card-head">
          <h3>Requires attention</h3>
          <span className="badge overdue">{n(followUp)} urgent</span>
        </div>
        <div className="attention">
          {attention.map((a) => (
            <Link key={a.key} to={a.to}>
              <span className={`sev ${a.sev}`}>
                <a.Icon size={17} />
              </span>
              <span className="t">
                <span>
                  <b className="num">{a.num}</b> {a.text}
                </span>
                {a.small ? <small>{a.small}</small> : null}
              </span>
              <IconChevron size={16} className="go" />
            </Link>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 12 }}>
          Every important number leads to an action.
        </p>
      </Card>

      <Card tint="peach" className="rise">
        <div className="row between">
          <Tag>Outstanding by class</Tag>
          <Link to="/app/classes" className="btn secondary sm">
            View all
          </Link>
        </div>
        <div className="hero-num" style={{ marginTop: 16 }}>
          {formatINRCompact(s.outstanding)}
        </div>
        <div className="hero-sub">outstanding · top sections</div>
        {hbars.length ? (
          <div style={{ marginTop: 16 }}>
            <HBars items={hbars} ariaLabel={`Outstanding per section: ${hbars.map((b) => `${b.label} ${b.display}`).join(', ')}`} onSelect={(it) => openSection(it.key)} />
          </div>
        ) : (
          <p className="sub" style={{ marginTop: 20 }}>
            Nothing outstanding. Every fee for this year has been collected.
          </p>
        )}
        <p className="help" style={{ marginTop: 12 }}>
          Click a section to see its students with a balance.
        </p>
      </Card>

      <Card tint="lavender" className="rise quick-search">
        <h3 className="h2">
          Find anything
          <br />
          instantly
        </h3>
        <form
          className="qbar"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(`/app/students?q=${encodeURIComponent(q.trim())}`);
          }}
        >
          <span className="mag">
            <IconSearch size={18} />
          </span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, admission no. or class" aria-label="Search students" />
        </form>
      </Card>

      <Card className="span-2 rise">
        <div className="card-head">
          <h3>Collection report</h3>
          <Link to="/app/collections" className="meta">
            Details
          </Link>
        </div>
        <div className="chart-stats">
          <Stat label="Total collected" value={formatINRCompact(s.collected)} />
          <Stat label="Average per month" value={formatINRCompact(avgPerMonth)} />
          <Stat label="Best month" value={bestMonth && bestMonth.amount > 0 ? monthLabelLong(bestMonth.key) : '—'} />
        </div>
        <BarChart items={monthBars} height={200} ariaLabel={`Monthly collection: ${monthBars.map((b) => `${b.label} ${b.display || '0'}`).join(', ')}`} />
        <div className="chart-legend">
          <span>
            <i className="hi" />
            Best month
          </span>
          <span>
            <i />
            Collected
          </span>
          {isCurrentYear ? (
            <span>
              <i className="ghost" />
              Current month (in progress)
            </span>
          ) : null}
        </div>
      </Card>

      <Card className="rise">
        <div className="card-head">
          <h3>Recent activity</h3>
          <Link to="/app/import" className="meta">
            Import records
          </Link>
        </div>
        {activity.length === 0 ? (
          <div className="empty">
            <strong>No imports or reminders yet</strong>
            Upload an existing fee register or send a reminder from the alerts page and it will show up here.
          </div>
        ) : (
          <ul className="activity">
            {activity.map((a) => (
              <li key={a.key}>
                <span className={`ic ${a.kind === 'import' ? 'lime' : 'pink'}`}>{a.kind === 'import' ? <IconImport size={17} /> : <IconAlerts size={17} />}</span>
                <span style={{ minWidth: 0 }}>
                  <strong>{a.title}</strong>
                  <br />
                  <span className="muted small">{a.sub}</span>
                  <br />
                  <span className="muted small">{formatDateTime(a.at)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
