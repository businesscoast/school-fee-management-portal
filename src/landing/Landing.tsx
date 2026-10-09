import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { IconLogo, IconWhatsApp } from '../app/components/Icons';
import '../styles/landing.css';

declare global {
  interface Window {
    __entrancePlayed?: boolean;
    __entranceFailsafe?: number;
  }
}

/** Runs the one-shot entrance: fonts (or a 700ms deadline) → entrance-run for 1850ms → static styles. */
function useEntrance() {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('landing-root');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let deadline: number | undefined;
    let finish: number | undefined;
    if (reduce || window.__entrancePlayed) {
      window.clearTimeout(window.__entranceFailsafe);
      html.classList.remove('motion-pending', 'entrance-run');
    } else {
      window.__entrancePlayed = true;
      html.classList.add('motion-pending');
      const wait = new Promise<void>((resolve) => {
        deadline = window.setTimeout(resolve, 700);
      });
      const fonts = 'fonts' in document ? document.fonts.ready.then(() => undefined) : Promise.resolve();
      void Promise.race([fonts, wait]).then(() => {
        window.clearTimeout(window.__entranceFailsafe);
        html.classList.remove('motion-pending');
        html.classList.add('entrance-run');
        finish = window.setTimeout(() => html.classList.remove('entrance-run'), 1850);
      });
    }
    return () => {
      window.clearTimeout(deadline);
      window.clearTimeout(finish);
      html.classList.remove('landing-root', 'motion-pending', 'entrance-run');
    };
  }, []);
}

const BARS: { label: string; value: number; display: string }[] = [
  { label: '5-A', value: 14000, display: '₹14k' },
  { label: '6-A', value: 18000, display: '₹18k' },
  { label: '7-A', value: 22000, display: '₹22k' },
  { label: '6-B', value: 35000, display: '₹35k' },
  { label: '9-A', value: 41000, display: '₹41k' },
  { label: '7-B', value: 58000, display: '₹58k' },
  { label: '8-A', value: 95000, display: '₹95k' },
];

