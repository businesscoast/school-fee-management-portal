import { useMemo, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { formatDate } from '../../domain/dates';
import { summarize } from '../../domain/metrics';
import { formatINRCompact, formatPct } from '../../domain/money';
import { DEMO_EMAIL, useAuth } from '../../store/auth';
import { useStore } from '../../store/store';
import { IconLogo, IconWarning } from '../components/Icons';
import { useToast } from '../components/Toast';
import { Stat, Tag } from '../components/ui';

export function Login() {
  const auth = useAuth();
  const store = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || '/app';
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const s = useMemo(() => summarize(store.views), [store.views]);

  if (auth.user) return <Navigate to={from} replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err = auth.signIn({ email, password, remember });
    if (err) {
      setError(err);
      return;
    }
    setError('');
    toast({ title: 'Welcome back', sub: `Signed in to ${store.data.schoolName}` });
    navigate(from, { replace: true });
  };

  return (
    <div className="login">
      <div className="login-grid">
        <section className="card tint-lime login-hero rise">
          <a className="brand" href="/" aria-label="School Fee Intelligence home">
            <span className="brand-mark">
              <IconLogo size={22} />
            </span>
            <span>
              <span className="brand-name">School Fee Intelligence</span>
              <br />
              <span className="brand-sub">{store.data.schoolName}</span>
            </span>
          </a>
          <div>
            <Tag tone="green">Fee position · {store.year}</Tag>
            <h1 className="login-headline">See every fee at a glance.</h1>
            <p className="sub" style={{ marginTop: 10, maxWidth: 420 }}>
              Bring existing fee records in, see the collection position in under a minute, know exactly which students need attention, and act on it.
            </p>
          </div>
          <div className="stat-row">
            <Stat label="Students" value={s.totalStudents.toLocaleString('en-IN')} />
            <Stat label="Collected" value={formatPct(s.collectionPct)} hint={`of ${formatINRCompact(s.expected)} expected`} />
            <Stat label="Needs follow-up" value={(s.overdue + s.dueWithin3).toLocaleString('en-IN')} hint="overdue or due in 3 days" />
          </div>
          <p className="small muted" style={{ marginTop: 'auto' }}>
            Live figures from the {store.year} records · {formatDate(store.today)}
          </p>
        </section>

        <section className="card login-form rise">
          <div>
            <h2 className="h2">Sign in</h2>
            <p className="sub" style={{ marginTop: 6 }}>
              Use your school account to open the principal's dashboard.
            </p>
          </div>
          <form onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="login-email">Email</label>
              <input id="login-email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu" autoFocus />
            </div>
            <div className="field">
              <label htmlFor="login-password">Password</label>
              <div className="pw-field">
                <input id="login-password" className={`input ${error && password.length < 4 ? 'invalid' : ''}`} type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 4 characters" />
                <button type="button" className="toggle" onClick={() => setShow((v) => !v)} aria-pressed={show}>
                  {show ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div className="row between">
              <label className="row small" style={{ gap: 8 }}>
                <input type="checkbox" className="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Keep me signed in
              </label>
              <button type="button" className="btn ghost sm" onClick={() => toast({ title: 'Demo mode', sub: 'Any password of 4 or more characters works here.' })}>
                Forgot password?
              </button>
            </div>
            {error ? (
              <p className="issue error" role="alert" style={{ fontSize: 13.5, marginTop: 0 }}>
                <IconWarning size={15} /> {error}
              </p>
            ) : null}
            <button type="submit" className="btn wide">
              Sign in
            </button>
          </form>
          <div className="login-demo">
            <strong>Demo mode</strong>
            Any email and a password of at least 4 characters signs you in as the principal. Nothing leaves your browser; records live in local storage.
          </div>
        </section>
      </div>
      <p className="small muted login-foot">School Fee Intelligence · {store.data.schoolName}</p>
    </div>
  );
}
