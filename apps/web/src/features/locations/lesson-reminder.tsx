import { useEffect, useMemo, useState } from 'react';
import { BellIcon, ExternalLinkIcon, GlobeIcon, MapPinIcon, XIcon } from 'lucide-react';
import { LOCATION_KIND_LABELS, dueReminder, formatTimeRange, parseClockTime, reminderKey } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { useUpcomingSessions } from '@/features/schedules/api';
import { useAuth, useOrgTimeZone } from '@/providers/auth-provider';

// Phase 33: the in-app reminder. When a lesson the viewer is part of starts within the reminder
// its locations ask for, a sheet rises from the bottom of the dashboard with when and where.
// Dismissing it is remembered per lesson date in this browser, so next week reminds again.

const DISMISSED_KEY = 'tmi_reminders_dismissed';

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function dismiss(key: string) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...readDismissed().slice(-50), key]));
  } catch {
    // A browser that keeps nothing simply shows the reminder again on the next visit.
  }
}

const isLink = (text: string | null) => Boolean(text && /^https?:\/\//i.test(text));

export function LessonReminderSheet() {
  const { user } = useAuth();
  const timeZone = useOrgTimeZone();
  const upcoming = useUpcomingSessions();
  const [now, setNow] = useState(() => new Date().toISOString());
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);

  // The window opens while the page sits open, so the clock is re-read every 30 seconds.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date().toISOString()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const due = useMemo(() => {
    const lessons = (upcoming.data?.pages.flatMap((page) => page.data) ?? [])
      // An admin sees every lesson in the organization; a reminder is only for their own.
      .filter(
        (lesson) =>
          !(user?.roles.includes('admin') ?? false) ||
          lesson.tutor_user_id === user?.id ||
          lesson.student_user_id === user?.id,
      )
      .filter((lesson) => !dismissed.includes(reminderKey(lesson)));
    return dueReminder(lessons, now, timeZone);
  }, [upcoming.data, user, dismissed, now, timeZone]);

  if (!due) return null;
  const { lesson, minutes } = due;
  const start = parseClockTime(lesson.start_time) ?? 0;
  const close = () => {
    dismiss(reminderKey(lesson));
    setDismissed(readDismissed());
  };

  return (
    <div
      role="dialog"
      aria-label="Lesson reminder"
      data-testid="lesson-reminder"
      className="glass fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-lg rounded-t-2xl border border-b-0 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-[var(--elevation-2)] motion-safe:animate-in motion-safe:slide-in-from-bottom"
    >
      <div className="flex items-start gap-3">
        <span className="bg-primary text-primary-foreground grid size-9 shrink-0 place-items-center rounded-full">
          <BellIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {minutes <= 1 ? 'Your lesson is starting' : `Your lesson starts in ${minutes} minutes`}
          </p>
          <p className="text-muted-foreground text-sm">
            {formatTimeRange(start, start + lesson.duration_minutes)} · {lesson.tutor_name} with {lesson.student_name}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Dismiss reminder" onClick={close}>
          <XIcon className="size-4" />
        </Button>
      </div>
      <ul className="mt-4 grid gap-2">
        {lesson.locations.map((location) => (
          <li key={location.id} className="flex items-start gap-2 text-sm">
            {location.kind === 'virtual' ? (
              <GlobeIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            ) : (
              <MapPinIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-medium">
                {location.name}
                <span className="text-muted-foreground ml-2 text-xs font-normal">
                  {LOCATION_KIND_LABELS[location.kind]}
                </span>
              </p>
              {location.address &&
                (isLink(location.address) ? (
                  <a
                    href={location.address}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary inline-flex items-center gap-1 break-all underline"
                  >
                    {location.address} <ExternalLinkIcon className="size-3" />
                  </a>
                ) : (
                  <p className="text-muted-foreground break-words">{location.address}</p>
                ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
