import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/serverAuth';
import { enforceRateLimit, LIMITS } from '@/lib/rateLimit';
import { auditResume } from '@/lib/services/resumeAnalyzerService';

export const runtime = 'nodejs';
export const maxDuration = 180;

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const limited = enforceRateLimit(request, { ...LIMITS.resumeAnalyze, uid: auth.user.uid });
  if (!limited.ok) return limited.response;

  try {
    const body = await request.json().catch(() => null);
    const { resumeData } = body || {};
    const targetJobDescription =
      typeof body?.targetJobDescription === 'string' ? body.targetJobDescription : '';

    if (!resumeData) {
      return NextResponse.json({ error: 'No generated resume data found to analyze. Please build one first.' }, { status: 400 });
    }

    // Convert structured data to readable text
    const resumeText = JSON.stringify(resumeData, null, 2).slice(0, 60_000);
    const audit = await auditResume({
      resumeText,
      targetJobDescription,
    });

    const name = resumeData?.basics?.name || 'Candidate';
    return NextResponse.json({ success: true, audit, fileName: `${name}_Generated_Resume` });
  } catch (err: any) {
    console.error('[ResumeAPI] Analyze generated error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to analyze generated resume' }, { status: 500 });
  }
}
