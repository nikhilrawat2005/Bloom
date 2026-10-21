import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/serverAuth';
import { enforceRateLimit, LIMITS } from '@/lib/rateLimit';
import { enrichLinks, reviewRepos, type EnrichLinkInput } from '@/lib/services/profileEnrichmentService';
import { normalizeProfileEnrichment } from '@/lib/enrichmentTypes';

export const runtime = 'nodejs';
export const maxDuration = 180;
export const dynamic = 'force-dynamic';

const MAX_LINKS = 20;

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const limited = enforceRateLimit(request, { ...LIMITS.profileEnrich, uid: auth.user.uid });
  if (!limited.ok) return limited.response;

  try {
    const body = await request.json().catch(() => null);
    const rawLinks: unknown = body?.links;
    if (!Array.isArray(rawLinks) || rawLinks.length === 0) {
      return NextResponse.json({ error: 'No links were provided to enrich.' }, { status: 400 });
    }

    const links: EnrichLinkInput[] = rawLinks
      .filter((l): l is EnrichLinkInput => !!l && typeof (l as EnrichLinkInput).url === 'string' && (l as EnrichLinkInput).url.length > 0)
      .slice(0, MAX_LINKS)
      .map((l) => ({ url: l.url, kind: typeof l.kind === 'string' ? l.kind : undefined, id: typeof l.id === 'string' ? l.id : undefined }));

    if (links.length === 0) {
      return NextResponse.json({ error: 'No valid link URLs were provided.' }, { status: 400 });
    }

    const deadline = Date.now() + 100_000;
    const { enrichment, labels } = await enrichLinks(links, deadline);

    // Attach one AI review sentence per top repo (best-effort; skipped on failure).
    if (enrichment.github && enrichment.github.repos.length > 0) {
      const reviews = await reviewRepos(enrichment.github.repos);
      enrichment.github.repos = enrichment.github.repos.map((repo) => ({
        ...repo,
        review: reviews[repo.name] || repo.review || '',
      }));
    }

    return NextResponse.json({
      success: true,
      enrichment: normalizeProfileEnrichment(enrichment),
      labels,
    });
  } catch (err: any) {
    console.error('[ProfileEnrichAPI] error:', err);
    const msg = err?.message || 'Failed to enrich profile links';
    if (/budget|timed out|timeout/i.test(msg)) {
      return NextResponse.json(
        { error: 'Link analysis took too long. Try again, or add fewer links at once.' },
        { status: 504 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
