import { lessonWhen, type HomeLesson } from '@tmi/shared';

const firstName = (name: string) => name.split(/\s+/)[0] ?? name;
const capital = (text: string) => (text ? `${text[0]!.toUpperCase()}${text.slice(1)}` : text);

/**
 * Phase 74 (JF17): a lesson line says where, when the schedule names a place -- "Tue at 4:00 PM with Alex · Institute,
 * room 2". The place is the location's NAME, never its address or link (R16, R29).
 */
export function lessonLine(lesson: HomeLesson, today: string, options: { capitalise?: boolean } = {}): string {
  const when = lessonWhen(lesson.occurs_on, lesson.start_time, today);
  const place = lesson.place?.name ? ` · ${lesson.place.name}` : '';
  return `${options.capitalise ? capital(when) : when} with ${firstName(lesson.tutor_name)}${place}`;
}
