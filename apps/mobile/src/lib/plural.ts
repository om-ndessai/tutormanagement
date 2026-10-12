/** "1 session", "2 sessions" (ux-audit F-25: the parent's Home read "1 sessions"). */
export function countOf(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
