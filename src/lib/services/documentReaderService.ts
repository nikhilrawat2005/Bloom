import mammoth from 'mammoth';

export interface ExtractResult {
  supported: boolean;
  text: string;
  pageCount: number | null;
  error: string | null;
}

const MAX_EXTRACTED_CHARS = 60000;

function truncate(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.length <= MAX_EXTRACTED_CHARS) return trimmed;
  return trimmed.slice(0, MAX_EXTRACTED_CHARS) + `\n\n[... truncated, original was ${trimmed.length} characters ...]`;
}

function toStandaloneBytes(buffer: Buffer | Uint8Array): Uint8Array {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const bytes = new Uint8Array(buf.byteLength);
  bytes.set(buf);
  return bytes;
}

async function extractFromPdf(buffer: Buffer | Uint8Array): Promise<{ text: string; pageCount: number | null }> {
  // Headless Node.js / Vercel Serverless environment:
  // Inject the legacy worker into globalThis.pdfjsWorker so pdfjs never tries
  // to dynamically import './pdf.worker.mjs' from missing serverless chunks on disk.
  try {
    // @ts-expect-error - legacy worker file does not have separate type declarations
    const worker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
    (globalThis as any).pdfjsWorker = worker;
  } catch (err) {
    console.warn('[documentReaderService] Failed to preload pdf.worker:', err);
  }

  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(toStandaloneBytes(buffer));
  const loadingTask = pdfjsLib.getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const textItems = content.items
      .map((item: any) => item.str)
      .filter((s: any) => typeof s === 'string');
    pageTexts.push(textItems.join(' '));
  }
  return { text: truncate(pageTexts.join('\n\n')), pageCount: pdf.numPages || null };
}

async function extractFromDocx(buffer: Buffer | Uint8Array): Promise<{ text: string; pageCount: number | null }> {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const res = await mammoth.extractRawText({ buffer: buf });
  return { text: truncate(res.value || ''), pageCount: null };
}

export async function extractText(buffer: Buffer | Uint8Array, originalName = ''): Promise<ExtractResult> {
  const ext = String(originalName).split('.').pop()?.toLowerCase() || '';
  try {
    if (ext === 'pdf') {
      const { text, pageCount } = await extractFromPdf(buffer);
      return { supported: true, text, pageCount, error: null };
    }
    if (ext === 'docx') {
      const { text, pageCount } = await extractFromDocx(buffer);
      return { supported: true, text, pageCount, error: null };
    }
    if (ext === 'txt' || ext === 'md' || ext === 'csv' || ext === 'tsv' || ext === 'json' || ext === 'xml' || ext === 'yaml' || ext === 'yml') {
      const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
      return { supported: true, text: truncate(buf.toString('utf8')), pageCount: null, error: null };
    }
    if (ext === 'doc' || ext === 'ppt') {
      return {
        supported: false,
        text: '',
        pageCount: null,
        error: `Legacy ".${ext}" format can't be read. Re-save it as ".${ext}x" and upload again.`,
      };
    }
    return { supported: false, text: '', pageCount: null, error: `"${ext}" text extraction not implemented yet` };
  } catch (err: any) {
    console.error(`[documentReaderService] extraction failed for .${ext}:`, err.message);
    return { supported: false, text: '', pageCount: null, error: err.message || 'Extraction failed' };
  }
}

export function queryDocumentContext(rawText: string, query: string): string {
  if (!rawText || typeof rawText !== 'string') return '';
  const cleanDoc = rawText.trim();
  if (cleanDoc.length < 4500) {
    return cleanDoc.slice(0, 8000);
  }
  const q = String(query || '').toLowerCase().trim();
  const wantsAll = /(?:all|complete|entire|full|summary|overview|export|download)/i.test(q);
  if (wantsAll) {
    return cleanDoc.slice(0, 8000);
  }
  const stopWords = new Set(['kya', 'hai', 'hain', 'ka', 'ki', 'ke', 'ko', 'se', 'me', 'mein', 'par', 'batao', 'dikhao', 'do', 'the', 'is', 'in', 'and', 'for', 'with', 'about', 'show', 'tell', 'me']);
  const queryTokens = q
    .replace(/[^\w\s\u0900-\u097F]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !stopWords.has(w));
  const paragraphs = cleanDoc.split(/\n\s*\n/);
  const matchedParas: string[] = [];
  paragraphs.forEach((p) => {
    const lowerP = p.toLowerCase();
    const matches = queryTokens.some((t) => lowerP.includes(t));
    if (matches) matchedParas.push(p.trim());
  });
  if (matchedParas.length > 0) {
    return matchedParas.slice(0, 6).join('\n\n---\n\n').slice(0, 5000);
  }
  return cleanDoc.slice(0, 4500);
}

export const MAX_EXTRACTED_CHARS_EXPORT = 60000;
