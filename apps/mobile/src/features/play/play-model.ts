// Ported from apps/web/src/features/play/play-home.tsx @ 0e3ec7a (working tree): the board's grouping,
// useStartQuest's request and HaveACode's routing -- kept pure here so Jest can hold them.
// Phase 62 (P6-P8, docs/stickiness-plan.md); Phase 67 (H5, H7): the Quest board.
// Phase 73 (docs/journey-fixes-plan.md, JF13/JF14): Continue from the server's open game, and the board's
// grade from the server's lead -- asked once ("Which grade?") only when nothing says.
import {
  GAME_CODE_LENGTH,
  PLATFORM_BRAND,
  QUEST_GRADE_NOT_IN_SCHOOL,
  SPACE_CODE_LENGTH,
  boardGrades,
  boardLeadGrade,
  levelGrade,
  offBoardTiles,
  tileLook,
  type CreateGameRequest,
  type MemberTile,
  type MemberTilesResponse,
  type OpenGameResponse,
  type QuestLead,
  type QuestionBankLevelId,
  type StartCanvasAssessmentInput,
} from '@tmi/shared';

/**
 * Phase 67 (H5): the Quest board's "More levels" -- the tiles off the 1-8 row (Kindergarten, Math 1,
 * Kangaroo 9-12...), grouped by their level in words, in the console's order.
 */
export function offBoardGroups(list: readonly MemberTile[]): [string, MemberTile[]][] {
  const map = new Map<string, MemberTile[]>();
  for (const tile of offBoardTiles(list)) {
    const words = tileLook(tile).level;
    map.set(words, [...(map.get(words) ?? []), tile]);
  }
  return [...map.entries()];
}

/**
 * The grade the board opens on (Phase 73, JF14): the one just tapped on the row, else the server's lead
 * (`tiles.lead`: picked here, recorded for a student, last played, or 13+), else -- nothing known, or an
 * older Worker that sends no lead -- the phone's guest grade (P13) or the first grade (`boardLeadGrade`).
 */
export function shownGrade(
  list: readonly MemberTile[],
  chosen: number | null,
  lead: QuestLead | null | undefined,
  deviceLead?: string | null,
): number | null {
  const grades: number[] = boardGrades(list);
  if (chosen !== null && grades.includes(chosen)) return chosen;
  if (lead && grades.includes(lead.grade)) return lead.grade;
  return boardLeadGrade(list, (deviceLead ?? null) as QuestionBankLevelId | null);
}

type TilesLead = Pick<MemberTilesResponse, 'tiles' | 'lead' | 'ask_grade' | 'picked_grade'>;

/**
 * Phase 73 (JF14): the grade a guest's play on this phone carries into the server's keeping -- once, as the
 * played tiles become favorites -- while the server knows nothing more particular about this person here:
 * nothing picked, recorded or played (it would ask "Which grade?", or lead by age alone). Null otherwise,
 * and from an older Worker (no lead, no route to save it). Only a grade the row reaches.
 */
export function guestGradeToCarry(tiles: TilesLead, guestLevel: string | null | undefined): number | null {
  if ((tiles.picked_grade ?? null) !== null) return null;
  if (!(tiles.ask_grade === true || tiles.lead?.from === 'age')) return null;
  const grade = guestLevel ? levelGrade(guestLevel as QuestionBankLevelId) : null;
  return grade !== null && boardGrades(tiles.tiles).includes(grade) ? grade : null;
}

/**
 * Whether the board asks "Which grade?": the server asks (nothing picked, recorded or played, and no age to
 * go by), no guest grade is being carried instead, and it was not put off ("Not now") in this run.
 */
export function asksGrade(tiles: TilesLead, carrying: number | null, putOff: boolean): boolean {
  return tiles.ask_grade === true && (tiles.picked_grade ?? null) === null && carrying === null && !putOff;
}

/** The chooser's answers: each grade the row reaches ("Grade 6"), then "Not in school" (0: the top of the row). */
export function gradeChoices(list: readonly MemberTile[]): { grade: number; label: string }[] {
  return [
    ...boardGrades(list).map((grade) => ({ grade, label: `Grade ${grade}` })),
    { grade: QUEST_GRADE_NOT_IN_SCHOOL, label: 'Not in school' },
  ];
}

