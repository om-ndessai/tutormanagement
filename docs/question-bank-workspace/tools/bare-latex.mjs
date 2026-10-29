// Shared check: a LaTeX command written without its backslash inside $...$ (e.g. "53^circ", "frac{1}{2}").
export const BARE = /(?<![\\a-zA-Z])(circ|frac|dfrac|sqrt|times|cdot|div|theta|angle|triangle|infty|approx|cong|parallel|perp|overline|alpha|beta|sigma|mu|sin|cos|tan|sec|csc|cot|log|ln|pm|le|ge|ne|neq|leq|geq)(?![a-zA-Z])/;
export function bareLatex(text) {
  for (const span of String(text).match(/\$[^$]*\$/g) ?? []) {
    const plain = span.replace(/\\text\{[^}]*\}/g, ' ');
    const m = plain.match(BARE); if (m) return m[1];
  }
  return null;
}
