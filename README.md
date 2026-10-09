# School Fee Management & Intelligence Dashboard

A single place for a school to bring existing fee records in, see the fee position in under a minute, know exactly which students need attention, and act on it.

Built from the solution overview for school management: upload → extract → review → confirm → import, a principal's dashboard, student fee profiles, due-date alerts that turn into reminders, class-wise and collection overviews, seven reports, and academic-year management.

## Run it

```bash
npm install
npm run dev        # http://localhost:5180
```

Other scripts:

```bash
npm test           # unit tests for the fee logic, importer and seed data, plus a render smoke test per screen
npm run typecheck  # TypeScript
npm run build      # production build into dist/
npm run preview    # serve the production build
```

Node 22 or newer. No backend, no API keys: everything runs in the browser and is saved in the browser's local storage. Use **Academic years & settings → Export backup** to move data between machines.

## What is in the app

Opening any `/app` page asks you to **sign in** first. The sign-in is a mock: any email and a password of at least four characters creates a session (kept in local storage with "Keep me signed in", otherwise for the tab only). Sign out from the account menu in the top bar.

The shell carries an **academic year dropdown**, a bell with the follow-up count (overdue plus due within 3 days), a breadcrumb with today's date, the signed-in principal, and a collapsible sidebar grouped into *Navigation*, *Fee records* and *Data*.

| Screen | What it does |
| --- | --- |
| `/` | Product landing mosaic (the five-card composition with the one-shot entrance choreography). |
| `/login` | Mock sign-in page in the same design: live fee position on the left, email / password form with show-password, "keep me signed in" and a demo-mode note on the right. |
| Principal's dashboard | KPI strip (students, expected, collected, outstanding), collection-rate card with a collected / outstanding / expected footer, follow-up card with overdue / due today / due in 7 days, clickable payment-status boxes, a "requires attention" list ranked by severity, a month-by-month collection report (total, average per month, best month, current month marked in progress), outstanding by section as horizontal bars, recent imports and reminders, quick search. Every number links to the students behind it. |
| Students | Search; class, section and **due-date** dropdowns (overdue, due today, within 3 days, within 7 days); payment-status filter including *With balance*; overdue students sort first; select students and send a reminder; **Export CSV**. Clicking a row opens the **student drawer**. |
| Student drawer | Slide-in panel from any list: fee, paid and outstanding tiles, collection meter, due-date status, parent contact, payment history, **record a payment** inline, send a reminder, jump to the class, or open the full profile. Deep link: `/app/students?student=1001`. |
| Student fee profile | Full page: total fee, paid, outstanding, due date, payment history, guardian contact, fee history across academic years, reminders sent. Record a payment, edit details, change the fee or due date. |
| Import records | Drop an Excel, CSV, PDF or photo/scan of a register. Columns are mapped automatically (adjustable), each row is checked, low-confidence rows are held for review with in-place editing, then the import is confirmed. Two generated sample files reproduce the proposal's "486 identified, 479 ready, 7 require review" walkthrough. |
| Alerts & follow-ups | Four windows (overdue, due today, due within 3 days, due within 7 days) with counts and amounts → select students → send reminder, **Remind all**, or **Remind** a single row. The reminder composer switches between WhatsApp, SMS and email templates with a live preview. Reminders are logged; connect a messaging gateway to deliver them for real. |
| Class-wise | Per section or per class: students, status counts, overdue badge, collection meter, expected, collected, outstanding (highest marked). Click through to that class's students with a balance. |
| Collections | Collected this year and this month, monthly trend for this year and the previous one, payment-mode breakdown, latest payments. |
| Reports | Academic-year comparison table, then seven **report cards** (Fee Collection, Student Outstanding, Due-Date, Overdue, Class-Wise, Payment History, Academic Year), each with *View* and *Download CSV*. The selected report renders below with its filters, CSV export and print. |
| Academic years & settings | Add a year (optionally promoting students), set the current year, edit the fee structure per class, school name, backup / restore / reset. |

## How the data model works

- **Student** (admission number, name, guardian, mobile, email) is shared across years.
- **Fee record** is one per student per academic year: class, section, fee structure label, total fee, due date.
- **Payment** rows hang off a fee record: date, amount, receipt number, mode.
- Paid, outstanding and status are always derived from payments, never stored. Status is *Fully Paid*, *Partially Paid* or *Unpaid*; a student with a balance past the due date is shown as *Overdue*.
- Academic years run June to May.

### Import rules

- Rows match existing students by admission number inside the target year; unknown admission numbers create new students.
- "One student per row" files give the **total paid so far**; only an increase over what is already recorded becomes a new payment. "One receipt per row" files add each receipt's amount.
- Errors (missing admission number, non-numeric amount, paid above total, invalid date, duplicate receipt, new student without a class) block a row until fixed or skipped. Warnings (name differs from file, balance mismatch, defaults applied) lower confidence; below 80 % the row is held for review.
- PDF tables are read from the text layer; scanned PDFs and images go through on-device text recognition (Tesseract) and start with lower confidence.

## Demo data

The first run seeds a school of 1,248 students in classes 1–10 across three academic years, anchored to today's date so alerts are always meaningful. Counts follow the proposal's examples (1,071 fully paid, 103 partial, 74 unpaid, 31 overdue, 23 due within 3 days, class 8 highest outstanding, Rahul Sharma admission 1001 in 8-A with ₹15,000 of ₹25,000 paid). Amounts use a realistic annual fee per class rather than the illustrative figures in the proposal. Reset at any time from settings.

## Stack

Vite, React 19, TypeScript, react-router 7, Vitest. SheetJS for Excel/CSV, PDF.js for PDF text, Tesseract.js for scans (loaded on demand; the recognition model is fetched from a CDN the first time). Handcrafted CSS; the only external resource is the Plus Jakarta Sans font.
