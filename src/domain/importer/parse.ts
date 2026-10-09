import type { SourceKind } from '../types';
import { finishTable, groupIntoLines, tableFromLines, tableFromPositionedLines, type PositionedItem, type RawTable } from './textTable';

export type Progress = (message: string) => void;

export function sourceKindOf(file: File): SourceKind | null {
  const name = file.name.toLowerCase();
  if (/\.(csv|tsv|txt)$/.test(name)) return 'csv';
  if (/\.(xlsx|xlsm|xls|ods)$/.test(name)) return 'xlsx';
  if (/\.pdf$/.test(name) || file.type === 'application/pdf') return 'pdf';
  if (/\.(png|jpe?g|webp|bmp|tiff?|heic)$/.test(name) || file.type.startsWith('image/')) return 'image';
  return null;
}

/** Read a file into a raw table of strings. Heavy libraries are loaded on demand. */
export async function extractFromFile(file: File, onProgress: Progress): Promise<RawTable> {
  const kind = sourceKindOf(file);
  if (!kind) throw new Error('Unsupported file type. Upload an Excel, CSV, PDF or image file.');
  if (kind === 'csv' || kind === 'xlsx') return readSpreadsheet(file, kind, onProgress);
  if (kind === 'pdf') return readPdf(file, onProgress);
  return readImage(file, onProgress);
}

async function readSpreadsheet(file: File, kind: SourceKind, onProgress: Progress): Promise<RawTable> {
  onProgress('Reading spreadsheet…');
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false, raw: false });
  const notes: string[] = [];
  const sheetName = wb.SheetNames[0];
  if (wb.SheetNames.length > 1) notes.push(`Workbook has ${wb.SheetNames.length} sheets; reading "${sheetName}".`);
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '', blankrows: false, dateNF: 'yyyy-mm-dd' });
  const text = rows.map((r) => r.map((c) => (c === null || c === undefined ? '' : String(c).trim())));
  return finishTable(text, kind, notes);
}

async function readPdf(file: File, onProgress: Progress): Promise<RawTable> {
  onProgress('Opening PDF…');
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const notes: string[] = [];
  const positioned: PositionedItem[][] = [];
  let scannedPages = 0;
  let ocrLines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    onProgress(`Reading page ${p} of ${doc.numPages}…`);
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items: PositionedItem[] = [];
    for (const it of content.items) {
      if (!('str' in it) || !it.str.trim()) continue;
      items.push({ x: it.transform[4], y: it.transform[5] - p * 10000, w: it.width, str: it.str });
    }
    if (items.length < 8) {
      scannedPages++;
      onProgress(`Page ${p} looks scanned; recognising text…`);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not render the PDF page.');
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const text = await ocrImage(canvas, (m) => onProgress(`Page ${p}: ${m}`));
      ocrLines = ocrLines.concat(text.split(/\r?\n/));
      continue;
    }
    positioned.push(...groupIntoLines(items));
  }
  if (scannedPages > 0) notes.push(`${scannedPages} page${scannedPages === 1 ? '' : 's'} had no text layer and went through document recognition; confidence is lower.`);
  if (positioned.length === 0) return tableFromLines(ocrLines, 'image', notes);
  if (ocrLines.length) notes.push('Mixed text and scanned pages: only the text pages were read as a table.');
  return tableFromPositionedLines(positioned, 'pdf', notes);
}

async function readImage(file: File, onProgress: Progress): Promise<RawTable> {
  const text = await ocrImage(file, onProgress);
  const lines = text.split(/\r?\n/);
  return tableFromLines(lines, 'image', ['Text was recognised from an image; check names and amounts carefully.']);
}

async function ocrImage(source: File | HTMLCanvasElement, onProgress: Progress): Promise<string> {
  onProgress('Loading document recognition…');
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress(`Recognising text… ${Math.round(m.progress * 100)}%`);
      else if (m.status) onProgress(`${m.status.charAt(0).toUpperCase()}${m.status.slice(1)}…`);
    },
  });
  try {
    await worker.setParameters({ preserve_interword_spaces: '1' });
    const result = await worker.recognize(source);
    return result.data.text;
  } finally {
    await worker.terminate();
  }
}
