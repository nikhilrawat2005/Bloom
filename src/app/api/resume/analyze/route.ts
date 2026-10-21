import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/serverAuth';
import { enforceRateLimit, LIMITS } from '@/lib/rateLimit';
import { auditResume, auditResumeBuffer } from '@/lib/services/resumeAnalyzerService';

export const runtime = 'nodejs';
export const maxDuration = 180;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const limited = enforceRateLimit(request, { ...LIMITS.resumeAnalyze, uid: auth.user.uid });
  if (!limited.ok) return limited.response;

  try {
    // Reject oversized bodies before buffering them into memory.
    const contentLength = Number(request.headers.get('content-length') || '0');
    if (contentLength > MAX_UPLOAD_BYTES + 8 * 1024) {
      return NextResponse.json(
        { error: `Resume is too large. Maximum size is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.` },
        { status: 413 }
      );
    }

    const formData = await request.formData().catch(() => null);
    const body = !formData ? await request.json().catch(() => null) : null;

    const rawTarget = formData?.get('targetJobDescription') ?? body?.targetJobDescription;
    const targetJobDescription = typeof rawTarget === 'string' ? rawTarget : '';

    // File upload case
    if (formData && formData.has('file')) {
      const file = formData.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'Invalid file upload' }, { status: 400 });
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: `Resume is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum size is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.` },
          { status: 413 }
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await auditResumeBuffer(buffer, file.name, targetJobDescription);
      return NextResponse.json({
        success: true,
        audit: result.analysis,
        fileName: result.fileName,
        charCount: result.charCount,
        pageCount: result.pageCount,
      });
    }

    // Raw text case
    if (typeof body?.resumeText === 'string' && body.resumeText) {
      const audit = await auditResume({
        resumeText: body.resumeText,
        targetJobDescription,
      });
      return NextResponse.json({ success: true, audit, fileName: body.fileName || 'Pasted Resume Text' });
    }

    // Try to get from stored base resume text if provided
    if (typeof body?.baseResumeText === 'string' && body.baseResumeText) {
      const audit = await auditResume({
        resumeText: body.baseResumeText,
        targetJobDescription,
      });
      return NextResponse.json({ success: true, audit, fileName: body.fileName || 'Base Resume' });
    }

    return NextResponse.json({ error: 'Please upload a PDF/DOCX resume or provide resume text to analyze.' }, { status: 400 });
  } catch (err: any) {
    console.error('[ResumeAPI] Analyze error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to analyze resume' }, { status: 500 });
  }
}
