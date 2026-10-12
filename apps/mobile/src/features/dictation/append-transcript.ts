// How a dictated phrase joins what a field already holds (P3). Pure: the recognizer's own
// punctuation (`addsPunctuation`) is kept, and no full stop is ever invented.

/** `value` with `transcript` appended: a space between words, a capital to start a sentence. */
export function appendTranscript(value: string, transcript: string): string {
  const text = transcript.trim();
  if (!text) return value;
  const empty = value.trim() === '';
  const separator = value === '' || /\s$/.test(value) ? '' : ' ';
  const sentenceStart = empty || /[.!?]\s*$/.test(value) || /\n\s*$/.test(value);
  const words = sentenceStart ? text.charAt(0).toUpperCase() + text.slice(1) : text;
  return value + separator + words;
}
