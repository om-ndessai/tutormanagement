# The handwriting reader: what was tried, and what it scored

One entry per change to the reader (Phase 54, [the plan](../think-aloud-plan.md)), newest first. The
procedure is the `think-aloud-reader` skill (`.claude/skills/think-aloud-reader/SKILL.md`). Each entry
says what changed, on which corpus, and the scores before and after, so the next person (or agent)
starts from what is known instead of trying it again.

Scores against the **fake** provider measure the pipeline, not reading: never record one as a reading
score.

| Field | Meaning |
| --- | --- |
| exact | Lines whose reading says what was written (`readingMatches`), of all lines |
| unreadable | Lines the reader declined |
| not maths | Readings a student would not be shown (`isMathReading` false) |
| confident exact | Of readings with confidence ≥ 0.9, how many were exact |
| p50 / p90 | Milliseconds per line, picture and model, as the Worker timed it |

## Entries

### 2026-10-28: the baseline pipeline (fake reader)

- **Change.** None: Phase 54 as built. `READ_SYSTEM` first version; `LINE_IMAGE` ink 90 px, padding
  16 px, pen at least 2.4 px; `lineGap` 40% of the typical stroke height, 8-30 units; Claude Haiku
  5.5, effort low.
- **Corpus.** Synthetic, 40 lines (20 lines, neat and hurried).
- **Provider.** Fake. Exact 0/40, as expected (the fake reads a line as its stroke count); no
  failures; every synthetic line found as one line; p50 33 ms, p90 55 ms locally.
- **Next.** The first real measurement: run the synthetic set and the lab's samples with
  `AI_PROVIDER=anthropic` and record them here.
