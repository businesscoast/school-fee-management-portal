import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { academicYearStart, addDays, nowISO, todayISO } from '../domain/dates';
import { newId } from '../domain/ids';
import type { ImportBatch } from '../domain/types';
import { buildFeeViews } from '../domain/status';
import type { AcademicYear, AppData, Channel, FeeRecord, FeeView, Payment, PaymentMode, Reminder, ReminderRecipient, Student } from '../domain/types';
import { feeRecordId } from '../domain/types';
import { DATA_VERSION, feeStructureFor, generateSeed } from './seed';

const STORAGE_KEY = 'school-fee-intelligence:v1';

export interface StoreApi {
  data: AppData;
  today: string;
  year: AcademicYear;
  setYear: (year: AcademicYear) => void;
  views: FeeView[];
  viewsFor: (year: AcademicYear) => FeeView[];
  addPayment: (input: { admissionNo: string; year: AcademicYear; amount: number; date: string; mode: PaymentMode; receiptNo?: string; note?: string }) => Payment;
  deletePayment: (paymentId: string) => void;
  upsertStudent: (student: Student) => void;
  updateFeeRecord: (id: string, patch: Partial<Pick<FeeRecord, 'className' | 'section' | 'totalFee' | 'dueDate' | 'feeStructure'>>) => void;
  commitImport: (next: AppData, batch: ImportBatch) => void;
  sendReminders: (input: { channel: Channel; message: string; recipients: ReminderRecipient[] }) => Reminder;
  addYear: (year: AcademicYear, options: { promote: boolean }) => void;
  setCurrentYear: (year: AcademicYear) => void;
  setFeeStructure: (year: AcademicYear, structure: Record<string, number>, applyToRecords: boolean) => void;
  setSchoolName: (name: string) => void;
  resetData: () => void;
  replaceData: (data: AppData) => void;
}

const StoreContext = createContext<StoreApi | null>(null);

function loadInitial(today: string): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed && parsed.version === DATA_VERSION && Array.isArray(parsed.students)) return parsed;
    }
  } catch {
    // fall through to a fresh seed
  }
  return generateSeed(today);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const today = useMemo(() => todayISO(), []);
  const [data, setData] = useState<AppData>(() => loadInitial(today));
  const [year, setYear] = useState<AcademicYear>(() => data.currentYear);
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        // storage may be full or unavailable; the session still works in memory
      }
    }, 400);
    return () => window.clearTimeout(saveTimer.current);
  }, [data]);

  const viewCache = useMemo(() => new Map<string, FeeView[]>(), [data, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const viewsFor = useCallback(
    (y: AcademicYear) => {
      let v = viewCache.get(y);
      if (!v) {
        v = buildFeeViews(data, y, today);
        viewCache.set(y, v);
      }
      return v;
    },
    [viewCache, data, today],
  );
  const views = useMemo(() => viewsFor(year), [viewsFor, year]);

  const api = useMemo<StoreApi>(() => {
    const update = (fn: (d: AppData) => AppData) => setData((d) => fn(d));
    return {
      data,
      today,
      year,
      setYear,
      views,
      viewsFor,
      addPayment: (input) => {
        const payment: Payment = {
          id: newId('pay'),
          feeRecordId: feeRecordId(input.year, input.admissionNo),
          date: input.date,
          amount: input.amount,
          receiptNo: input.receiptNo?.trim() || `R${input.year.slice(2, 4)}-M${String(Date.now()).slice(-6)}`,
          mode: input.mode,
          source: 'manual',
          note: input.note,
        };
        update((d) => ({ ...d, payments: [...d.payments, payment] }));
        return payment;
      },
      deletePayment: (paymentId) => update((d) => ({ ...d, payments: d.payments.filter((p) => p.id !== paymentId) })),
      upsertStudent: (student) =>
        update((d) => {
          const exists = d.students.some((s) => s.admissionNo === student.admissionNo);
          return { ...d, students: exists ? d.students.map((s) => (s.admissionNo === student.admissionNo ? student : s)) : [...d.students, student] };
        }),
      updateFeeRecord: (id, patch) => update((d) => ({ ...d, feeRecords: d.feeRecords.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
      commitImport: (next) => setData(next),
      sendReminders: (input) => {
        const reminder: Reminder = { id: newId('rem'), sentAt: nowISO(), channel: input.channel, academicYear: year, message: input.message, recipients: input.recipients };
        update((d) => ({ ...d, reminders: [reminder, ...d.reminders] }));
        return reminder;
      },
      addYear: (newYear, options) =>
        update((d) => {
          if (d.years.includes(newYear)) return d;
          const structure = d.feeStructure[newYear] ?? feeStructureFor(newYear, d.currentYear);
          const feeRecords = d.feeRecords.slice();
          if (options.promote) {
            const latest = d.years[d.years.length - 1];
            const due = addDays(academicYearStart(newYear), 44);
            for (const r of d.feeRecords) {
              if (r.academicYear !== latest) continue;
              const cls = String(Number(r.className) + 1);
              if (!(cls in structure)) continue;
              feeRecords.push({ id: feeRecordId(newYear, r.admissionNo), admissionNo: r.admissionNo, academicYear: newYear, className: cls, section: r.section, feeStructure: `Annual fee ${newYear}`, totalFee: structure[cls], dueDate: due });
            }
          }
          return { ...d, years: [...d.years, newYear].sort(), feeStructure: { ...d.feeStructure, [newYear]: structure }, feeRecords };
        }),
      setCurrentYear: (y) => {
        update((d) => ({ ...d, currentYear: y }));
        setYear(y);
      },
      setFeeStructure: (y, structure, applyToRecords) =>
        update((d) => ({
          ...d,
          feeStructure: { ...d.feeStructure, [y]: structure },
          feeRecords: applyToRecords ? d.feeRecords.map((r) => (r.academicYear === y && r.className in structure ? { ...r, totalFee: structure[r.className] } : r)) : d.feeRecords,
        })),
      setSchoolName: (name) => update((d) => ({ ...d, schoolName: name })),
      resetData: () => {
        const fresh = generateSeed(today);
        setData(fresh);
        setYear(fresh.currentYear);
      },
      replaceData: (next) => {
        setData(next);
        setYear(next.currentYear);
      },
    };
  }, [data, today, year, views, viewsFor]);

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
