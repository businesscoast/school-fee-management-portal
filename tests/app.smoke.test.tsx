// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../src/App';
import { SESSION_KEY, writeSession } from '../src/store/auth';

const signedIn = () => writeSession({ name: 'Anita Mehra', email: 'anita.mehra@sunrisepublic.school', role: 'Principal', signedInAt: '2026-10-09T09:00:00.000Z' }, true);

function mount(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  signedIn();
  window.matchMedia = ((query: string) => ({ matches: false, media: query, onchange: null, addListener: () => undefined, removeListener: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined, dispatchEvent: () => false })) as typeof window.matchMedia;
});
afterEach(cleanup);

describe('every screen renders from a fresh seed', () => {
  it('landing mosaic', () => {
    mount('/');
    expect(screen.getByRole('main', { name: 'Product feature overview' })).toBeTruthy();
    expect(screen.getByText('Reminders sent!')).toBeTruthy();
    expect(screen.getByText('Open dashboard')).toBeTruthy();
  });
  it("principal's dashboard", () => {
    mount('/app');
    expect(screen.getByRole('heading', { name: "Principal's dashboard" })).toBeTruthy();
    expect(screen.getByText('Requires attention')).toBeTruthy();
    expect(screen.getByText('Total students')).toBeTruthy();
    expect(screen.getByText('1,248')).toBeTruthy();
    expect(screen.getByText(/students have payments due within 3 days/)).toBeTruthy();
    // KPI strip, collection rate, follow-up, payment status and class bars from the management POC.
    expect(screen.getByText('Expected fees')).toBeTruthy();
    expect(screen.getByText('Collection rate')).toBeTruthy();
    expect(screen.getByText('Needs follow-up')).toBeTruthy();
    expect(screen.getByText('Payment status')).toBeTruthy();
    expect(screen.getByText('Collection report')).toBeTruthy();
    expect(screen.getByText('Outstanding by class')).toBeTruthy();
    expect(screen.getByText('Fully paid', { selector: '.status-box .l' })).toBeTruthy();
  });
  it('login page signs the principal in and the guard sends visitors there', () => {
    localStorage.removeItem(SESSION_KEY);
    mount('/app/alerts?tab=overdue');
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByText('Demo mode')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('alert').textContent).toContain('at least 4 characters');
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'demo1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    // Back to the page that was requested before the redirect.
    expect(screen.getByRole('heading', { name: 'Alerts & follow-ups' })).toBeTruthy();
    expect(localStorage.getItem(SESSION_KEY)).toContain('Anita Mehra');
  });
  it('signing out from the account menu returns to the login page', () => {
    mount('/app');
    fireEvent.click(screen.getByRole('button', { name: /^Account: Anita Mehra/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
  it('shell has the year dropdown, bell and breadcrumb', () => {
    mount('/app/students');
    const year = screen.getByLabelText('Academic year') as HTMLSelectElement;
    expect(year.tagName).toBe('SELECT');
    expect(year.value).toBe('2026-27');
    expect(within(year).getByText('2026-27 (current)')).toBeTruthy();
    fireEvent.change(year, { target: { value: '2025-26' } });
    expect(year.value).toBe('2025-26');
    expect(screen.getByText('Historical records.', { exact: false })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Alerts/ })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Breadcrumb' })).toBeTruthy();
    expect(screen.getByText('Anita Mehra')).toBeTruthy();
  });
  it('students list with filters and selection', () => {
    mount('/app/students?status=Overdue');
    expect(screen.getByRole('heading', { name: 'Students' })).toBeTruthy();
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(5);
    const first = within(rows[1]).getByRole('checkbox');
    fireEvent.click(first);
    expect(screen.getByText('Send reminder')).toBeTruthy();
    expect(screen.getByText('Export CSV')).toBeTruthy();
    expect(screen.getByText('With balance')).toBeTruthy();
  });
  it('students due-date dropdown narrows the list', () => {
    mount('/app/students');
    const due = screen.getByLabelText('Due date') as HTMLSelectElement;
    expect(due.tagName).toBe('SELECT');
    const before = screen.getAllByRole('row').length;
    fireEvent.change(due, { target: { value: 'today' } });
    const after = screen.getAllByRole('row').length;
    expect(after).toBeLessThan(before);
    expect(screen.getAllByText('Due today', { selector: 'td span' }).length).toBe(after - 1);
  });
  it('student drawer opens from a row and from a deep link', () => {
    mount('/app/students?student=1001');
    const drawer = screen.getByRole('dialog', { name: 'Rahul Sharma fee profile' });
    expect(within(drawer).getByText(/Admission No\. 1001/)).toBeTruthy();
    expect(within(drawer).getByText('Record a payment')).toBeTruthy();
    expect(within(drawer).getByText('Open full profile')).toBeTruthy();
    fireEvent.click(within(drawer).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    const rows = screen.getAllByRole('row');
    fireEvent.click(rows[1]);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
  it('recording a payment in the drawer updates the balance', () => {
    mount('/app/students?student=1001');
    const drawer = screen.getByRole('dialog', { name: 'Rahul Sharma fee profile' });
    const amount = within(drawer).getByLabelText('Amount (₹)') as HTMLInputElement;
    expect(amount.value).toBe('10000');
    fireEvent.change(amount, { target: { value: '4000' } });
    fireEvent.click(within(drawer).getByRole('button', { name: /Record ₹4,000/ }));
    expect(screen.getByText('Payment recorded')).toBeTruthy();
    expect(within(drawer).getByText('₹6,000', { selector: '.kv-tiles .v' })).toBeTruthy();
  });
  it('student fee profile with payment history', () => {
    mount('/app/students/1001');
    expect(screen.getByRole('heading', { name: 'Rahul Sharma' })).toBeTruthy();
    expect(screen.getByText(/Admission No: 1001/)).toBeTruthy();
    expect(screen.getByText('₹10,000', { selector: '.stat .value' })).toBeTruthy();
    expect(screen.getAllByText(/Partially Paid/).length).toBeGreaterThan(0);
  });
  it('import wizard upload step', () => {
    mount('/app/import');
    expect(screen.getByRole('heading', { name: 'Bring your records in.' })).toBeTruthy();
    expect(screen.getAllByText('Use this sample')).toHaveLength(2);
  });
  it('alerts with the four windows, remind-all and per-row remind', () => {
    mount('/app/alerts?tab=overdue');
    expect(screen.getByText(/have not completed payment after the due date/)).toBeTruthy();
    expect(screen.getByText('Reminder history · 2026-27')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Remind all/ })).toBeTruthy();
    const remindButtons = screen.getAllByRole('button', { name: /^Send reminder to / });
    expect(remindButtons.length).toBeGreaterThan(0);
    fireEvent.click(remindButtons[0]);
    expect(screen.getByRole('dialog', { name: 'Send fee reminder' })).toBeTruthy();
    expect(screen.getByText('1 parent', { exact: false })).toBeTruthy();
  });
  it('class-wise, collections, reports and settings', () => {
    mount('/app/classes');
    expect(screen.getByText('Class-wise fee overview', { selector: 'h3' })).toBeTruthy();
    expect(screen.getAllByRole('img', { name: /% collected/ }).length).toBeGreaterThan(5);
    cleanup();
    mount('/app/collections');
    expect(screen.getByText('Collected this year')).toBeTruthy();
    cleanup();
    mount('/app/reports');
    expect(screen.getByText('Academic year comparison')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Download .* as CSV$/ })).toHaveLength(7);
    expect(screen.getByRole('heading', { name: 'Fee Collection Report' })).toBeTruthy();
    fireEvent.click(screen.getByText('Overdue Report'));
    expect(screen.getByRole('heading', { name: 'Overdue Report' })).toBeTruthy();
    cleanup();
    mount('/app/settings');
    expect(screen.getByText('Academic years')).toBeTruthy();
    expect(screen.getByText('2026-27', { selector: '.year-card.current .y' })).toBeTruthy();
  });
});
