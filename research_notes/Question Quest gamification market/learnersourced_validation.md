# Learnersourced and reviewer-based validation of content: quality, rubber-stamping and countermeasures (as of 21 October 2026)

Scope note for the report writer: research was run on 21 October 2026. The session's shared web-search budget ran out partway through, so a few threads (Stack Exchange audit mechanics, SAT/NAEP pretest details, ASSISTments practice) could not be finished; they are listed under Gaps rather than filled from memory. Several Stack Exchange and PubMed Central pages could not be fetched directly (blocked or behind a browser check); where a mirror or the Europe PMC copy was used, that is noted. Figures carry the year of the study they come from.

## 1. Games with a purpose and labelling through play (ESP Game, reCAPTCHA, Foldit, Duolingo translation, Zooniverse): what made them work and what quality control they used

### Takeaway
Every successful system decided correctness through redundancy plus known-answer gating, not through a single contributor's word. reCAPTCHA accepted a word only after at least 2.5 "votes" (two agreeing humans plus an OCR guess, or three agreeing humans), and only from users who had passed a known "control" word. The ESP Game stored a label only after N independent pairs agreed, from players who had passed test images. Snapshot Serengeti retired an image only after 5 to 25 classifications, and sent low-agreement images to experts. With those controls, crowds matched or beat a single expert: 99.1% word accuracy for reCAPTCHA (2008), and 97.9% species accuracy for Serengeti (2016).

### Cited Findings

