import { DAYS_OF_WEEK, type AvailabilitySlot } from '@tmi/shared';

import { cn } from '@/lib/utils';

/**
 * Tutoring happens after school and at weekends, so the grid covers 07:00 to
 * 21:00 rather than all 24 hours. The table stores any hour 0-23; this is
 * only what the picker offers.
 */
const FIRST_HOUR = 7;
const LAST_HOUR = 21;
const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);

const key = (day: number, hour: number) => `${day}-${hour}`;

/**
 * One cell is one hour block, matching the `availability_slots` row exactly:
 * (day_of_week, hour) means that day from hour:00 to hour+1:00.
 */
export function AvailabilityPicker({
  value,
  onChange,
}: {
  value: AvailabilitySlot[];
  onChange: (slots: AvailabilitySlot[]) => void;
}) {
  const selected = new Set(value.map((slot) => key(slot.day_of_week, slot.hour)));

  function toggle(day_of_week: number, hour: number) {
    onChange(
      selected.has(key(day_of_week, hour))
        ? value.filter((slot) => !(slot.day_of_week === day_of_week && slot.hour === hour))
        : [...value, { day_of_week, hour }],
    );
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">General availability</span>
        <span className="text-muted-foreground text-xs">
          {value.length} hour{value.length === 1 ? '' : 's'} selected
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0.5 text-[10px]">
          <thead>
            <tr>
              <th className="w-10" />
              {HOURS.map((hour) => (
                <th key={hour} className="text-muted-foreground w-7 pb-1 font-normal">
                  {hour}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS_OF_WEEK.map((day) => (
              <tr key={day.value}>
                <th className="text-muted-foreground pr-1 text-right font-normal">{day.short}</th>
                {HOURS.map((hour) => {
                  const on = selected.has(key(day.value, hour));

                  return (
                    <td key={hour}>
                      <button
                        type="button"
                        onClick={() => toggle(day.value, hour)}
                        aria-pressed={on}
                        aria-label={`${day.label} ${hour}:00 to ${hour + 1}:00`}
                        className={cn(
                          'size-6 rounded-[3px] border transition-colors',
                          on
                            ? 'bg-primary border-primary'
                            : 'border-border hover:bg-accent bg-transparent',
                        )}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-muted-foreground text-xs">
        Each square is one hour, starting at the time shown.
      </p>
    </div>
  );
}