/**
 * Phase 73 (JF13): what Continue does, from the server's open-game read -- open the game the reader is in
 * (running or in its lobby), labelled with where they are ("Continue Grade 7 Quick 5 · question 3 of 5 · 2
 * points"); with none open, start the last one's settings again ("Play Grade 7 Quick 5 again"); else none.
 */
export type ContinueAction =
  | { kind: 'open'; game_id: string; label: string; title: string; where: string | null }
  | { kind: 'again'; label: string; title: string; where: null; request: CreateGameRequest }
  | null;

/** `label` is the whole sentence (read aloud); `title` the button's words and `where` the line under it. */
export function continueAction(data: OpenGameResponse | null | undefined): ContinueAction {
  if (data?.open) {
    const { words, where } = openGameParts(data.open.label);
    return { kind: 'open', game_id: data.open.game_id, label: `Continue ${data.open.label}`, title: `Continue ${words}`, where };
  }
  if (data?.again) return { kind: 'again', label: data.again.label, title: data.again.label, where: null, request: data.again.request };
  return null;
}

/**
 * An open game's label in two parts, for Next up's title and line: "Grade 7 Quick 5" and "Question 3 of 5 · 2
 * points" (or "Waiting to start"). `openGameLabel` joins its parts with " · ", the game's words first.
 */
export function openGameParts(label: string): { words: string; where: string | null } {
  const [words, ...rest] = label.split(' · ');
  const where = rest.join(' · ');
  return { words: words || label, where: where ? `${where[0]!.toUpperCase()}${where.slice(1)}` : null };
}

/**
 * Phase 67 (H7): "Show your work" for oneself -- the tile's level and its number of questions, as the
 * reader's own assessment (allowed in a personal space).
 */
export function assessmentTileRequest(tile: Pick<MemberTile, 'level_id' | 'value'>, me: string): StartCanvasAssessmentInput {
  return { student_user_id: me, level_id: tile.level_id, question_count: tile.value };
}

/**
 * What one tap sends. A single player's game as it is; a multiplayer favorite's with the host already
 * playing (P7), and its roster invited (P8) when it has one.
 */
export function startRequest(
  request: CreateGameRequest,
  roster?: readonly string[] | null,
): CreateGameRequest {
  if (request.players !== 'multi') return request;
  return { ...request, host_plays: true, ...(roster?.length ? { invite_user_ids: [...roster] } : {}) };
}

/** A typed code tidied: spaces and dashes out, upper case ("fmxy-2345" -> "FMXY2345"). */
export function tidyCode(text: string): string {
  return text.replace(/[\s-]/g, '').toUpperCase();
}

/** Six characters is a game; eight a space to ask to join; anything else is not yet a code. */
export function codeKind(text: string): 'game' | 'space' | null {
  const typed = tidyCode(text);
  if (typed.length === GAME_CODE_LENGTH) return 'game';
  if (typed.length === SPACE_CODE_LENGTH) return 'space';
  return null;
}

/**
 * Where a game's code leads (the web's `gameInviteUrl`): the server's own Play home with the code
 * filled in. The Worker serves the web app at the same origin as the API. With no origin known, the
 * code alone -- a camera then shows the code, which is still what to type.
 */
export function gameInviteUrl(origin: string | null | undefined, code: string): string {
  const base = (origin ?? '').replace(/\/+$/, '');
  return /^https?:\/\//.test(base) ? `${base}/?code=${encodeURIComponent(code)}` : code;
}

/** The share sheet's words (the web's LobbyInvite): the code, and nobody's name. */
export function gameShareText(code: string): string {
  return `Join my ${PLATFORM_BRAND.name} game: code ${code}`;
}

/** The roster sheet's toast after saving. */
export function rosterSavedText(name: string, count: number): string {
  return count
    ? `${name} invites ${count} ${count === 1 ? 'person' : 'people'}.`
    : `${name} is open to anyone with the code.`;
}
