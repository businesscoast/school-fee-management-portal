import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatDateShort, monthKey, monthLabelLong, prevAcademicYear } from '../../domain/dates';
import { monthlyCollection, paymentModeBreakdown, summarize } from '../../domain/metrics';
import { formatINR, formatINRCompact, formatPct } from '../../domain/money';
import { useStore } from '../../store/store';
import { BarChart } from '../components/BarChart';
import { Card, Stat, Tag } from '../components/ui';

export function Collections() {
  const store = useStore();
  const views = store.views;
  const prevYear = prevAcademicYear(store.year);
  const hasPrev = store.data.years.includes(prevYear);
  const prevViews = useMemo(() => (hasPrev ? store.viewsFor(prevYear) : []), [store, hasPrev, prevYear]);
  const s = useMemo(() => summarize(views), [views]);
  const months = useMemo(() => monthlyCollection(views, store.year), [views, store.year]);
  const prevMonths = useMemo(() => monthlyCollection(prevViews, prevYear), [prevViews, prevYear]);
  const modes = useMemo(() => paymentModeBreakdown(views), [views]);
  const thisMonth = monthKey(store.today);
  const thisMonthPoint = months.find((m) => m.key === thisMonth);
  const payments = useMemo(
    () =>
      views
        .flatMap((v) => v.payments.map((p) => ({ p, v })))
        .sort((a, b) => (a.p.date < b.p.date ? 1 : a.p.date > b.p.date ? -1 : 0))
        .slice(0, 15),
    [views],
  );
  const paymentCount = views.reduce((n, v) => n + v.payments.length, 0);

  const toBars = (points: typeof months) => points.map((m) => ({ key: m.key, label: m.label, value: m.amount, display: m.amount ? formatINRCompact(m.amount) : '', detail: `${monthLabelLong(m.key)}: ${formatINR(m.amount)} from ${m.count} payment${m.count === 1 ? '' : 's'}` }));

  return (
    <div className="stack">
      <Card tint="lime" className="rise">
        <Tag tone="green">Collection overview · {store.year}</Tag>
        <div className="stat-row" style={{ marginTop: 18 }}>
          <Stat label="Collected this year" value={formatINR(s.collected)} hint={`${formatPct(s.collectionPct)} of ${formatINRCompact(s.expected)} expected`} large />
          <Stat label={thisMonthPoint ? monthLabelLong(thisMonthPoint.key) : 'This month'} value={formatINR(thisMonthPoint?.amount ?? 0)} hint={`${thisMonthPoint?.count ?? 0} payments`} />
          <Stat label="Payments recorded" value={paymentCount.toLocaleString('en-IN')} hint={paymentCount ? `avg ${formatINR(s.collected / paymentCount)}` : undefined} />
          <Stat label="Still outstanding" value={formatINR(s.outstanding)} hint={<Link to="/app/students?status=Outstanding">View students</Link>} />
        </div>
      </Card>

      <div className="grid cols-2">
        <Card className="rise">
          <div className="card-head">
            <h3>Monthly collection · {store.year}</h3>
            <span className="meta">June to May</span>
          </div>
          <BarChart items={toBars(months)} height={230} ariaLabel={`Monthly collection ${store.year}: ${months.map((m) => `${m.label} ${formatINRCompact(m.amount)}`).join(', ')}`} />
        </Card>
        <Card className="rise">
          <div className="card-head">
            <h3>Monthly collection · {prevYear}</h3>
            <span className="meta">{hasPrev ? 'Previous year, same scale per chart' : 'No previous year on record'}</span>
          </div>
          {hasPrev ? (
            <BarChart items={toBars(prevMonths)} height={230} ariaLabel={`Monthly collection ${prevYear}: ${prevMonths.map((m) => `${m.label} ${formatINRCompact(m.amount)}`).join(', ')}`} />
          ) : (
            <div className="empty">
              <strong>Nothing to compare</strong>
              Add the previous academic year from settings or import its register.
            </div>
          )}
        </Card>
      </div>

      <div className="grid cols-2">
        <Card className="rise">
          <div className="card-head">
            <h3>Month by month</h3>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="num">{store.year}</th>
                  {hasPrev ? <th className="num">{prevYear}</th> : null}
                  <th className="num">Payments</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m, i) => (
                  <tr key={m.key}>
                    <td className="strong">{monthLabelLong(m.key)}</td>
                    <td className="num">{formatINR(m.amount)}</td>
                    {hasPrev ? <td className="num dim">{formatINR(prevMonths[i]?.amount ?? 0)}</td> : null}
                    <td className="num dim">{m.count}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="num">{formatINR(months.reduce((t, m) => t + m.amount, 0))}</td>
                  {hasPrev ? <td className="num">{formatINR(prevMonths.reduce((t, m) => t + m.amount, 0))}</td> : null}
                  <td className="num">{paymentCount}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
        <div className="stack">
          <Card className="rise">
            <div className="card-head">
              <h3>By payment mode</h3>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Mode</th>
                    <th className="num">Payments</th>
                    <th className="num">Amount</th>
                    <th className="num">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {modes.map((m) => (
                    <tr key={m.mode}>
                      <td className="strong">{m.mode}</td>
                      <td className="num">{m.count}</td>
                      <td className="num">{formatINR(m.amount)}</td>
                      <td className="num dim">{formatPct(s.collected ? m.amount / s.collected : 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card className="rise">
            <div className="card-head">
              <h3>Latest payments</h3>
              <Link to="/app/reports" className="meta">
                Full payment history
              </Link>
            </div>
            <ul className="timeline">
              {payments.map(({ p, v }) => (
                <li key={p.id}>
                  <span className="dim">{formatDateShort(p.date)}</span>
                  <span>
                    <Link to={`/app/students/${v.student.admissionNo}`} className="strong">
                      {v.student.name}
                    </Link>
                    <br />
                    <span className="muted small">
                      {v.classLabel} · {p.receiptNo} · {p.mode}
                    </span>
                  </span>
                  <span className="amt">{formatINR(p.amount)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
