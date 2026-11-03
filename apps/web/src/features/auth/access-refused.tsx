import { ClockIcon, LockIcon, MailIcon } from 'lucide-react';
import { ACCESS_ERROR_CODES, PLATFORM_CONTACT_EMAIL, type AccessErrorCode } from '@tmi/shared';

import { Button } from '@/components/ui/button';

const TITLES: Record<AccessErrorCode, string> = {
  not_on_list: 'Sign-up is by invitation',
  access_pending: 'Waiting for approval',
  access_declined: 'Access not approved',
};

/** Whether an API error is one of Phase 65's sign-up access refusals. */
export function isAccessRefusal(code: string | undefined | null): code is AccessErrorCode {
  return (ACCESS_ERROR_CODES as readonly string[]).includes(code ?? '');
}

/**
 * Phase 65 (A4, A7): what a newcomer reads when sign-up access stops them -- not on the platform's
 * list, waiting for a platform admin, or declined. The server's message, a way to write to us, and Back.
 */
export function AccessRefused({ code, message, onBack }: { code: AccessErrorCode; message: string; onBack?: () => void }) {
  const Icon = code === 'access_pending' ? ClockIcon : LockIcon;
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
      <div className="flex flex-wrap justify-center gap-2 pt-1">
        <Button asChild variant="outline">
          <a href={`mailto:${PLATFORM_CONTACT_EMAIL}`}>
            <MailIcon className="size-4" /> Contact us
          </a>
        </Button>
        {onBack && (
          <Button variant="secondary" onClick={onBack} data-testid="access-refused-back">
            Back
          </Button>
        )}
      </div>
    </div>
  );
}
