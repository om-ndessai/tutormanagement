import type { AuthProvider, AuthProviderInfo } from '@tmi/shared';

import { cn } from '@/lib/utils';

/**
 * Phase 55: a provider's glyph. `brand` draws the provider's own logo in its own colours (the
 * sign-in buttons); otherwise a simple mark in the page's colour (`currentColor`), like every other
 * icon (My profile's "Ways to sign in").
 */
export function ProviderGlyph({
  provider,
  className,
  brand = false,
}: {
  provider: AuthProvider;
  className?: string;
  brand?: boolean;
}) {
  const common = { className: cn('size-4 shrink-0', className), 'aria-hidden': true, focusable: false } as const;
  switch (provider) {
    case 'microsoft':
      return brand ? (
        <svg viewBox="0 0 21 21" {...common}>
          <rect x="1" y="1" width="9" height="9" fill="var(--provider-microsoft-red)" />
          <rect x="11" y="1" width="9" height="9" fill="var(--provider-microsoft-green)" />
          <rect x="1" y="11" width="9" height="9" fill="var(--provider-microsoft-blue)" />
          <rect x="11" y="11" width="9" height="9" fill="var(--provider-microsoft-yellow)" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" fill="currentColor" {...common}>
          <rect x="1" y="1" width="6.5" height="6.5" />
          <rect x="8.5" y="1" width="6.5" height="6.5" />
          <rect x="1" y="8.5" width="6.5" height="6.5" />
          <rect x="8.5" y="8.5" width="6.5" height="6.5" />
        </svg>
      );
    case 'apple':
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" {...common}>
          <path d="M11.2 8.5c0-1.6 1.3-2.4 1.4-2.4-.8-1.1-2-1.3-2.4-1.3-1-.1-2 .6-2.5.6s-1.3-.6-2.2-.6C4.4 4.8 3.3 5.5 2.7 6.6c-1.2 2.1-.3 5.2.9 6.9.6.8 1.2 1.7 2.1 1.7.8 0 1.2-.5 2.2-.5s1.3.5 2.2.5 1.5-.8 2-1.7c.6-.9.9-1.8.9-1.9 0 0-1.8-.7-1.8-3.1ZM9.6 3.6c.5-.6.8-1.4.7-2.2-.7 0-1.5.5-2 1.1-.4.5-.8 1.3-.7 2.1.8.1 1.5-.4 2-1Z" />
        </svg>
      );
    case 'facebook':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" {...common}>
          <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07Z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" {...common}>
          <path d="M15.7 8.2c0-.6-.1-1.1-.2-1.6H8v3h4.3a3.7 3.7 0 0 1-1.6 2.4v2h2.6c1.5-1.4 2.4-3.4 2.4-5.8Z" />
          <path d="M8 16c2.2 0 4-.7 5.3-1.9l-2.6-2c-.7.5-1.6.8-2.7.8-2.1 0-3.9-1.4-4.5-3.3H.8v2.1A8 8 0 0 0 8 16Z" />
          <path d="M3.5 9.6a4.8 4.8 0 0 1 0-3.1V4.4H.8a8 8 0 0 0 0 7.2l2.7-2Z" />
          <path d="M8 3.2c1.2 0 2.2.4 3.1 1.2l2.3-2.3A8 8 0 0 0 .8 4.4l2.7 2.1C4.1 4.6 5.9 3.2 8 3.2Z" />
        </svg>
      );
  }
}

/** Each provider's button colours: CSS variables in index.css, so they switch with the theme. */
const BRAND_CLASSES: Record<Exclude<AuthProvider, 'google'>, string> = {
  microsoft:
    'bg-[var(--provider-microsoft-bg)] border-[var(--provider-microsoft-border)] text-[var(--provider-microsoft-text)]',
  facebook:
    'bg-[var(--provider-facebook-bg)] border-[var(--provider-facebook-border)] text-[var(--provider-facebook-text)]',
  apple: 'bg-[var(--provider-apple-bg)] border-[var(--provider-apple-border)] text-[var(--provider-apple-text)]',
};

/** Where a provider's redirect flow starts: a full navigation, so the cookie it sets is the browser's. */
export function providerStartHref(
  provider: AuthProvider,
  options: { signup?: boolean; link?: boolean; returnTo?: string } = {},
): string {
  const params = new URLSearchParams();
  if (options.signup) params.set('signup', '1');
  if (options.link) params.set('link', '1');
  if (options.returnTo) params.set('return', options.returnTo);
  const query = params.toString();
  return `/api/auth/${provider}/start${query ? `?${query}` : ''}`;
}

/**
 * The sign-in page's buttons for every provider but Google (which draws its
 * own). Plain links: the Worker sends the browser to the provider and back.
 */
export function ProviderButtons({
  providers,
  signup,
  returnTo,
}: {
  providers: AuthProviderInfo[];
  signup: boolean;
  returnTo?: string;
}) {
  const others = providers.filter((provider) => provider.id !== 'google');
  if (others.length === 0) return null;
  return (
    <div className="grid justify-items-center gap-2" data-testid="provider-buttons">
      {others.map((provider) => (
        <a
          key={provider.id}
          href={providerStartHref(provider.id, { signup, returnTo })}
          className={cn(
            // Google's own button's size and shape (320 x 40, a pill), its logo at the left and the words centred.
            'focus-visible:ring-ring relative inline-flex h-10 w-80 max-w-full items-center justify-center rounded-full border px-11 text-sm font-medium transition-[filter] hover:brightness-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
            BRAND_CLASSES[provider.id as Exclude<AuthProvider, 'google'>],
          )}
        >
          <ProviderGlyph provider={provider.id} brand className="absolute left-3 size-[18px]" />
          <span className="truncate">Continue with {provider.label}</span>
        </a>
      ))}
    </div>
  );
}
