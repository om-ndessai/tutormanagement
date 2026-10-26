import type { AuthProvider, AuthProviderInfo } from '@tmi/shared';

import { cn } from '@/lib/utils';

/**
 * Phase 55: a provider's glyph, in the page's own colour (`currentColor`), so
 * it follows the theme like every other icon. Simple marks, not the providers'
 * full-colour logos.
 */
export function ProviderGlyph({ provider, className }: { provider: AuthProvider; className?: string }) {
  const common = { className: cn('size-4 shrink-0', className), 'aria-hidden': true, focusable: false } as const;
  switch (provider) {
    case 'microsoft':
      return (
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
        <svg viewBox="0 0 16 16" fill="currentColor" {...common}>
          <path d="M16 8a8 8 0 1 0-9.25 7.9v-5.59H4.72V8h2.03V6.24c0-2 1.2-3.11 3.02-3.11.88 0 1.8.16 1.8.16v1.97h-1.01c-1 0-1.31.62-1.31 1.26V8h2.22l-.35 2.31H9.25v5.59A8 8 0 0 0 16 8Z" />
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
          className="border-input bg-background hover:bg-accent focus-visible:ring-ring inline-flex h-10 w-80 max-w-full items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ProviderGlyph provider={provider.id} />
          Continue with {provider.label}
        </a>
      ))}
    </div>
  );
}