#### ESP Game (von Ahn and Dabbish, CHI 2004; Google Image Labeler 2006 to 2011)
- Two randomly paired strangers who cannot communicate each try to type the same word for an image. Sessions are 15 images in 2.5 minutes. Only words both players typed are kept, and all other guesses are discarded. — [Wikipedia: ESP game](https://en.wikipedia.org/wiki/ESP_game); [Survey of incentives in human computation (arXiv 1602.03277)](https://arxiv.org/pdf/1602.03277)
- "Taboo words" (the labels already agreed for an image, up to six shown) force more specific labels. Later versions store a label only after N pairs have agreed on it. — [Wikipedia: ESP game](https://en.wikipedia.org/wiki/ESP_game)
- Main anti-cheating control: occasional test images with known labels, with "a player's guesses are only stored if they successfully label the test images". If X is the chance that a wrong label slips past the test images, requiring N independent agreements cuts it to X^N (this assumes the repetitions are independent). — [Wikipedia: ESP game](https://en.wikipedia.org/wiki/ESP_game)
- Throughput: 3.89 ± 0.69 labels per minute per pair (2004 paper). 36 million labels were collected from October 2003 to May 2008. — [Wikipedia: ESP game](https://en.wikipedia.org/wiki/ESP_game)
- Known failure mode: players converge on obvious labels, which a language model can largely predict, so the labels add little information. A Microsoft project built a program that played the game without looking at the image. Google licensed the game in 2006 as Google Image Labeler and shut it down on 16 September 2011. — [Wikipedia: ESP game](https://en.wikipedia.org/wiki/ESP_game)

#### reCAPTCHA (von Ahn, Maurer, McMillen, Abraham and Blum, Science 2008)
- Each challenge pairs an unknown word with a "control" word whose answer is known. The answer for the unknown word is recorded only if the user typed the control word correctly: a gold-standard gate on every single contribution. — [von Ahn et al. 2008, Science (PDF)](https://www.site.uottawa.ca/~stan/csi2911/reCaptcha_Science.pdf)
- Voting rule: each human answer counts 1 vote and each OCR guess 0.5. A spelling needs at least 2.5 votes. If the first three human guesses agree with each other but with neither OCR, the word is accepted and becomes a control word itself. A word that six users reject as unreadable is discarded. — [von Ahn et al. 2008](https://www.site.uottawa.ca/~stan/csi2911/reCaptcha_Science.pdf)
- Responses needed per word: 67.87% of words needed only 2 human responses, 17.86% needed 3, 7.10% needed 4, 3.11% needed 5, and 4.06% needed 6 or more (including words discarded as unreadable). — [von Ahn et al. 2008](https://www.site.uottawa.ca/~stan/csi2911/reCaptcha_Science.pdf)
- Accuracy: on 50 New York Times articles (1860 to 1970, 24,080 words), reCAPTCHA scored 99.1% word accuracy (216 errors), against 83.5% for standard OCR (3,976 errors). The professional double-keyed "ground truth" itself originally held 189 errors, "almost as many as those made by reCAPTCHA". — [von Ahn et al. 2008](https://www.site.uottawa.ca/~stan/csi2911/reCaptcha_Science.pdf)
- Anti-gaming: control words are normalised in frequency, and the control vocabulary exceeds 100,000 words, so a bot guessing at random succeeds 1 time in 100,000. — [von Ahn et al. 2008](https://www.site.uottawa.ca/~stan/csi2911/reCaptcha_Science.pdf)
- Scale after one year: more than 1.2 billion CAPTCHAs solved and more than 440 million words deciphered, at a rate above 4 million words a day. — [von Ahn et al. 2008](https://www.site.uottawa.ca/~stan/csi2911/reCaptcha_Science.pdf); [ScienceDaily, Aug 2008](https://www.sciencedaily.com/releases/2008/08/080814154329.htm)

#### Foldit (2010 and 2011)
- A 2010 *Nature* paper (Cooper et al.) credited Foldit's roughly 57,000 players with results that matched or outperformed algorithmically computed solutions. — [Wikipedia: Foldit](https://en.wikipedia.com/wiki/FoldIt)
- In 2011 (*Nature Structural & Molecular Biology* 18:1175–1177), players built a model of the M-PMV retroviral protease good enough for molecular replacement, which had defeated earlier attempts. Press accounts say the model came within about 10 days of a three-week puzzle, and credit the "Foldit Contenders" group of about 15 active players. — [DOI 10.1038/nsmb.2119](https://www.doi.org/10.1038/NSMB.2119); [GenomeWeb](https://www.genomeweb.com/node/276701); [Analytica World](https://www.analytica-world.com/en/news/134434/gamers-succeed-where-scientists-fail.html)

#### Duolingo's crowdsourced translation (about 2012 to 2014; secondary sources only)
- Several learners translated the same sentence and software compared the versions to settle on one. Publishers such as BuzzFeed and CNN paid about 4 cents a word, against an industry rate of 6 to 10 cents, at close to 600 articles a day. Luis von Ahn is reported as saying the output was better than machine translation but "typically just short of professional quality". The feature was discontinued because the business model was not competitive, with critics citing quality-assurance problems and "a higher risk of wrong feedback" for advanced learners. — [HBS Digital Initiative case](https://d3.harvard.edu/platform-digit/submission/duolingo-using-the-wisdom-of-crowds-to-translate-language/); [HBS: Learning New Lessons at Duolingo](https://d3.harvard.edu/platform-digit/?p=7588); [GMR Transcription](https://gmrtranscription.com/blog/duolingo-finalize-translation-deals-buzzfeed-cnn); [Circuit magazine](https://www.circuitmagazine.org/dossier-138/translation-as-a-method-crowdsourcing-as-a-tool). These are student case write-ups and trade blogs, and the attribution of each figure among them is approximate.

#### Zooniverse: Snapshot Serengeti and Galaxy Zoo
- Snapshot Serengeti data paper (Swanson et al., *Scientific Data* 2015): more than 28,000 registered and about 40,000 unregistered volunteers made 10.8 million classifications of 1.2 million image sets. Plurality consensus agreed with 4,149 expert "gold-standard" image sets 96.6% of the time on species and 90% on counts. — [Nature Scientific Data blog](https://blogs.nature.com/scientificdata/?p=3055); [PMC4460915](https://pmc.ncbi.nlm.nih.gov/articles/PMC4460915)
- Swanson, Kosmala, Lintott and Packer, *Conservation Biology* 30(3):520–531 (2016) found these thresholds:
  - **Volunteers needed:** about 90% species accuracy with 5 volunteers, 95% with 10, and about 98% after roughly 20.
  - **Retirement rules:** an image is retired after 5 consecutive "nothing here" answers, 10 non-consecutive "nothing here" answers, or 10 matching species classifications. Otherwise it is retired at 25 classifications. Images with animals actually received 11 to 57 classifications (median 27).
  - **Consensus accuracy:** the aggregated answers matched experts on 97.9% of all images and 98.6% of resolvable images. Individual experts matched the expert consensus only 96.6% of the time, so the crowd was slightly more accurate than a single expert.

  — [Swanson et al. 2016, Europe PMC copy](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4999033/fullTextXML) (also [PMC4999033](https://pmc.ncbi.nlm.nih.gov/articles/PMC4999033/))
- Uncertainty routing in the same 2016 paper: 99.8% of images whose votes had an "evenness" below 0.5 were correct, against 85% above 0.5 and 71% above 0.75. The authors recommend expert review of the high-evenness images. Rare species kept high false-positive rates even after 30 classifiers (for example, aardwolf about 50% accurate, jackal about 70%). — [Swanson et al. 2016](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4999033/fullTextXML)
- Galaxy Zoo (Lintott et al., MNRAS 2008): more than 4 × 10^7 classifications by about 10^5 volunteers agreed with professional catalogues "better than 90% in most cases". The team tested weighting users by how often they agreed with the majority and found it made little difference. — [arXiv 0804.4483](https://arxiv.org/pdf/0804.4483); [Salganik, *Bit by Bit*, Galaxy Zoo](https://www.bitbybitbook.com/en/mass-collaboration/human-computation/galaxy-zoo/)

#### Paid crowds, as a baseline
- Snow, O'Connor, Jurafsky and Ng (EMNLP 2008): on Amazon Mechanical Turk, about 4 non-expert labels per item were needed to emulate one expert on affect recognition. The finding is task-specific, not a universal rule. — [ACL Anthology D08-1027](https://aclanthology.org/D08-1027/)
- Kittur, Chi and Suh (CHI 2008) found Mechanical Turk workers gaming a Wikipedia-quality rating task, and countered it by adding verifiable questions. — [Google Research listing](https://research.google/pubs/crowdsourcing-user-studies-with-mechanical-turk/) (the effect sizes were not verified; see Gaps)

### Inferences
- None of these systems let one contributor's judgement become ground truth. Even reCAPTCHA, deciding something as checkable as a word's spelling, needed at least 2 agreeing humans, plus an OCR guess or a third human, and about 32% of words needed 3 or more people. Question Quest makes one tutor's click final for every organization on the platform.
- The mechanism that transfers best is the known-answer gate (reCAPTCHA's control word, the ESP Game's test images). In Quest it would mean mixing questions with a known verdict into the tutor's review stream: already-approved questions and deliberately broken ones. Only reviews from tutors who pass them would count.
- The Serengeti "evenness" rule maps onto student data. A question on which the students' answers split widely, or on which strong students pick a distractor, is the analogue of a high-evenness image, and should be routed to a second reviewer or an expert rather than closed by one tutor.

### Gaps
- The ESP Game's value of N (agreements needed) and the 2004 paper's label-quality evaluation figures were not retrieved; the RWTH copy of the paper refused connections.
- Kittur et al.'s exact invalid-response rates before and after verifiable questions are unconfirmed.
- No primary Duolingo source on translation accuracy figures was found.

## 2. Learnersourcing questions (PeerWise, RiPPLE and others): how well learners judge quality and what share of flawed items they catch

### Takeaway
In university courses, about 5% to 11% of student-authored questions had wrong answers. Peers caught most of them: all 7 of 61 in one PeerWise course, but only 3 of 5 in a physics course (data from 2009 to 2015). Students' quality ratings are compressed and inflated, so simple averages fail to flag bad items. RiPPLE's 77,297-review study (2023) found that reviewer-reliability models beat mean or median ratings, and that instructor oversight was still needed. Badges raised the quantity of PeerWise activity without a measured drop in quality. That evidence is from undergraduates writing and answering questions, not children validating machine-written items.

### Cited Findings
- Denny, Luxton-Reilly and Simon (2009, introductory programming): students "very commonly" wrote clear, error-free questions with correct answers. In every flawed question examined, the error was detected and corrected by other students, and the authors concluded students are "effective judges of question quality". — [CRPIT vol. 95 abstract](https://crpit.scem.westernsydney.edu.au/abstracts/CRPITV95Denny.html)
- Denny's slides: 11% of questions (7 of 61) had incorrect answers, and all were discovered. — [Denny PeerWise talk (UBC CWSEI)](https://cwsei.ubc.ca/files/outcomes/events/Denny_PeerWise_Talk.pdf)
- Denny's 2015 talk: about 1 in 10 questions were incorrect in unscaffolded use, against about 1 in 20 with scaffolding. — [PeerWise Iceland 2015 slides](https://en.ru.is/media/tvd/skjol/PeerWise_Iceland_2015.pdf)
- Bates (2012, two physics courses): over 90% of questions were "most likely" correct, but students identified only 3 of the 5 wrong ones, so peer detection was good but not complete. — [Bates PeerWise slides, Oct 2012](https://cwsei.ubc.ca/files/outcomes/events/Bates_Peerwise_Oct2012.pdf)
- Walsh et al. (2018, medical students): students worried about the quality of student-authored questions, yet only 2 of the 300 most-answered questions had unacceptable discrimination on item analysis. — [PMC5800328](https://pmc.ncbi.nlm.nih.gov/articles/PMC5800328); [DOAJ, Research in Learning Technology 2018](https://doaj.org/article/a51079bd57004c598d9902bc34c8d25e)
- Students lose time to wrong keys. An instructor who set PeerWise as homework reported that students' "main complaint" was the errors in questions, options and solutions, and that the multiple-choice format makes it worse because students "work for hours trying to reproduce one of the answers". — [PeerWise community post](https://peerwise.cs.auckland.ac.nz/docs/community/using_peerwise_to_assign_homework)
- Ratings and gaming:
  - In one course's repository, 73% of 363 questions were rated in a narrow 2.5 to 3.5 band, so ratings barely separated good questions from bad.
  - Bates and Galloway reported rare attempts to "game the system", including question "cartels" among groups of students.

  — surfaced alongside [Bates and Galloway / RSC, Chem. Educ. Res. Pract. 2015](https://pubs.rsc.org/en/content/articlehtml/2015/rp/c4rp00209a) and the [Bates slides](https://cwsei.ubc.ca/files/outcomes/events/Bates_Peerwise_Oct2012.pdf). Which of these documents holds the 73% figure was not confirmed.
- Badges (Denny, CHI 2013, 1,031 students, randomized): a 2013 review summarises a "highly significant positive effect on the quantity of students' contributions, without a corresponding reduction in their quality", and on how long students stayed engaged. The PeerWise team also notes that some students found the effect short-lived. Badges include "Obsessed" (10 consecutive days of correct answers) and "Insight" (comments that others agree with). — [PeerWise community: Do badges work?](https://peerwise.cs.auckland.ac.nz/docs/community/do_badges_work) (primary paper not retrieved; figures via secondary review)
- RiPPLE consensus study (Darvishi, Khosravi, Rahimi, Sadiq and Gašević, *IEEE TLT* 16(1):106–120, 2023): 2,141 undergraduates in five courses wrote 12,803 resources and 77,297 peer reviews, about 6 reviews per resource by division. Review quality varied widely and students tended to overrate. Mean and median ratings failed to flag poor resources. Models of reviewer reliability (probabilistic and text-based) did better, but "instructor oversight and training for students remain necessary". — [Monash research portal](https://research.monash.edu/en/publications/assessing-the-quality-of-student-generated-content-at-scale-a-com/)
- RiPPLE's moderation design: each resource type has a rubric of criteria, an overall quality rating, the reviewer's confidence and a written justification. RiPPLE later added NLP checks that prompt students to improve weak feedback, and a randomized experiment with 195 students found that a guide with examples produced more comprehensive comments. — [RiPPLE (arXiv 1910.05522)](https://arxiv.org/pdf/1910.05522); [Learnersourcing in the Age of AI (arXiv 2306.06386)](https://arxiv.org/pdf/2306.06386); [ETR&D 2024 (s11423-024-10346-0)](https://link.springer.com/10.1007/s11423-024-10346-0). These links come from a search summary; which paper holds the 195-student experiment was not confirmed.
- Automated flaw detection on learner-written questions (Moore, Nguyen, Chen and Stamper, EC-TEL 2023): on 200 student-generated MCQs in four subjects, checked against 19 item-writing flaws, a rule-based method caught 91% of the flaws human experts found and GPT-4 caught 79%. — [arXiv 2307.08161](https://arxiv.org/abs/2307.08161)

### Inferences
- PeerWise's "every error was caught" result relied on many students attempting each question and commenting in public. Quest has no equivalent: the student sees only "Saved", and one tutor's single look decides the question. The Bates figure (3 of 5 caught) is the safer planning assumption for one reviewer's catch rate.
- RiPPLE's finding that raters inflate and simple averages fail argues for weighting tutors by their measured accuracy (for example, on seeded audit questions) rather than counting every approval equally.

### Gaps
- No study of children aged 8 to 14 judging question quality was found. All learnersourcing evidence here is from university students.
- RiPPLE's exact agreement figures between students and instructors (Abdi et al., *IEEE TLT* 2021) were not retrieved.
- The exact effect sizes of Denny's 2013 badge study were not retrieved; the ACM Digital Library returned 403 and the Auckland host refused connections.

## 3. Finding flawed items from student response data: item analysis, miskey signatures, responses needed, field-test items, Duolingo English Test calibration, ASSISTments

### Takeaway
A miskeyed multiple-choice item has a recognisable signature: the keyed option is chosen less often than a distractor, especially by strong students, and its point-biserial is negative while a distractor's is positive. Statistics alone are not conclusive, though: ambiguity and double-correct items look the same. In a 2013 simulation, three combined indices flagged 85% of miskeys with zero false positives, using a 20-response floor. Operational programmes calibrate new items on hundreds of responses (PISA: 250 to 750 per item per country) or, like the Duolingo English Test, on about 500 test-takers with roughly 6 exposures per item, helped by text features. Small-sample statistics are a screen that sends an item to a person, not a verdict.

### Cited Findings
- Miskey signature: the key draws fewer test-takers than a distractor. A worked example has 40% choosing the key and 45% choosing one distractor: "Perhaps the answer specified as the Key was not actually correct." In a miskeyed item the key's point-biserial is negative, while the true answer shows a positive one and a rising quantile curve. A typical healthy item has 40% to 95% of students correct. — [ASC: Distractor analysis](https://assess.com/distractor-analysis-test-items/)
- A low p-value with a negative point-biserial "is often interpreted as indicating an item miskey", but item ambiguity and multiple correct answers produce the same pattern, and "no one statistical index is completely reliable in the detection of a miskeyed item". — [Stahl and Applegate, *Rasch Measurement Transactions* 27:1 (2013)](https://rasch.org/rmt/rmt271c.htm)
- Detection rates (Stahl and Applegate 2013, CAT simulation):
  - **Design:** 10 replications of 1,200 examinees each, drawing on a pool of more than 1,400 items, with 8 miskeyed items per replication.
  - **Flags:** p ≤ 0.20, Rasch displacement ≥ 1.5 and upper asymptote ≤ 0.4, with a minimum exposure of 20 responses.
  - **Results:** 85% of miskeys were flagged (68 of 80), with zero false positives in 14,640 normal-item cases. Of the 12 misses, 7 were the hardest miskeyed item, because hard items are harder to diagnose.

  — [RMT 27:1](https://rasch.org/rmt/rmt271c.htm)
- Distractor statistics are noisy for hard items: a difficult item can show positive point-biserials even for working distractors, so alternative indices (Attali and Fraenkel) contrast the group choosing one distractor with the group solving the item. — [Frontiers in Medicine 2022 (fmed.2022.921719)](https://www.frontiersin.org/journals/medicine/articles/10.3389/fmed.2022.921719/full)
- Sample sizes in operational calibration: the PISA main survey needs 250 to 750 respondents per item per country, which motivates research into using LLM "respondents" to reduce the human sample. — [arXiv 2407.10899](https://arxiv.org/pdf/2407.10899)
- Smarter Balanced: embedded field-test performance-task items go to a random 2% to 4% of registered students, who then sit a longer test. In May 2026 Smarter Balanced issued an RFP for calibration of the field-test items embedded in its summative tests. — [Smarter Balanced CAT algorithm summary](https://technicalreports.smarterbalanced.org/cat_algorithm/CAT_Algorithm_Summary.html); [Smarter Balanced RFP](https://smarterbalanced.org/smarter-balanced-issues-request-for-proposals-for-field-test-scoring-and-item-calibration-services/)
- Duolingo English Test (McCarthy, Yancey, LaFlair, Egbert, Liao and Settles, EMNLP 2021): a multi-task model with BERT features "rapidly improves estimate quality with as few as 500 test-takers and a small sample of item exposures (≈6 each) from a large item bank (≈4,000 items)". It estimates difficulty without piloting, which also limits how often items are exposed. — [ACL Anthology 2021.emnlp-main.67](https://aclanthology.org/2021.emnlp-main.67)
- Duolingo English Test (2025 International e-Assessment Awards finalist entry), three components:
  - **SPICE** uses NLP item features to reduce how much pilot data is needed.
  - **S2** lets new items count toward scores at reduced weight.
  - **A3** gives items with more uncertain parameters to a broader range of test-takers.

  The system introduced thousands of new vocabulary items, and joint calibration of six item types processed more than 38 million responses in five hours. — [e-Assessment Awards 2025 finalists](https://e-assessment.com/news/press-release-news/2025-award-finalists-most-innovative-use-of-technology-in-assessment); [Languages Canada 2023 presentation](https://languagescanada.ca/web/default/files/conference/2023/presentations/cutting-edge-quality-assurance.pdf)
- Universal Math Exam pilot (Renaissance Philanthropy / The Learning Agency, March to April 2025):
  - **Generation:** 800 AI-generated SAT-style items.
  - **Pre-teacher screening:** 53 were removed for cultural bias and 36 because they needed a visual, leaving 711.
  - **Teacher review:** two teachers rated each item from 1 to 3, with disagreements adjudicated (146 items), and a 46-item pilot bank resulted.
  - **Pilot:** 146 students aged 14 to 20 took it. Corrected item-total correlations ranged from −0.13 to 0.69, with 84% above 0.10, and α = 0.874.
  - **Student data:** even after teacher review, it flagged 16 of the 46 items (35%) for extreme difficulty or IRT misfit.

  — [Renaissance Philanthropy](https://www.renaissancephilanthropy.org/insights/the-universal-math-exam-pilot-using-llms-to-generate-math-test-items); [The Learning Agency](https://the-learning-agency.com/guides-resources/the-universal-math-exam-pilot-using-llms-to-generate-math-test-items/)
- Large field study of AI exams (Isley, …, Domingue, Goel; arXiv 2508.08314, Aug 2025, Spring 2025 data):
  - **Sample:** 91 college classes and 1,686 students, of whom 71 classes (1,208 students) received o3-mini-generated 10-item exams.
  - **Pipeline:** an LLM judge discarded items "whose key it disputed". No pruning by student data was done.
  - **Results:** AI items were easier (about 60% correct against 39% for the AP Statistics benchmark) and slightly more discriminating (2PL α 1.3 against 1.2). None of the AI items fell in the "low discrimination" band, against 8.3% of benchmark items.

  — [arXiv 2508.08314](https://arxiv.org/html/2508.08314v1)
- Publisher-scale use of student data on generated items (VitalSource):
  - **Comparison:** automatically generated questions matched human-authored ones on engagement, difficulty and persistence.
  - **Scale:** the later analysis covered nearly 1 million questions, more than 300,000 students and more than 7 million attempts (January 2022 to May 2023).
  - **Data noise:** about 12% of students entered "non-genuine" answers to fill-in-the-blank items.

  — [Times Higher Education (sponsored)](https://timeshighereducation.com/node/732476); [VitalSource press release](https://mx.get.vitalsource.com/press/learning-science-artificial-intelligence-in-courseware-can-enhance-student-learning)
- Eedi checks human-written diagnostic questions against responses. One fractions question had been answered more than 20,000 times, and the data were used to confirm that each distractor attracted students and matched its intended misconception. — [Eedi Substack, 17 Sep 2024](https://eedi.substack.com/p/can-an-ai-chatbot-write-a-good-multiple)
- ASSISTments: a 2026 study used 600 ASSISTments problems as its base for LLM personalisation (see section 4). No published ASSISTments procedure for flagging bad items from response data was found. — [arXiv 2604.05160](https://arxiv.org/html/2604.05160v1)

### Inferences
- Quest blocks a second student in the same organization from a question awaiting review, so each question gets about one student response per organization before a tutor decides. That is far below even the 20-response floor of the 2013 simulation. Item statistics cannot do much before approval unless responses are pooled across organizations, or approval waits for a minimum number of responses.
- A gross miskey is cheap to spot once a handful of responses exist; a subtle flaw is not. Illustrative arithmetic: if the true answer draws 60% of students and the stored key 10%, then after 10 responses the chance that the key out-polls the true answer is negligible. A flaw that only shifts p by 10 points needs hundreds of responses to separate from noise. This is a binomial illustration, not a sourced figure.
- Quest already marks each answer by code against the key. The stored mark, the share of students choosing each option and the tutor's verdict are together the raw material for the classical flags above, so a later "data check" could re-open approved questions whose key under-polls a distractor.

### Gaps
- No published minimum N for detecting a miskey by point-biserial or distractor analysis was found. The 20-response floor is one simulation's setting.
- NAEP pilot and field-test sample sizes per item, and the digital SAT's count of unscored pretest questions, were not retrieved (search budget exhausted).
- No documented ASSISTments practice for detecting flawed items from student data was found.

## 4. Recent research (2023 to 2026) on validating LLM-generated math questions: wrong keys, ambiguity, how well teachers spot flaws, review time, hybrid pipelines, edtech practice

### Takeaway
For K-8 math word problems, teachers judged GPT-4 Turbo's solutions inaccurate about 4% of the time, and its problems unsolvable about 5% and inappropriate about 16% of the time (MATHWELL, 2024). Older and weaker models were far worse: GPT-3.5's solutions were inaccurate about 10% of the time. Distractors are the weakest part: only 37% of GPT-4's distractors were judged valid in a 2024 math pilot. Even after teacher review, student data flagged about a third of a 2025 AI math bank for misfit. Teachers agree with each other well on whether an answer is accurate (92% to 96%) but poorly on softer judgements (κ as low as 0.02 to 0.31 in 2026). The best-documented pipelines run automated checks, then human review, then response statistics. No source reports a measured teacher review time per item.

### Cited Findings
- MATHWELL (Christ, Kropko and Hartvigsen, Findings of EMNLP 2024; K-8 word problems; annotators with K-12 teaching experience; 250 outputs per model):

  | Model | Solvable | Accurate | Appropriate | Meets all criteria |
  |---|---|---|---|---|
  | GPT-4 Turbo | 94.8% | 95.8% | 84.4% | 78.8% |
  | GPT-3.5 Turbo | 88.0% | 89.5% | 75.5% | 62.8% |
  | MATHWELL | 89.2% | 96.9% | 86.5% | 74.8% |
  | LLEMMA | 48.8% | 63.9% | 41.8% | 15.2% |

  Across all 4,734 annotated pairs: 82.2% solvable, 87.2% accurate, 68.6% appropriate. — [arXiv 2402.15861v4](https://arxiv.org/html/2402.15861v4)
- MATHWELL inter-annotator agreement:
  - **Accuracy:** 92.0% (training data) and 95.5% (evaluation labels).
  - **Solvability:** 84.6% and 89.3%.
  - **Appropriateness:** 74.6% and 80.4%.
  - **All three labels:** 66% to 68%.

  80.1% of disagreements arose because the primary annotator was more conservative than the others. — [arXiv 2402.15861v4](https://arxiv.org/html/2402.15861v4)
- A 2026 study citing MATHWELL as its human benchmark states that "teachers report mathematical errors in approximately 10% of cases". The same study (600 ASSISTments problems personalised by GPT-5.2, with up to 3 refinement rounds) found near-zero solvability failures after one round. But three college-math annotators agreed poorly on softer criteria: Fleiss κ 0.310 for realism, 0.023 for authenticity and 0.095 for readability. — [arXiv 2604.05160 (Apr 2026)](https://arxiv.org/html/2604.05160v1)
- HEDGE (Lee, Smith, Woodhead and Lan, EDM 2024; GPT-4; 4 math educators; 20 MCQs): 14 of 20 stem, key and explanation sets (70%) were judged valid, and 22 of 60 distractors (37%). The paper notes that two of the "valid" distractors were actually invalid, a miss by the reviewers themselves. — [EDM 2024 poster](https://educationaldatamining.org/EDM2024/proceedings/2024.EDM-posters.113/index.html)
- Overgenerate-and-rank (2024): math teachers significantly preferred human-written distractors, with moderate-to-substantial agreement between raters, and "even expert math teachers ... cannot fully anticipate real students' behavior". — [arXiv 2405.05144](https://arxiv.org/pdf/2405.05144)
- Eedi, 17 Sep 2024: given 1/3 + 2/5, Gemini's first key was 7/15 (the correct answer is 11/15), and when challenged it claimed 11/15 simplifies to 7/15. ChatGPT, Copilot and Claude had the correct key but distractor explanations that were unclear, duplicated another option or rested on a wrong LCM. — [Eedi Substack](https://eedi.substack.com/p/can-an-ai-chatbot-write-a-good-multiple)
- The Universal Math Exam pilot (2025; section 3) went from 800 generated items, through 711 after screening and two-teacher rating with 146 adjudications, to a 46-item bank, of which student data still flagged 16. — [Renaissance Philanthropy](https://www.renaissancephilanthropy.org/insights/the-universal-math-exam-pilot-using-llms-to-generate-math-test-items)
- Hybrid pipeline in practice (Isley et al. 2025): generate, then an LLM judge refines and drops any item whose key it disputes, keeping the 10 hardest; student data was analysed afterwards with IRT but not used to prune. — [arXiv 2508.08314](https://arxiv.org/html/2508.08314v1)
- Non-math reference points for wrong keys:
  - A BMC Medical Education pilot found that 1 of 210 GPT-4 MCQs (0.5%) was "false" and 15% needed revision, as reviewed by blinded specialists.
  - A 2025 high-stakes medical exam comparison is reported as 24.5 person-hours for the AI set against 96 for the human set, with similar discrimination, but 14% of AI items had inappropriate difficulty against 1% of human items.

  — [BMC Medical Education (s12909-025-08084-9)](https://link.springer.com/article/10.1186/s12909-025-08084-9); [PC Tech Magazine (secondary)](https://pctechmag.com/?p=96604). The BMC article itself was not opened, and the second figure comes from a secondary article.
- Review time: no study found reports minutes of expert review per AI item. A vendor explainer says "Drafting is minutes; the reviews are the real cost". — [iatroX blog](https://www.iatrox.com/blog/ai-draft-to-exam-ready-question-validation-pipeline)
- Edtech companies using students' answers to vet AI-generated items:
  - **Duolingo English Test:** calibrates machine-generated items from operational responses, with reduced-weight scoring for new items (section 3).
  - **VitalSource:** reports monitoring performance metrics from student data on millions of generated practice questions.
  - **Eedi:** vets its human-written questions with response data.
  - **Khan Academy:** published 2025–2026 testing measures Khanmigo tutoring outcomes, not flaws in individual items.

  No public account was found of a K-12 math company approving AI items from students' answers. — [e-Assessment Awards 2025](https://e-assessment.com/news/press-release-news/2025-award-finalists-most-innovative-use-of-technology-in-assessment); [AIME-Con 2025 VitalSource paper listing](https://preview.aclanthology.org/setup/2025.aimecon-main.36); [Eedi](https://eedi.substack.com/p/can-an-ai-chatbot-write-a-good-multiple); [Khan Academy blog](https://blog.khanacademy.org/?p=21314)

### Inferences
- Aimtrue's pipeline (form checks, exact computation of the key, blind solve by a second model) targets the error class teachers agree on best (accuracy, κ-equivalent agreement 92% to 96%), so its residual wrong-key rate is plausibly well under MATHWELL's 4%. That is not measured. What it leaves is the error class reviewers agree on least: ambiguous wording, implausible distractors, grade fit. One tutor's binary approve/flag is weakest exactly there.
- The HEDGE and Universal Math Exam numbers suggest a single human pass does not catch everything that student data later reveals (2 "valid" distractors were invalid; 16 of 46 reviewed items misfit).

### Gaps
- No 2023–2026 study reports the wrong-key rate of LLM math items that had already passed an exact-computation and blind-solve pipeline like Aimtrue's.
- No measured teacher review time per math item was found.
- No K-12 math company's public practice of vetting AI items through student answers was found.

## 5. Gamified moderation and review queues (Stack Exchange, Wikipedia, Google Local Guides, Waze, OpenStreetMap): rubber-stamping under per-review rewards, and the evidence on each countermeasure

### Takeaway
Rewarding review counts reliably produces some careless, high-volume reviewing. Stack Exchange moderators report reviewers who repeatedly approved spam and failed several audits, and Local Guides is widely described as gamed by point-chasers. Badges measurably steer behaviour, but only for a minority: about 20% of Stack Overflow users. Countermeasures in use:
- known-answer audits and suspensions (Stack Exchange);
- earned, revocable rights with entry criteria (Wikipedia: 90 days and 500 edits; Waze: rank by edit count and review);
- reduced weight for low-value work (Wikipedia redirects at 0.2 points);
- second-stage validation by experienced users (OpenStreetMap's Tasking Manager);
- peer re-review of a sample (Wikipedia backlog drives).

Published measurements of how well each one works are scarce. Most evidence is design documentation and moderator testimony.

### Cited Findings

#### Stack Exchange review queues
- Reviewing unlocks at 350 reputation on Stack Overflow for Teams. Suspensions "are not penalties, but temporary holds on your reviewing privilege", imposed when a user takes "incorrect action on multiple tasks" (one example shows 7 days). — [Stack Overflow help: reviews intro](https://stackoverflowteams.com/help/reviews-intro); [Stack Overflow help: review suspensions](https://stackoverflowteams.com/help/review-suspensions)
- In 2011, reviewing required the Strunk & White badge, a "Reviewer" badge was introduced, and a post left the review list once two qualified reviewers had reviewed it. — [Stack Overflow blog, "Improved Reviewing", 21 Nov 2011](https://stackoverflow.blog/2011/11/21/improved-reviewing/)
- In 2014, Stack Exchange said the suggested-edit approval system had "several serious deficiencies" that had become apparent, and changed it, including a limited period of exclusivity for edits under review. — [Stack Overflow blog, 7 Oct 2014](https://stackoverflow.blog/2014/10/07/new-editing-badges-and-enhancements-to-suggested-edits/)
- A 2012 Meta question on bad suggested-edit approvals recorded that an "audit" system was "in the works" (developer Kevin Montrose). — [Meta Stack Exchange q/137784 (mirror)](https://backiee.wasmer.app/http_meta_stackexchange_com/q/137784)
- A moderator's Meta proposal (date not retrieved):
  - **Problem:** spam passes the First Posts and Late Answers queues when reviewers choose "No Action Needed", and moderators ban those reviewers by hand. The reviewers who do this "have failed multiple audits and have been banned from review on several occasions".
  - **Proposal:** when the community destroys a post as spam, record an audit failure for every reviewer who passed it, with a look-back of about 30 days. Adoption status is unknown.

  — [Meta Stack Exchange a/403670 (mirror)](https://backiee.wasmer.app/https_meta_stackexchange_com/a/403670)
- Stack Overflow overhauled its review queues in 2020–2021 to give reviewers "more context to make deliberate, thoughtful decisions". Because of a shortage of reviewers on some sites, it cut the votes needed to close or reopen from five to three, trading redundancy for throughput. — [The Loop, Q4 2020 roadmap](https://stackoverflow.blog/2020/10/21/the-loop-our-community-roadmap-for-q4-2020/); [The Loop, Q2 2021](https://stackoverflow.blog/2021/04/23/the-loop-our-community-public-platform-roadmap-for-q2-2021/); [The Loop, Q3 2021](https://stackoverflow.blog/2021/07/30/the-loop-our-community-public-platform-roadmap-for-q3-2021/)
- Evidence that badges steer behaviour:
  - Anderson, Huttenlocher, Kleinberg and Leskovec (WWW 2013) found that Stack Overflow badges steer behaviour as their model predicts.
  - A reanalysis (Hoernle, Kehne, Procaccia and Gal) estimates that only about 20% of users respond to badge incentives.

  — [WWW 2013 paper](https://archives.iw3c2.org/www2013/proceedings/p95.pdf); [The Phantom Steering Effect (arXiv 2002.06160)](https://ar5iv.labs.arxiv.org/html/2002.06160)
- An IEEE TSE study of 3,871,966 revisions to 2,377,692 Stack Overflow answers found that users made far more revisions on days they earned badges, and that unusually heavy revision in one day made rollbacks more likely. Badge-driven volume carried a quality cost. — [IEEE Xplore 8485395](https://ieeexplore.ieee.org/document/8485395)

#### Wikipedia New Pages Patrol
- The new page reviewer right is earned:
  - **Entry criteria:** at least 90 days of registration and 500 non-deleted article edits, plus experience in deletion processes and no recent behavioural blocks.
  - **Grants:** an admin may grant it on a "probationary or time-limited basis".
  - **Revocation:** an admin may remove it at any time, for reasons including a "pattern of failing to exercise sufficient care when reviewing pages" or accepting payment.
  - **Quality checks:** no routine audit of reviewers is described.
  - **Snapshot as fetched in October 2026:** 891 active reviewers, 1,708 holders and an article backlog of 29,535.

  — [Wikipedia: New pages patrol/Reviewers](https://en.wikipedia.org/wiki/Wikipedia:New_pages_patrol/Reviewers)
- Backlog drives reward volume. Barnstars are "based on the number of reviews". Streak awards use each participant's lowest weekly score to encourage consistency. Re-reviews of other participants' work earn credit and exist "to provide feedback to fellow reviewers". — [Wikipedia: NPP backlog drives](https://en.wikipedia.org/wiki/Wikipedia:New_pages_patrol/Backlog_drives)
- September 2026 drive:
  - **Scoring:** articles were worth 1 point and redirects 0.2 ("to encourage a focus on article reviews"). Re-reviews were credited, with the rule that "quality and depth of patrolling ... are essential". No point deductions for faulty reviews are described.
  - **Backlog:** articles fell from 31,105 to 26,281 and redirects from 56,894 to 48,836.
  - **Points:** 19,223.6 in total, and the top participant scored 3,290.

  — [Wikipedia: NPP backlog drive, September 2026](https://en.wikipedia.org/wiki/Wikipedia:New_pages_patrol/Backlog_drives/September_2026)
- Concentration of volume:
  - In the October 2024 drive, the article backlog fell from 11,626 to 7,609.
  - In a 2023 redirect drive, one editor scored 4,316 points, out of 23,851 reviews in total.
  - The 2023 annual cup winner did 17,761 article reviews in the year.

  — [NPP newsletter (copy)](https://www.gwern.net/wiki/Wikipedia:New_pages_patrol/Newsletter)

#### Google Local Guides
- Points for photos, reviews and answers raise a Guide's level. Industry commentators describe a reputation for "bad actors", "gamification" and "misuse", and fake reviews and bogus photos left by "point chasers". One expert suggests weighting reviews from non-Guides more heavily. No quantitative study or Google statement on detection was found. — [YouGov](https://yougov.com/articles/27007-local-guide-programs-gamification-encourages-point); [Search Engine Land](https://searchengineland.com/good-guides-gone-bad-how-googles-local-guides-program-fails-businesses-and-consumers-326724); [Local Search Forum](https://localsearchforum.com/threads/local-guides-are-posting-bogus-photos-reviews.50987)

#### Waze map editors
- Promotion and demotion:
  - **US edit-count guidelines:** about 3,000 edits for rank 2, 25,000 for rank 3, 100,000 for rank 4 and 250,000 for rank 5. Rank 4 needs review by the regional coordinator, and Champs need recommendation and approval by other Champs.
  - **Demotion:** editors can lose levels for map abuse, or be dropped from level 3 to 2 for "frequent and ongoing errors" while they retrain with a mentor.
- Automated protection:
  - **Locks:** an editor can change an object only if their rank is at least its lock rank, and the busiest roads (about the top 10%) are locked at rank 5.
  - **Automated checks:** a regression checker and edit throttling flag mass edits.

  Sources for all of the above, community wikis and forum posts that vary by country: — [Waze: rank and points](https://www.waze.com/discuss/t/your-rank-and-points/377943); [Waze: editing levels (Australia)](https://it.waze.com/wiki/Australia/Editing_levels_and_roles); [Waze: segment locks (UAE)](https://www.waze.com/wiki/UAE/Segment_locks); [Waze: map protection](https://www.waze.com/discuss/t/map-protection/377953)

#### OpenStreetMap (HOT Tasking Manager)
- Work runs in two stages: volunteers map, then "more experienced mappers" validate. Validators should be experienced themselves, and beginners mapping small isolated areas are a known source of inconsistency. Validation capacity lags mapping: in most months more tasks are mapped than validated. A 2015 mailing-list post reports validated areas that still contained errors. — [OSM wiki: Validating data](https://wiki.openstreetmap.org/wiki/Tasking_Manager/Validating_data); [Missing Maps validation guide](https://www.missingmaps.org/assets/downloads/Validating_Data_EN.pdf); [HeiGIT (American Red Cross analysis)](https://heigit.org/?p=21804); [HOT mailing list, May 2015](https://lists.openstreetmap.org/pipermail/hot/2015-May/008940.html)

#### Countermeasures with measured effects, from other domains
- **Known-answer gating:** reCAPTCHA's control word reduces a random bot's success to 1 in 100,000 (section 1). — [von Ahn et al. 2008](https://www.site.uottawa.ca/~stan/csi2911/reCaptcha_Science.pdf)
- **Uncertainty-based routing to experts:** in Snapshot Serengeti, 99.8% of low-evenness images were correct against 71% to 85% of high-evenness ones (section 1). — [Swanson et al. 2016](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4999033/fullTextXML)
- **Reliability-weighted consensus:** it beat mean and median ratings on RiPPLE (section 2). Weighting by agreement made little difference on Galaxy Zoo. — [Darvishi et al. 2023](https://research.monash.edu/en/publications/assessing-the-quality-of-student-generated-content-at-scale-a-com/); [Lintott et al. 2008](https://arxiv.org/pdf/0804.4483)
- **Dual review:** it cut missed items from 13% to 3% in a randomized trial (section 6). — [Gartlehner et al. 2020](https://cris.maastrichtuniversity.nl/en/publications/single-reviewer-abstract-screening-missed-13-percent-of-relevant-/)

### Inferences
- Quest's equal points for approving and flagging remove the direct bias toward one verdict, but any per-review point still rewards speed. If flagging also requires typing a reason while approving takes one click, the cheapest path to points is to approve. This is an inference about effort asymmetry, not a measured effect.
- Patterns that transfer directly, in rough order of evidence:
  - seeded known-answer audits, with suspension on failure (reCAPTCHA, ESP Game, Stack Exchange);
  - points that count only for reviews whose verdict later stands (the moderator's retroactive audit-failure proposal);
  - a second review for a random sample of approvals, plus every approval that student data contradicts (Wikipedia re-reviews, OpenStreetMap validation, Serengeti routing);
  - a per-day review cap and an earned reviewer right (Waze ranks, the Wikipedia reviewer right).
- Stack Overflow's cut from five votes to three shows the trade-off Aimtrue faces: fewer confirmations clear the queue faster at the cost of redundancy.

### Gaps
- Stack Exchange's audit mechanics could not be retrieved: how audit posts are chosen, how often they appear, how many failures trigger a ban, the ban lengths and the daily per-queue limits. Meta Stack Exchange and stackoverflow.com refused fetches and the search budget ran out. Any figures used for them would need checking against the Meta FAQ on review audits.
- No published measurement was found of how much review audits reduce robo-reviewing on Stack Exchange.
- No quantitative study of fake or low-quality contributions by Local Guides was found.
- No controlled error-rate study of OpenStreetMap validators was found.
- No evidence was found on the effect of daily review limits, or of sampling approvals for re-review, specifically in gamified settings.

## 6. Single-reviewer versus multi-reviewer approval: inter-rater agreement on item quality, and false-approval rates for one versus two reviewers

### Takeaway
The cleanest randomized evidence (Gartlehner et al. 2020, abstract screening on the Cochrane Crowd) shows one reviewer missing 13% of items a careful process would catch, against 3% for two. Agreement among raters on whether a multiple-choice item is flawed is only "fair" for global judgements (Fleiss κ = 0.3, 2013). It is high only with a detailed rubric and trained raters (α = 0.84, 2019), or for objective accuracy (92% to 96%, MATHWELL 2024). Even single experts disagree with an expert consensus about 3% of the time (Snapshot Serengeti, 2016). A single tutor's one-click approval is therefore likely to let a meaningful share of soft flaws through.

### Cited Findings
- Gartlehner et al., *Journal of Clinical Epidemiology* (2020), a crowd-based randomized controlled trial:
  - **Sensitivity:** single-reviewer abstract screening missed 13% of relevant studies (sensitivity 86.6%, 95% CI 80.6% to 91.2%). Dual-reviewer screening missed 3% (97.5%, 95% CI 95.1% to 98.8%).
  - **Specificity:** 79.2% for one reviewer and 68.7% for two.
  - **By topic:** single-reviewer misses were 16% for public health against 9% for pharmacology.
  - **Conference version:** the earlier abstract reported 12% against 2%.

  — [Maastricht University record](https://cris.maastrichtuniversity.nl/en/publications/single-reviewer-abstract-screening-missed-13-percent-of-relevant-/); [EBM 2020 abstract](https://www.egms.de/static/en/meetings/ebm2020/20ebm008.shtml); [Affengruber et al. 2022 via DOAJ](https://doaj.org/article/33704bacd2754a2e8eb98c31ee570ac4)
- EDULEARN 2013: four judges (two teachers and two students), blinded to item statistics, classified 920 items from 10 exams as standard or flawed with Fleiss κ = 0.3 ("fair") before consensus. — [IATED library](https://library.iated.org/view/GUIMARAES2013ASS)
- Chemistry item-writing-flaw instrument (*Chem. Educ. Res. Pract.* 2019): 91.8% overall agreement, Krippendorff's α = 0.836. Applied to 1,019 general-chemistry items, it found that most had at least one flaw, with implausible distractors the most frequent. — [RSC CERP 2019](https://pubs.rsc.org/en/content/articlehtml/2019/rp/c8rp00262b)
- Moore et al. (2023): two content experts applying a 19-item rubric to 200 questions reached "near-perfect or substantial" agreement on every rubric item, with disagreements settled by discussion. — [arXiv 2307.08161 (PDF)](https://arxiv.org/pdf/2307.08161)
- MATHWELL (2024): agreement on accuracy was 92.0% to 95.5%, but agreement on all three labels together was only 66% to 68% (section 4). — [arXiv 2402.15861v4](https://arxiv.org/html/2402.15861v4)
- 2026 personalised math problems: three annotators reached Fleiss κ of 0.023 to 0.310 on realism, authenticity and readability. — [arXiv 2604.05160](https://arxiv.org/html/2604.05160v1)
- Snapshot Serengeti (2016): individual experts matched the expert consensus 96.6% of the time, while the aggregated volunteer answers matched it 97.9%. — [Swanson et al. 2016](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4999033/fullTextXML)
- Universal Math Exam (2025): of nearly 300 items scored by two teachers, 146 went to an adjudicator because the teachers disagreed. — [Renaissance Philanthropy](https://www.renaissancephilanthropy.org/insights/the-universal-math-exam-pilot-using-llms-to-generate-math-test-items)
- Single professional transcription is not error-free either: reCAPTCHA's professionally keyed ground truth originally contained 189 errors in 24,080 words, about 0.8% (2008). — [von Ahn et al. 2008](https://www.site.uottawa.ca/~stan/csi2911/reCaptcha_Science.pdf)
- Snow et al. (2008): about 4 non-expert labels were needed to equal one expert on one task. — [ACL D08-1027](https://aclanthology.org/D08-1027/)

### Inferences
- Illustrative arithmetic, not a sourced figure. Suppose f% of the 18,500 questions have a flaw that a careful reviewer would catch, and one tutor misses a share m of them. Single approval then admits about 18,500 × f × m flawed questions:
  - f = 3% and m = 13% (Gartlehner's single-reviewer miss rate): about 72 flawed questions approved platform-wide.
  - f = 3% and m = 40% (Bates' 2 of 5 missed): about 222.
  - Two independent confirmations (m about 3%): about 17.
  - A wider definition of flaw (MATHWELL's appropriateness failures, about 15% for GPT-4 Turbo) scales these numbers up about fivefold.
- Taken together, the 146 adjudications among about 300 double-scored items imply roughly half of items drew a disagreement. Two independent teachers often disagree on whether an AI math item is acceptable, so a single tutor's verdict carries substantial rater-specific noise, beyond any rubber-stamping.
- Because Quest's approval is global, a false approval in one organization reaches every organization. The cost of a miss is multiplied across the platform, while the benefit of a single-reviewer scheme (speed) accrues locally. That argues for at least sampled second review, even with single-tutor approval as the default.

### Gaps
- No published false-approval rates for one versus two teachers reviewing math items specifically were found. The 13% against 3% figures come from systematic-review screening, a different task, used here as the best available randomized evidence.
- No study of tutors (as opposed to trained item writers or annotators) as item reviewers was found.

## 7. Ethics and disclosure: children's practice answers as labelling, informing families, and the harm of unvalidated items with wrong keys

### Takeaway
Two bodies of evidence apply.
- **Law:** under the amended US COPPA Rule (in force since 22 April 2026), the FTC's view is that disclosing a child's data to train or develop AI "is not integral" to a service and needs separate, verifiable parental consent. That interpretation sits in the FTC's commentary, not the rule text. Using children's answers to approve questions for other organizations is adjacent to this, and is a disclosure question families would reasonably expect to be told about.
- **Memory research:** multiple-choice testing without feedback can plant wrong answers. Second graders who took hard multiple-choice questions without feedback later produced the lures more often, so the test hurt more than it helped. Immediate correct-answer feedback eliminated the effect (Marsh, Fazio and Goswick 2012).

### Cited Findings
- COPPA amendments: finalized January 2025, published 22 April 2025, with compliance required by 22 April 2026. They require separate opt-in parental consent before children's data is used for targeted advertising or disclosed to third parties, and prohibit indefinite retention, requiring a written retention policy. The FTC's commentary says disclosing children's personal information "to train or otherwise develop" AI is not integral to a service and so needs separate verifiable parental consent; law firms frame this as interpretation rather than rule text. Penalties are reported at more than $51,000 per violation. — [Data Protection Report, June 2025](https://www.dataprotectionreport.com/2025/06/ftcs-coppa-rule-changes-include-ai-training-consent-requirement/); [Akin Gump](https://www.akingump.com/en/insights/ai-law-and-regulation-tracker/new-coppa-obligations-for-ai-technologies-collecting-data-from-children); [IAPP](https://iapp.org/news/a/ftc-finalizes-coppa-rule-amendments); [DLA Piper, Jan 2025](https://www.dlapiper.com/en-qa/insights/publications/2025/01/ftc-finalizes-changes-to-coppa)
- Roediger and Marsh (2005, undergraduates): a multiple-choice test produced a large positive testing effect, but reading more lures reduced that benefit and increased production of the lures as wrong answers on a later test. Multiple-choice testing "may inadvertently lead to the creation of false knowledge". — [WUSTL profile](https://profiles.wustl.edu/en/publications/the-positive-and-negative-consequences-of-multiple-choice-testing/); [Learning Scientists: The Negative Testing Effect](https://www.learningscientists.org/blog/2018/8/2)
- Butler and Roediger (2008): immediate or delayed feedback increased correct answers and reduced lure intrusions, compared with no feedback. — [Butler and Roediger 2008 (PDF copy)](https://mrbartonmaths.com/resourcesnew/8.%20Research/Formative%20Assessment/Feedback%20enhances%20the%20positive%20effects%20and%20reduces.pdf)
- Marsh, Fazio and Goswick, *Memory* 20(8):899–906 (2012), with second graders: without feedback, prior multiple-choice testing helped on easy questions. On hard questions, "the large increase in multiple-choice lure answers on the final test" meant costs outweighed benefits. Immediate feedback showing the correct answer eliminated the negative effect. — [Duke Scholars record](https://scholars.duke.edu/publication/746625)
- Wrong keys cost learners time and trust: PeerWise students' "main complaint" was errors in questions and solutions, with some working "for hours" to reproduce a keyed answer (section 2). Critics of Duolingo's translation model cited "a higher risk of wrong feedback" for learners. — [PeerWise community post](https://peerwise.cs.auckland.ac.nz/docs/community/using_peerwise_to_assign_homework); [HBS Digital Initiative](https://d3.harvard.edu/platform-digit/submission/duolingo-using-the-wisdom-of-crowds-to-translate-language/)
- Consent and coercion in using learners' work:
  - Khalil, Prinsloo and Slade argue that consent should cover uses of student-generated content and behavioural data beyond the original purpose.
  - Marshall's heuristics: acknowledge that students control how their work is used, and collect only essential data.
  - ANU guidance: students may feel unable to refuse when their grades or their tutor are involved, so de-identify the data or separate it from grading.
  - Student unions have voiced fear about academic work training AI.

  — [IRRODL 2018 (Khalil, Prinsloo, Slade)](https://www.erudit.org/fr/revues/irrodl/2018-v19-n5-irrodl04235/1055545ar.pdf); [FutureLearn/FLAN ethics slides](https://www.open.ac.uk/blogs/FLAN/wp-content/uploads/2023/05/FutureLearn-ethics-FLAN.pdf); [ANU research ethics guidance](https://services.anu.edu.au/research-support/ethics-integrity/specific-research-areas/research-within-anu-learning-and-teaching); [DevX](https://www.devx.com/daily-news/students-fear-work-could-train-ai/)
- Precedent for routinely embedding unvalidated items: large-scale tests place unscored field-test items among scored ones (Smarter Balanced gives embedded field-test tasks to 2% to 4% of students). The Duolingo English Test reduces the weight of new items and limits their exposure. — [Smarter Balanced CAT summary](https://technicalreports.smarterbalanced.org/cat_algorithm/CAT_Algorithm_Summary.html); [ACL 2021.emnlp-main.67](https://aclanthology.org/2021.emnlp-main.67); [e-Assessment Awards 2025](https://e-assessment.com/news/press-release-news/2025-award-finalists-most-innovative-use-of-technology-in-assessment)

### Inferences
- Quest's "Saved"-only response means a wrong key is never shown to the child as correct, which avoids directly teaching a wrong answer. But Marsh et al. (2012) show that multiple-choice practice without feedback is itself the condition under which children absorb lures on hard questions. A later "here is the right answer" step, given once the tutor has approved the question, would remove that cost. A wrong key that slipped through approval would then be shown to the child, which strengthens the case for second review before feedback is shown.
- Disclosure: Quest children's answers feed a decision that changes a platform-wide bank used by other organizations, which is closer to labelling than to ordinary practice. COPPA's 2025 framing suggests that a plain-language notice to families is the conservative course, and possibly a separate consent if the answers are ever shared outside the child's organization or used to train or evaluate models. Under the 2025 rule, an under-13 user's answers are personal information. This is not legal advice.
- Points for answering questions whose correctness is unknown mean a child's "correct" point depends on an unvalidated key. The family-facing explanation should say so.

### Gaps
- No peer-reviewed study was found specifically on the ethics of using children's practice answers to validate items for third parties, beyond general learner-consent literature.
- How the SAT, NAEP or state tests disclose unscored pretest items to families was not retrieved (search budget exhausted).
- No study was found measuring how often children learn a wrong answer from a miskeyed item when no feedback is given, as opposed to from lures in correctly keyed items.