export function Landing() {
  useEntrance();
  const max = BARS[BARS.length - 1].value;
  return (
    <div className="landing">
      <header className="landing-chrome">
        <Link to="/" className="wordmark">
          <i>
            <IconLogo size={20} />
          </i>
          School Fee Intelligence
        </Link>
        <nav className="actions" aria-label="Product">
          <Link to="/app/import" className="cta quiet">
            Import records
          </Link>
          <Link to="/app" className="cta">
            Open dashboard
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>
        </nav>
      </header>

      <div className="stage" role="main" aria-label="Product feature overview">
        <section className="card notif" aria-label="Reminder notification">
          <div className="toast-wrap">
            <div className="toast-ledge" />
            <div className="toast">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <defs>
                  <mask id="sparkle-hole">
                    <rect width="24" height="24" fill="#fff" />
                    <path d="M12 3.8c.6 4.6 3.6 7.6 8.2 8.2-4.6.6-7.6 3.6-8.2 8.2-.6-4.6-3.6-7.6-8.2-8.2 4.6-.6 7.6-3.6 8.2-8.2z" fill="#000" />
                  </mask>
                </defs>
                <circle cx="12" cy="12" r="12" fill="#000" mask="url(#sparkle-hole)" />
                <path d="M12 6.6c.4 3.1 2.3 5 5.4 5.4-3.1.4-5 2.3-5.4 5.4-.4-3.1-2.3-5-5.4-5.4 3.1-.4 5-2.3 5.4-5.4z" fill="#000" />
              </svg>
              <div>
                <div className="t-title">Reminders sent!</div>
                <div className="t-sub">18 parents notified about fees due in 3 days</div>
              </div>
              <span className="t-time">2:34 PM</span>
            </div>
          </div>
        </section>

        <section className="card connect" aria-label="Record sources">
          <h2>
            Bring your
            <br />
            records in.
          </h2>
          <p className="sub">Excel, PDF and scanned registers</p>
          <div className="chips-abs">
            <div className="chip-row r1">
              <span className="chip">
                Excel register
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="4.5" fill="#1d6f42" />
                  <path d="M8.5 8l7 8M15.5 8l-7 8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </span>
            </div>
            <div className="chip-row r2">
              <span className="chip">
                CSV
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 3h8l5 5v13H6z" fill="#fff" stroke="#141414" strokeWidth="1.6" strokeLinejoin="round" />
                  <path d="M14 3v5h5" fill="none" stroke="#141414" strokeWidth="1.6" strokeLinejoin="round" />
                  <path d="M9 13h7M9 16.5h7" stroke="#5f8b3e" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
              <span className="chip">
                PDF report
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 3h8l5 5v13H6z" fill="#fff" stroke="#141414" strokeWidth="1.6" strokeLinejoin="round" />
                  <path d="M14 3v5h5" fill="none" stroke="#141414" strokeWidth="1.6" strokeLinejoin="round" />
                  <rect x="4" y="12" width="12.5" height="6" rx="2" fill="#d93025" />
                </svg>
              </span>
            </div>
            <div className="chip-row r3">
              <span className="chip">
                Scans
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 7l1.3-2.4h3.4L15 7" fill="#141414" />
                  <rect x="3" y="7" width="18" height="13" rx="3.5" fill="#141414" />
                  <circle cx="12" cy="13.5" r="3.6" fill="#fff" />
                  <circle cx="12" cy="13.5" r="1.6" fill="#141414" />
                </svg>
              </span>
              <span className="chip">
                Receipts
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 2.5h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z" fill="#fff" stroke="#141414" strokeWidth="1.6" strokeLinejoin="round" />
                  <path d="M9 7.5h6M9 11h6M9 14.5h4" stroke="#141414" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </span>
            </div>
          </div>
          <span className="chip chip-float">
            WhatsApp
            <IconWhatsApp size={21} />
          </span>
        </section>

        <section className="card automate" aria-label="See every fee at a glance">
          <div className="copy">
            <h2>
              <span className="g">See</span> every fee at a glance.
              <br />
              Act before it's overdue.
            </h2>
            <p className="sub">Upload the registers you already have. Know who to call today.</p>
          </div>
          <div className="illo" aria-hidden="true">
            <div className="win win-back">
              <div className="bar-title">
                <i />
                <i />
                <i />
              </div>
              <div className="body">
                <div className="strip" />
              </div>
            </div>
            <div className="win win-front">
              <div className="bar-title">
                <i />
                <i />
                <i />
              </div>
              <div className="body">
                <div className="strip" />
              </div>
            </div>
            <div className="pill-wf">
              <span className="tick">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#161616" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              479 records imported
            </div>
            <div className="pill-ai">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.5 12.5c.3 2.1 1 2.8 3 3.1-2 .3-2.7 1-3 3.1-.3-2.1-1-2.8-3-3.1 2-.3 2.7-1 3-3.1z" fill="#eff4e6" stroke="#4f7433" strokeWidth="2.2" strokeLinejoin="round" />
                <path d="M9.5 2.5c.5 4.8 2.6 6.9 7.4 7.4-4.8.5-6.9 2.6-7.4 7.4-.5-4.8-2.6-6.9-7.4-7.4 4.8-.5 6.9-2.6 7.4-7.4z" fill="#eff4e6" stroke="#4f7433" strokeWidth="2.25" strokeLinejoin="round" />
              </svg>
              <div className="lines">
                <i />
                <i />
              </div>
            </div>
            <svg className="cursor" viewBox="0 0 24 28" aria-hidden="true">
              <path d="M4.5 2.5v19.2l4.9-4.6 3.4 7.4 3.3-1.5-3.3-7.3h6.6z" fill="#fff" stroke="#2b2b2b" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
          </div>
        </section>

        <section className="card insights" aria-label="Outstanding by class">
          <span className="tag">Outstanding by class</span>
          <h2>₹6.4L</h2>
          <p className="sub">outstanding this term</p>
          <div className="chart" role="img" aria-label={`Outstanding per class: ${BARS.map((b) => `${b.label} ${b.display}`).join(', ')}`}>
            {BARS.map((b, i) => (
              <div key={b.label} className="col">
                <div className={`bar ${i === BARS.length - 1 ? 'hi' : ''}`} style={{ height: `${(265 * b.value) / max}rem` }}>
                  {b.display}
                </div>
                <span className="day">{b.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card search" aria-label="Search">
          <h2>
            Find any student{' '}
            <br />
            instantly
          </h2>
          <Link to="/app/students" className="bar-search" aria-label="Search students">
            <span className="mag">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="7.1" stroke="#121212" strokeWidth="2.2" />
                <path d="M16.3 16.3L21 21" stroke="#121212" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </span>
            <span className="ph">Search by name, admission no. or class...</span>
            <svg className="mic" viewBox="0 0 16 20" aria-hidden="true">
              <rect x="5" y="1" width="6" height="11" rx="3" fill="#141414" />
              <path d="M2.5 9.5a5.5 5.5 0 0 0 11 0" fill="none" stroke="#141414" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M8 15v3M5 18.5h6" fill="none" stroke="#141414" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </Link>
        </section>
      </div>
    </div>
  );
}
