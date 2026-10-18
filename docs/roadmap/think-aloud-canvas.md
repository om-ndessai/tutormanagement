# Research: the think-aloud canvas (AI-13)

Research for the owner, 18 October 2026. It was revised the same day, when the owner took audio out
of the feature. **The plan is the AI-13 entry in [future-ai.md](future-ai.md#ai-13--the-think-aloud-canvas)**;
this page is the research behind it. Nothing here is scheduled until it is written into
[`docs/plan.md`](../plan.md) as a phase.

**What is asked.** "Thinking out loud" means the student's working on the canvas: they solve a
bank question step by step, in their own handwriting, so the thinking is visible. The app
answers **on the canvas**: a mark beside a line, a hint, a prompt to explain. There is no
microphone and no spoken feedback.

## The answer

**Taking audio out makes the feature much more feasible.**
- **What goes.** The most sensitive data (a child's voice), the least reliable part (recognising
  children's speech) and the split between the app and the web all go.
- **What is left.** The feature becomes AI-7's canvas plus two things:
  - **Approved hints.** Written with each question, and approved by a person with it.
  - **One narrow AI step.** Reading one handwritten line at a time.
- **The real unknown is that reading step.** No published figure covers children's half-finished
  working, and the published evidence says models are weakest exactly there. A spike with staff
  handwriting measures it for a few dollars, before anything is built for students.
- **Most of the design does not depend on it.** Code judges what was read, and a person wrote
  every word shown. **The first stage uses no AI at run time.**

## What removing audio changes

| Concern | With audio | Without audio |
| --- | --- | --- |
| A child's voice | Personal information under COPPA. It needed its own consent, and recognition had to stay on the device. | **Gone.** |
| Recognising children's speech | Published error rates are 9% to over 40%, so the transcript was a clue at best. | **Gone.** |
| Where it can run | Voice input needed on-device engines the web cannot guarantee, so the app came first. | **The web and the app are equal.** A canvas needs only Pointer Events. |
| When to respond | End of speech and pen pauses, which is a turn-taking problem. | **Pen pauses and buttons only, which is predictable.** |
| Real-time voice models | OpenAI's needs zero retention approved before under-13s' data; Gemini's terms exclude under-18s. | **Not needed.** |
| Microphones, noisy rooms, shy students | Real friction, in the institute and at home. | **Gone.** |
| Spoken feedback for weak readers | Built in. | **Lost.** Hints must be short and at the grade's reading level. iOS (Speak Screen) and Android (Select to Speak) can read on-screen text aloud through their own accessibility settings, with no audio in the app. |
| Reading the handwriting | The main risk. | **Still the main risk.** |
| Being right | The model judged the work. | **Code judges what it can; the model only reads.** |
| Consent (F7) | Voice and ink. | **Ink only (`ai_processing`), and stage 1 sends nothing.** |
| Running cost | About 4 cents a half hour. | **About 1 cent a half hour.** The saving comes from reading one line at a time, not from dropping audio: speech was free on the device. |

## What is still hard: reading a child's working

**The evidence.**
- **Handwriting is harder than print for these models.** FERMAT (ACL 2025) gave nine vision
  models 2,200 handwritten solutions for grades 7–12. Some read the same work better when it
  was printed. The best corrected 77% of errors.
- **Misreading causes most mistakes.** A May 2026 study graded university students' handwritten
  maths with GPT-5.1, GPT-5-mini and Gemini 3 Flash:
  - **Where the errors came from.** 87% of the best model's errors were misreadings, not
    misjudgements.
  - **Inventing content.** Models sometimes invented content that resembled the reference
    solution, so they credited answers they had not actually read.
  - **Quality matters.** Blurred or badly organised work made it worse.
  - **Not tested.** No Claude model was in the study.
- **Multi-line maths is the weak spot.** OmniHandwritingOCR (August 2026) compared 13 systems.
  They are "far from faithful transcription", and worst on multi-line formulas. Several made
  plausible corrections that the handwriting did not support.
- **They are weakest on the students who most need help.** In a 2026 follow-up to DrawEduMath
  (real K-12 students' handwritten work), all 11 models did worst on the work of students who
  needed more help, and worst of all on questions about the student's error.
- **Specialists beat general models on single expressions.** Uni-MuMER, a model fine-tuned for
  handwritten maths (NeurIPS 2025), beat Gemini 2.5 Flash on the standard benchmarks. Those
  benchmarks are single expressions written by adults.
- **Children are barely studied.** One 2024 paper (AIED) asks whether vision models can read
  children's handwritten equations. Nothing published measures children's multi-step working.
- **Earlier tutors met the same problem.** Carnegie Mellon's handwriting algebra tutor (Anthony,
  Yang and Koedinger) argued that writing lowers students' extra mental load compared with
  typing. It still needed an interaction design that kept recognition errors from affecting
  learning.

**What the design does about it.**
1. **Read one line at a time.** A single short expression is the best-studied case, and its
   image is small, so it is cheap and quick.
2. **Read blind.** The reader never sees the answer or the worked solution, so it has nothing
   to "correct" a mistake towards. That is the failure the 2026 study saw.
   - That study's authors preferred one call that reads and grades together.
   - Here the judge is code, not a model, so reading is a separate call. The spike should
     compare blind and informed reading.
3. **Code judges.** Arithmetic is evaluated exactly. Equations are checked by putting the
   question's own solution into them. A model never decides that a step is right or wrong.
4. **Show what was read.** Every flag says "I read: …" and offers "That's not what I wrote".
   - **A misreading is never presented as the student's mistake.**
   - **Each tap measures the reader's accuracy in real use**, which AG4 needs before any
     automatic release.
5. **Stay quiet when unsure.** An unreadable line, or one code cannot judge, is never flagged.

## Options for reading the ink

| Reader | Where the ink goes | Fit |
| --- | --- | --- |
| **Claude Haiku 5.5**, a line's image | Anthropic, already the portal's AI provider; images are not kept or used for training | About $0.0001 a line. Nothing measures it on children's handwriting. Not yet on `AI_MODELS`. |
| **Claude Sonnet 5.5** | The same | About 20 times Haiku's price. A fallback if Haiku misreads. |
| **Mathpix Strokes** | Mathpix, a second vendor; retention can be switched off per key | Built for handwritten maths, about $0.002 a line. It never sees the answer, so it is blind by nature. |
| **A Workers AI vision model**: Llama 4 Scout, Mistral Small 3.1, Qwen 3.8, Moondream 3.1 (which also does OCR) | Stays within Cloudflare, which already hosts all the data and does not train on it | Untested on handwriting. Worth one column in the spike, because a good result keeps the ink with the vendor that already holds everything. |
| **MyScript's native SDK** (iOS and Android) | **Nothing leaves the device** | Recognises maths on the device. It needs a commercial licence and a native Expo module: there is no React Native SDK. |
| **PencilKit's `PKStrokeRecognizer`** (iPadOS 27, WWDC26) | Nothing leaves the device | Apple's on-device handwriting recognition. It is described for words, not maths notation, so test digits and simple sums before relying on it. iPad only. |
| **An open model in the browser** (`pix2text-mfr`, ONNX and WebGPU) | Nothing leaves the device | AI-7 stage 3. Benchmarked on single expressions only. |
| **Google ML Kit digital ink** | Nothing leaves the device | It has no maths model. |

**Where to start.** The spike compares Haiku, Sonnet, Mathpix and one Workers AI model on the
same lines. A reader on the device is the long-term goal, because then the child's work never
leaves the tablet.

## Three ways to build it

| | How it works | AI at run time | Covers | Risk |
| --- | --- | --- | --- | --- |
| **A. Hints on request** | The student works on the canvas and taps Hint for the question's next approved hint. The final answer is checked by code. | None | Every question | It cannot see the work, so it cannot point at a line. |
| **B. Read, then code judges** | Each finished line is read blind. Code checks it against the line before it, the question's key values and its known wrong answers, then flags it or offers the matching approved hint. | One reading call per line | Lines code can evaluate: arithmetic, numbers, linear equations | Misreadings, which "I read: …" exposes. |
| **C. A model judges** | A model sees the work and the solution and decides what is wrong. | One judging call per look | Everything, including words and drawings | A model's judgement reaching a child. Models are weakest at assessing errors (DrawEduMath). |

**The recommendation: A, then B, with C only as a suggestion to the tutor.**
- **A** is useful on its own, and safe from the first day.
- **B** adds the feedback on the working that makes tutoring systems effective, without a
  model's opinion reaching the child.
- **C** suits what code cannot check, such as number lines, area models and written reasons. A
  tutor sees its suggestion first.

## How much of the bank code can check

5,658 of the bank's 9,712 questions (58%) carry an exact `compute` expression, the arithmetic
the answer must equal. They are the questions where code can check the student's numbers.

| NC 2026 domain | Questions | With exact arithmetic |
| --- | --- | --- |
| Algebraic and Numerical Reasoning, `ANR` (grades 3–7) | 2,981 | 67% |
| Spatial, Geometric, and Measurement Reasoning (grades 3–8, Math 1) | 2,574 | 59% |
| Reasoning with Data (grades 3–8) | 1,782 | 54% |
| Algebraic and Numerical Reasoning, `ANFR` (grade 8, Math 1) | 1,188 | 47% |
| Statistics and Data Science Reasoning (Math 1) | 593 | 36% |
| Ratio and Proportional Reasoning (grades 6–7) | 495 | 70% |
| Reasoning with Mathematics Modeling (Math 1) | 99 | 44% |

The other 42% are mostly comparisons, statements to choose between, shapes and data displays.
They get hints on request (A), and a tutor-first suggestion (C) if that is ever built.

## The evidence for feedback on the canvas

- **Feedback on each step.** In VanLehn's review of tutoring systems (*Educational Psychologist*,
  2011), the effect against no tutoring was:

  | Feedback on | Effect |
  | --- | --- |
  | Each step | 0.76 |
  | The final answer only | 0.31 |
  | Human tutors | 0.79 |

  Step feedback is the case for reading the canvas at all.
- **Flagging rather than correcting.** In the Lisp Tutor (Corbett & Anderson), marking an error
  without explaining it, and leaving the student in control, did not slow learning compared with
  immediate correction. A "?" in the margin is that flag.
- **Explaining, without writing sentences.** In the Geometry Cognitive Tutor (Aleven & Koedinger,
  *Cognitive Science*, 2002), students who explained their steps by choosing a reason from a
  glossary learned with more understanding. Prompts to explain help in maths generally:
  - small to moderate gains (Rittle-Johnson et al., 2017);
  - an effect of g = 0.55 across subjects (Bisra et al., 2018).

  Tapping one of a few approved reasons suits an eight-year-old better than writing one.
- **Hints when asked.**
  - **Asking beat being told.** Students learned more from hints they asked for than from hints
    given unasked (Razzaq & Heffernan, 2010).
  - **System-triggered hints showed no reliable effect.** A 2025 K-12 meta-analysis found no
    significant effect for hints the system triggers.
  - **Proactive help suits students who never ask** (Maniktala et al.).

  So hints wait for the Hint button, and a long stall only makes the button pulse.
- **Never the answer.** In Bastani et al. (*PNAS*, 2025), an unguarded GPT-4 raised practice
  scores by 48% but cut exam scores by 17% once taken away. A guarded tutor did no harm.
- **AI-written hints, once checked.** In Pardos & Bhandari (*PLOS ONE*, 2024), ChatGPT's hints
  taught as well as tutors' hints, but 32% failed a quality check before extra checking. That is
  why hints are written offline, checked, and approved, like the questions.
- **A person in the loop.**
  - **Tutor CoPilot.** Topic mastery rose by 4 percentage points, and by 9 for tutors rated
    lower.
  - **LearnLM with Eedi.** Under supervision, the AI helped students fix 93.0% of their
    mistakes, against 91.2% for tutors alone.

  Both support showing anything uncertain to a tutor first.

## The canvas itself

- **The web.** Pointer Events with perfect-freehand, as AI-7 designs it: pen-only input, palm
  rejection, and the strokes kept. It works on an iPad in Safari, on touchscreen laptops and on
  Chromebooks with a stylus.
- **The app.** `@shopify/react-native-skia` with the gesture-handler and reanimated packages the
  app already has, on iOS and Android. The PencilKit wrappers are iOS only and keep the strokes
  in Apple's format.
- **Lines.** Faint rules guide one step per line, and the app finds each line from the gaps in
  the ink, so a stacked fraction stays within its line. The app always knows exactly where a
  line is, so a mark lands on it without asking a model for coordinates. Anthropic describes
  Claude's coordinates as approximate.
- **The device.** A tablet with a stylus. Maths written with a finger on a phone is probably
  too rough to read, so phones may stay with hints on request.

## What exists

| Who | What it does | How it differs |
| --- | --- | --- |
| **Mathspace** | Reads each handwritten line on an iPad, marks it, and offers hints when a path stops making sense. | The closest product. It is a commercial platform, not part of this portal or its bank. |
| **Apple Math Notes** | Solves handwritten sums live. | A calculator, not a tutor. I found no developer API. |
| **AI-notebook** (open source) | Reads a whiteboard with Mathpix and Gemini, and draws hints on the canvas. | A prototype for one school. Gemini's API terms exclude under-18s. |
| **MathNotes** | A Gemini tutor that reads handwritten notes. | A consumer app on Gemini. |
| **Khanmigo** (2026) | Draws interactive diagrams and responds when they are moved. | It does not read the student's own handwriting. |

## Privacy without audio

These are not legal advice; see [F7](feature-plans.md#f7--consent-and-privacy-centre) and
AG1–AG3 in [future-ai.md](future-ai.md#ai-governance).

| Stage | What leaves the tablet | Consent |
| --- | --- | --- |
| 1, hints on request | Nothing, if the working is not saved. Which hints were used, if progress records it. | No AI consent, since nothing goes to a model. Saving the working, or a student signing in, is F7's whiteboard or student-account case. |
| 2, reading | One line's image at a time, with no name on it. | `ai_processing` (AG1). There is no voice purpose and nothing biometric. |

- **Send the least (AG2).** The reader gets a picture of one line, never the strokes' timing and
  pressure, which describe how a person writes as well as what. The strokes stay on the device.
- **Readings shown only as maths.** "I read: …" is shown only when the reading parses as maths
  (digits, letters, operators). No sentence a model wrote can reach the student that way, which
  keeps the rule that nothing a model writes reaches a student unapproved.
- **The SSN guard.** It runs on every reading, as on every `runAi` reply. A refused reading is
  treated as unreadable.

## The spike (stage 0)

It touches no child's data, and costs a few dollars.
- **The samples.** Staff write about 200 lines for 20 bank questions on an iPad, imitating
  children:
  - right steps
  - typical slips: a lost sign, adding denominators, place value
  - half-finished lines
  - messy writing
  - column arithmetic
  - stacked fractions
- **The readers.** Claude Haiku 5.5, Claude Sonnet 5.5, Mathpix and one Workers AI vision model,
  each reading blind. Haiku and Sonnet are also tried with the solution in view.
- **The measures, with suggested pass marks for the owner to set:**

  | Measure | Suggested pass mark |
  | --- | --- |
  | Lines read exactly | ≥ 95% of clear lines |
  | Wrong lines read as right (the dangerous error, a missed flag) | ≤ 2% |
  | Right lines read as wrong (recoverable through "I read: …", but they erode trust) | ≤ 3% |
  | Unreadable | Reported only; the coach stays quiet |
  | Pause to flag | ≤ 2 seconds for 90% of lines, on the institute's iPads |

- **The hints.** Ladders for two standards are written, checked and reviewed, which shows how
  long review takes.

## Decisions for the owner

1. **The three rules.** The model reads, code judges and a person wrote the words. Unasked
   feedback only on what code has checked. Show what was read.
2. **Stage 1 first.** Hints on request with no AI at run time, in lessons on an institute iPad.
3. **Run the spike?** It decides which reader to use, and whether stage 2 is worth building.
4. **Hint ladders.** For the whole bank, or for each standard as it is first used.
5. **The foundations.** F7 before stage 2. F1 before students practise alone.
6. **Ticks on correct lines.** Off by default, with the tutor able to turn them on?

## Sources

**Reading handwritten maths.**
- [FERMAT (ACL 2025)](https://aclanthology.org/2025.acl-long.720/)
- [Grading handwritten maths with vision models (2026)](https://arxiv.org/abs/2605.19043)
- [OmniHandwritingOCR (2026)](https://arxiv.org/abs/2608.18586)
- **DrawEduMath.**
  - [The benchmark](https://arxiv.org/abs/2501.14877)
  - [Its 2026 follow-up](https://arxiv.org/abs/2603.00925)
- [Uni-MuMER (NeurIPS 2025)](https://arxiv.org/abs/2505.23566)
- Júnior et al., "Can VLM understand children's handwriting?", AIED 2024 Companion,
  [doi:10.1007/978-3-031-64315-6_28](https://doi.org/10.1007/978-3-031-64315-6_28)
- **Carnegie Mellon's handwriting tutor.**
  - [Handwriting against typing in Cognitive Tutor Algebra](https://learnlab.org/research/wiki/index.php/In_vivo_comparison_of_Cognitive_Tutor_Algebra_using_handwriting_vs_typing_input)
  - [Anthony et al., CHI 2011](https://lisa-anthony.com/wp-content/uploads/2011/10/anthony-et-al-chi2011-cci.pdf)

**Readers and the canvas.**
- **Anthropic.**
  - [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)
  - [Claude vision: image tokens, coordinates and retention](https://platform.claude.com/docs/en/build-with-claude/vision)
- [Mathpix strokes](https://docs.mathpix.com/reference/post-v3-strokes)
- [Workers AI models](https://developers.cloudflare.com/workers-ai/models/)
- **MyScript.**
  - [Platforms](https://developer.myscript.com/doc/interactive-ink/4.5/overview/platforms/)
  - [On offline recognition](https://developer-support.myscript.com/support/discussions/topics/16000032257)
- **PencilKit.**
  - [WWDC26 session](https://developer.apple.com/videos/play/wwdc2026/203)
  - [Recognizing handwriting](https://developer.apple.com/documentation/pencilkit/recognizing-handwriting-and-converting-to-text)
- [Drawing with react-native-skia](https://notesnook.com/blog/drawing-app-with-react-native-skia)
- [react-native-pencil-kit](https://github.com/mym0404/react-native-pencil-kit)

**Teaching.**
- **Tutoring systems and feedback.**
  - [VanLehn 2011, through a reproduction of its table](https://marginalrevolution.com/marginalrevolution/2013/10/how-good-are-computers-as-tutors.html)
  - [Corbett & Anderson, feedback control in the Lisp Tutor](https://escholarship.org/uc/item/1vt1j669)
- **Explaining steps.**
  - [Aleven & Koedinger 2002](https://serc.carleton.edu/resources/40402.html)
  - [Rittle-Johnson et al. 2017](https://link.springer.com/article/10.1007/s11858-017-0834-z)
  - [Bisra et al. 2018](https://link.springer.com/article/10.1007/s10648-018-9434-x)
- **When to give hints.**
  - [Razzaq & Heffernan 2010](https://www.doi.org/10.1007/978-3-642-13388-6_39)
  - [K-12 tutoring-systems meta-analysis](https://arxiv.org/abs/2511.04997)
  - [Maniktala et al.](https://arxiv.org/abs/2010.04124)
- **AI in tutoring.**
  - [Bastani et al.](https://papers.ssrn.com/abstract=4895486)
  - [Pardos & Bhandari](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11125466/)
  - [Tutor CoPilot](https://arxiv.org/abs/2410.03017)
  - [LearnLM–Eedi](https://arxiv.org/abs/2512.23633)

**Products.**
- [Mathspace's handwriting](https://classtechtips.com/2015/03/17/mathspace-step-by-step-math-handwriting-for-ipad/)
- [AI-notebook](https://github.com/abdulhamid-n/AI-notebook)
- [MathNotes](https://www.mathnotes.io/blog/ai-math-tutor)
- [Khanmigo's 2026 visuals](https://www.edtechinnovationhub.com/news/khan-academy-brings-gemini-powered-visual-tutoring-into-classrooms-for-2026)
