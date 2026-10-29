// node lint.mjs <draft file>...   Runs lintQuestion against the bank and every other draft on the topic.
import { bareLatex } from './bare-latex.mjs';
// Exit 1 if any problem. Prints giveaway warnings (key strictly longest/shortest share; option alone in its ending).
import { basename } from 'node:path';
import { readJson, shared, bankByTopic, draftsFor, standards } from './common.mjs';
const STD = new Set(standards().map((s) => s.id));
const bank = bankByTopic();
let bad = 0;
for (const file of process.argv.slice(2)) {
  let d; try { d = readJson(file); } catch (e) { console.log(`${file}: not valid JSON: ${e.message}`); bad++; continue; }
  if (!Array.isArray(d.questions)) { console.log(`${file}: needs {part, notes, questions:[...]}`); bad++; continue; }
  const othersCache = new Map();
  const othersOf = (topic) => { if (!othersCache.has(topic)) othersCache.set(topic, [...(bank.get(topic) ?? []).map((q) => q.stem), ...draftsFor(topic).filter((q) => q._file !== basename(file)).map((q) => q.stem)]); return othersCache.get(topic); };
  const mineBy = new Map(); let longest = 0, shortest = 0, choiceN = 0;
  d.questions.forEach((q, i) => {
    const probs = [];
    const topic = q.topic_id ?? d.topic_id;
    if (!topic || !STD.has(topic)) probs.push(`topic_id ${topic} is not an NC 2017 standard`);
    if (!mineBy.has(topic)) mineBy.set(topic, []);
    const mine = mineBy.get(topic); const others = othersOf(topic);
    for (const f of ['skill', 'stem', 'answer', 'solution']) if (typeof q[f] !== 'string' || !q[f].trim()) probs.push(`${f} missing`);
    if (![1, 2, 3].includes(q.difficulty)) probs.push('difficulty must be 1, 2 or 3');
    if (!['choice', 'numeric'].includes(q.kind)) probs.push('kind must be choice or numeric');
    if (!probs.length) {
      const c = { kind: q.kind, stem: q.stem, choices: q.choices ?? [], answer: q.answer, compute: q.compute || null, solution: q.solution };
      probs.push(...shared.lintQuestion(c, [...others, ...mine]));
      const texts = [q.stem, q.solution, ...(q.choices ?? []), q.answer];
      { const b = texts.map(bareLatex).find(Boolean); if (b) probs.push(`"${b}" inside $...$ without its backslash (write \\\\${b} in the file)`); }
      if (texts.some((t) => /[\x00-\x09\x0b-\x1f]/.test(String(t)))) probs.push('a control character (tab, form feed...) in the text: a LaTeX backslash was lost in JSON ("\\times" must be written "\\\\times" in the file)');
      const spans = (t) => String(t).match(/\$[^$]*\$/g) ?? [];
      if (texts.some((t) => spans(t).some((m) => /(^|[^\\a-zA-Z])pi\b/.test(m)))) probs.push('bare "pi" inside $...$: write \\pi');
      if (texts.some((t) => /\\(vec|langle|rangle|binom|begin|mathbb|overrightarrow|cup|cap|in|subset|emptyset)\b|\\sqrt\[/.test(String(t)))) probs.push('LaTeX the PDF cannot print (\\vec, \\langle, \\binom, \\begin, \\mathbb, \\sqrt[n], set symbols): write it in words');
      if (q.kind === 'choice' && (q.choices ?? []).length === 4) {
        choiceN++;
        const L = q.choices.map((x) => x.length); const k = q.choices.findIndex((x) => shared.normalizeChoice(x) === shared.normalizeChoice(q.answer));
        if (k >= 0) { if (L.every((l, j) => j === k || l < L[k])) longest++; if (L.every((l, j) => j === k || l > L[k])) shortest++; }
        const end = (x) => (/[.?!]$/.test(x.trim()) ? 'stop' : 'none');
        const ends = q.choices.map(end); const keyEnd = ends[k];
        if (k >= 0 && ends.filter((e) => e === keyEnd).length === 1) probs.push('GIVEAWAY: the key is the only option ending ' + (keyEnd === 'stop' ? 'with a full stop' : 'without a full stop'));
        if (/\b[Oo]ption [A-D]\b|\b[Cc]hoice [A-D]\b|\([A-D]\)/.test(q.solution)) probs.push('the solution names an option by its position');
      }
    }
    mine.push(q.stem);
    if (probs.length) { bad++; console.log(`${basename(file)} #${i} [d${q.difficulty}]: ${probs.join(' | ')}`); }
  });
  const pct = (n) => (choiceN ? Math.round((100 * n) / choiceN) : 0);
  console.log(`${basename(file)}: ${d.questions.length} questions (${choiceN} choice; key strictly longest ${pct(longest)}%, strictly shortest ${pct(shortest)}%; keep each under 15%)`);
}
console.log(bad ? `${bad} problem(s)` : 'clean');
process.exit(bad ? 1 : 0);
