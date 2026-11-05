import { useEffect } from 'react';
import { ClockIcon, LockIcon, MailIcon } from 'lucide-react';
import { ACCESS_ERROR_CODES, PLATFORM_CONTACT_EMAIL, type AccessErrorCode } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { declinedTab } from '@/features/guest/guest-store';

const TITLES: Record<AccessErrorCode, string> = {
  not_on_list: 'Sign-up is by invitation',
  access_pending: 'Waiting for approval',
  access_declined: 'Access not approved',
};

/** Whether an API error is one of Phase 65's sign-up access refusals. */
export function isAccessRefusal(code: string | undefined | null): code is AccessErrorCode {
  return (ACCESS_ERROR_CODES as readonly string[]).includes(code ?? '');
}

/** A mail asking to be put on the sign-up list, with the address when this device knows it. */
export function invitationMailto(email?: string | null): string {
  const subject = 'An invitation to Aimtrue';
  const body = email ? `Please add ${email} to the sign-up list.` : 'Please add me to the sign-up list.';
  return `mailto:${PLATFORM_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Phase 65 (A4, A7): what a newcomer reads when sign-up access stops them -- not on the platform's
 * list, waiting for a platform admin, or declined. The server's message, then (UI audit, JF2/JF8) a next step:
 * where guest play is offered, "Keep playing" leads, saying play goes on without an account; under
 * Pre-approved, "Ask for an invitation" and "Use another account"; and the contact address in full.
 * A decline stops this tab offering sign-up again.
 */
export function AccessRefused({
  code,
  message,
  onBack,
  onKeepPlaying,
  onUseAnother,
  email,
}: {
  code: AccessErrorCode;
  message: string;
  onBack?: () => void;
  /** Where guest play is offered: back to it (the sheet closes over the page or the question). */
  onKeepPlaying?: () => void;
  /** Under Pre-approved: back to the sign-in buttons, for another account. */
  onUseAnother?: () => void;
  /** The account that was checked, when this device knows it. */
  email?: string | null;
}) {
  const Icon = code === 'access_pending' ? ClockIcon : LockIcon;
  useEffect(() => {
    if (code === 'access_declined') declinedTab.mark();
  }, [code]);
  return (
    <div className="grid justify-items-center gap-3 py-4 text-center" role="alert" data-testid="access-refused">
      <span className="bg-primary/10 text-primary grid size-12 place-items-center rounded-full">
        <Icon className="size-6" aria-hidden />
      </span>
      <h2 className="font-display text-lg font-semibold" data-testid="access-refused-title">
        {TITLES[code]}
      </h2>
      <p className="text-muted-foreground max-w-sm text-sm" data-testid="access-refused-message">
        {message}
      </p>
      {code === 'not_on_list' && email && (
        <p className="text-muted-foreground max-w-sm text-sm" data-testid="access-refused-account">
          Checked: {email}
        </p>
      )}
      {onKeepPlaying && (
        <p className="max-w-sm text-sm font-medium" data-testid="access-refused-keep-line">
          You can keep playing without an account.
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2 pt-1">
        {onKeepPlaying && (
          <Button onClick={onKeepPlaying} data-testid="access-refused-keep-playing">
            Keep playing
          </Button>
        )}
        {code === 'not_on_list' && (
          <Button asChild variant="outline">
            <a href={invitationMailto(email)} data-testid="access-refused-ask-invitation">
              <MailIcon className="size-4" /> Ask for an invitation
            </a>
          </Button>
        )}
        {code === 'not_on_list' && onUseAnother && (
          <Button variant="ghost" onClick={onUseAnother} data-testid="access-refused-use-another">
            Use another account
          </Button>
        )}
        {onBack && (
          <Button variant="secondary" onClick={onBack} data-testid="access-refused-back">
            Back
          </Button>
        )}
      </div>
      <a
        href={`mailto:${PLATFORM_CONTACT_EMAIL}`}
        className="text-muted-foreground text-sm underline underline-offset-4"
        data-testid="access-refused-contact"
      >
        Contact us: {PLATFORM_CONTACT_EMAIL}
      </a>
    </div>
  );
}
