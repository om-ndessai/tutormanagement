// Spoken curriculum codes, written the way the catalogue writes them (P3): "B A three point ten",
// "BA 3.10" -> BA3.10; "pre two", "pre point two" -> PRE.02. Only a code that exists in the
// catalogue is rewritten; anything else is left exactly as heard.

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  'twenty one': 21,
  'twenty two': 22,
};

const NUMBER =
  '(\\d{1,2}|twenty[\\s-](?:one|two)|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)';
const POINT = '\\s*(?:point|dot|\\.)\\s*';
// "B A", "BA", "B.A.", "bee a" + the grade + point + the topic.
const BA = new RegExp(`\\b(?:b\\.?\\s?a\\.?|bee\\s+a)\\s*${NUMBER}${POINT}${NUMBER}\\b`, 'gi');
// "pre", "alg", "geo" + (point) + the topic. Never the full words: "geometry two problems" stays.
const OTHER = new RegExp(`\\b(pre|alg|geo)(?:${POINT}|\\s+)${NUMBER}\\b`, 'gi');

function toNumber(spoken: string): number | null {
  const key = spoken.toLowerCase().replace('-', ' ');
  if (/^\d+$/.test(key)) return Number(key);
  return NUMBER_WORDS[key] ?? null;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function normaliseTopicCodes(text: string, topicIds: ReadonlySet<string>): string {
  if (topicIds.size === 0) return text;
  const replaced = text.replace(BA, (heard, grade: string, topic: string) => {
    const g = toNumber(grade);
    const t = toNumber(topic);
    if (g === null || t === null) return heard;
    const id = `BA${g}.${pad(t)}`;
    return topicIds.has(id) ? id : heard;
  });
  return replaced.replace(OTHER, (heard, level: string, topic: string) => {
    const t = toNumber(topic);
    if (t === null) return heard;
    const id = `${level.slice(0, 3).toUpperCase()}.${pad(t)}`;
    return topicIds.has(id) ? id : heard;
  });
}
