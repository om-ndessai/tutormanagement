import type { Context } from 'hono';
import { PLATFORM_BRAND, shareHeadline } from '@tmi/shared';

import type { AppEnv } from '../types.js';
import { readPublicShare } from '../repositories/shares.js';

/** HTML-escapes a value for an attribute or text. */
function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

/**
 * Phase 56: `/s/<id>`. The SPA's own page, with `og:` and `twitter:` tags for
 * the card written in by HTMLRewriter, so a link posted anywhere unfurls with
 * its headline and a picture. One primary-key read; the picture is one of a few
 * static images per kind (a per-share image waits for Workers Paid's CPU).
 * Nothing in the tags names an organization, a child or another player.
 */
export async function sharePage(c: Context<AppEnv>): Promise<Response> {
  const id = c.req.param('id') ?? '';
  const share = /^[A-Za-z0-9]{8,32}$/.test(id) ? await readPublicShare(c.env.DB, id) : null;
  const origin = new URL(c.req.url).origin;
  const live = share?.available && share.card;
  const title = live
    ? `${share.first_name ? `${share.first_name} · ` : ''}${shareHeadline(share.card!)}`
    : `${PLATFORM_BRAND.name} Quest`;
  const description = live
    ? share.card!.kind === 'challenge'
      ? 'One question. Can you solve it?'
      : 'Maths practice, one question at a time.'
    : 'This share is no longer available.';
  const image = `${origin}/og/${live ? share.card!.kind : 'quest'}.png`;
  const tags = [
    ['og:title', title],
    ['og:description', description],
    ['og:image', image],
    ['og:url', `${origin}/s/${id}`],
    ['og:type', 'website'],
    ['twitter:card', 'summary_large_image'],
    ['twitter:title', title],
    ['twitter:description', description],
    ['twitter:image', image],
  ]
    .map(([name, content]) =>
      name!.startsWith('og:')
        ? `<meta property="${name}" content="${esc(content!)}">`
        : `<meta name="${name}" content="${esc(content!)}">`,
    )
    .join('');

  const page = c.env.ASSETS ? await c.env.ASSETS.fetch(new Request(new URL('/index.html', c.req.url))) : null;
  const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' };
  if (!page || !page.ok || !(page.headers.get('Content-Type') ?? '').includes('text/html')) {
    // No built SPA (local `wrangler dev` before a build): the tags alone, which is what an unfurler reads.
    return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>${tags}</head><body></body></html>`, {
      status: share ? 200 : 404,
      headers,
    });
  }
  const rewritten = new HTMLRewriter()
    .on('title', { element: (el) => void el.setInnerContent(title) })
    .on('head', { element: (el) => void el.append(tags, { html: true }) })
    .transform(page);
  return new Response(rewritten.body, { status: share ? 200 : 404, headers });
}
