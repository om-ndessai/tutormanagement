import { Link } from 'react-router-dom';
import {
  LEGAL_DRAFT,
  PRIVACY_SECTIONS,
  PRIVACY_VERSION,
  TERMS_SECTIONS,
  TERMS_VERSION,
  type LegalSection,
} from '@tmi/shared';

/**
 * Phase 51: the terms and the privacy notice, readable signed out (outside the sign-in gate), so
 * the sign-in page, the app and Google's consent screen can link to them.
 */
export function LegalPage({ kind }: { kind: 'terms' | 'privacy' }) {
  const terms = kind === 'terms';
  const sections: LegalSection[] = terms ? TERMS_SECTIONS : PRIVACY_SECTIONS;
  return (
    <main className="bg-background min-h-dvh px-4 py-10" data-testid={`legal-${kind}`}>
      <article className="mx-auto grid max-w-2xl gap-6">
        <header className="grid gap-1">
          <h1 className="font-display text-2xl font-semibold">{terms ? 'Terms of use' : 'Privacy notice'}</h1>
          <p className="text-muted-foreground text-sm">
            Aimtrue · version {terms ? TERMS_VERSION : PRIVACY_VERSION}
          </p>
          {LEGAL_DRAFT && (
            <p className="bg-muted text-muted-foreground rounded-md px-3 py-2 text-xs" data-testid="legal-draft">
              Draft: this wording is waiting for approval and may change before sign-up opens.
            </p>
          )}
        </header>
        {sections.map((section) => (
          <section key={section.heading} className="grid gap-2">
            <h2 className="text-base font-semibold">{section.heading}</h2>
            {section.paragraphs.map((text) => (
              <p key={text} className="text-sm leading-relaxed">
                {text}
              </p>
            ))}
          </section>
        ))}
        <footer className="text-muted-foreground flex gap-4 border-t pt-4 text-xs">
          <Link to={terms ? '/privacy' : '/terms'} className="underline">
            {terms ? 'Privacy notice' : 'Terms of use'}
          </Link>
          <Link to="/" className="underline">
            Aimtrue
          </Link>
        </footer>
      </article>
    </main>
  );
}
