export type Field =
  | 'admissionNo'
  | 'name'
  | 'className'
  | 'section'
  | 'classSection'
  | 'totalFee'
  | 'paidAmount'
  | 'balance'
  | 'dueDate'
  | 'paymentDate'
  | 'receiptNo'
  | 'academicYear'
  | 'guardianName'
  | 'phone'
  | 'email'
  | 'feeStructure'
  | 'ignore';

export const FIELD_LABELS: Record<Field, string> = {
  admissionNo: 'Admission number',
  name: 'Student name',
  className: 'Class',
  section: 'Section',
  classSection: 'Class & section (e.g. 8-A)',
  totalFee: 'Total fee',
  paidAmount: 'Amount paid',
  balance: 'Balance / outstanding',
  dueDate: 'Due date',
  paymentDate: 'Payment date',
  receiptNo: 'Receipt number',
  academicYear: 'Academic year',
  guardianName: 'Parent / guardian',
  phone: 'Mobile number',
  email: 'Email',
  feeStructure: 'Fee structure / plan',
  ignore: 'Ignore this column',
};

export const FIELD_ORDER: Field[] = [
  'admissionNo',
  'name',
  'classSection',
  'className',
  'section',
  'totalFee',
  'paidAmount',
  'balance',
  'dueDate',
  'paymentDate',
  'receiptNo',
  'guardianName',
  'phone',
  'email',
  'academicYear',
  'feeStructure',
  'ignore',
];

/** Fields that only make sense once per row. */
const SINGLE_USE: Field[] = FIELD_ORDER.filter((f) => f !== 'ignore');

function norm(header: string): string {
  return header.toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const RULES: [RegExp, Field][] = [
  [/guardian|parent|father|mother/, 'guardianName'],
  [/e ?mail/, 'email'],
  [/phone|mobile|contact|whatsapp|cell/, 'phone'],
  [/receipt|rcpt|\brec(eipt)? ?no|txn|transaction|utr|\bref(erence)? ?(no|num|#)/, 'receiptNo'],
  [/(structure|plan|fee ?type|category|scheme)/, 'feeStructure'],
  [/academic|session|\byear\b/, 'academicYear'],
  [/^(adm|admn|admission)\b|adm(ission)? ?(no|num|number|#|id)|\broll|reg(istration)? ?(no|num|number)|enrol|student ?(id|no|number|code)|^id$|^sl ?no$/, 'admissionNo'],
  [/due ?(amount|amt|fee)|balance|outstanding|pending|remaining|arrears|\bbal\b/, 'balance'],
  [/due ?date|due ?on|\bdue\b/, 'dueDate'],
  [/payment ?date|paid ?on|date ?of ?payment|receipt ?date|txn ?date|transaction ?date|collection ?date|^date$/, 'paymentDate'],
  [/paid|received|collected|collection|realis/, 'paidAmount'],
  [/class ?(&|and|\/|-)? ?sec|std ?\/? ?sec|grade ?\/? ?sec|class ?section/, 'classSection'],
  [/\bsection\b|\bsec\b|\bdiv(ision)?\b/, 'section'],
  [/\bclass\b|\bgrade\b|\bstd\b|standard/, 'className'],
  [/total|annual|expected|payable|\bfees?\b|amount/, 'totalFee'],
  [/\bname\b|student/, 'name'],
];

export function guessField(header: string): Field {
  const h = norm(header);
  if (!h) return 'ignore';
  if (/^(sl|s|sr|serial) ?(no|num|#)?\.?$/.test(h) || h === '#') return 'ignore';
  for (const [re, field] of RULES) {
    if (re.test(h)) return field;
  }
  return 'ignore';
}

const CLASS_SECTION_VALUE = /^\s*(class|std|grade)?\s*([a-z0-9]+)\s*[-/ ]\s*([a-z])\s*$/i;

/** Guess a field per column; a field is used at most once (first column wins). */
export function guessMapping(headers: string[], sampleRows: string[][] = []): Field[] {
  const used = new Set<Field>();
  const mapping = headers.map((header, col) => {
    let field = guessField(header);
    if (field === 'className' && looksLikeClassSection(sampleRows, col)) field = 'classSection';
    if (field !== 'ignore' && used.has(field)) field = 'ignore';
    if (SINGLE_USE.includes(field)) used.add(field);
    return field;
  });
  // A class+section column makes separate class/section columns redundant for class, but keep them if present.
  return mapping;
}

function looksLikeClassSection(rows: string[][], col: number): boolean {
  const values = rows.slice(0, 25).map((r) => (r[col] ?? '').trim()).filter(Boolean);
  if (values.length === 0) return false;
  const hits = values.filter((v) => CLASS_SECTION_VALUE.test(v)).length;
  return hits / values.length >= 0.5;
}

export function mappingHas(mapping: Field[], field: Field): boolean {
  return mapping.includes(field);
}
