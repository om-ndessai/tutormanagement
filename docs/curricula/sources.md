# NC Math catalogs: sources and terms of use

Where the data in `apps/api/db/catalog/nc-2017.json` and `nc-2026.json` came from, how it was read,
and what NCDPI's terms say about storing the official statements. Everything below was read on
**2026-10-16**.

## Sources

| What | URL | Used for |
| --- | --- | --- |
| NCDPI, Office of Teaching and Learning | https://www.dpi.nc.gov/districts-schools/classroom-resources/office-teaching-and-learning | Links to the 2026 standards and the crosswalk; says the current standards stay in effect through 2027-28 and the 2026 standards are implemented from 2028-29 |
| NCDPI, Mathematics | https://www.dpi.nc.gov/districts-schools/classroom-resources/office-teaching-and-learning/standard-course-study/mathematics | The section's landing page; its footer links the terms of use below |
| NCDPI, Standard Course of Study & Supporting Resources | https://www.dpi.nc.gov/districts-schools/classroom-resources/office-teaching-and-learning/standard-course-study/mathematics/standard-course-study-supporting-resources | Links to the current K-12 standards document |
| **North Carolina K-12 Mathematics Standard Course of Study** (current, "Adopted: June 2017, Implementation: 2018-2019, Revised to conform to WCAG 2.1 AA requirements - May 2026") | https://docs.google.com/document/d/1ZCt83aTtuev58rHlZkakK989vziGI3eLk2xNXi8u_4o/ | **Every `nc-2017` topic.** One document holds K-8, NC Math 1-4, Discrete Mathematics for Computer Science (not loaded) and Precalculus |
| **2026 NC K-12 Mathematics Standards** (dated "October, 2026") | https://docs.google.com/document/d/1LxwEUZkpFTH77pZ0GQgazvAZQNllNx-YJcsp-K3siKw/ | **Every `nc-2026` topic and objective** |
| Crosswalks: Current K-12 Mathematics Standards to the 2026 Standards | https://docs.google.com/document/d/1l4n9AUiQ_esl7-mv8vvEH7cc1yskbpk7EZDIDzFsIuE/ | Cross-check only: every 2017 code it cites is in the catalog |
| State of North Carolina, Disclaimer & Terms of Use (linked from every dpi.nc.gov page) | https://www.nc.gov/disclaimer-terms-use | Terms of use, below |
| Common Core State Standards, Public License | https://www.thecorestandards.org/public-license/ | Background for the 2017 edition, below |

Not used:

- `https://www.dpi.nc.gov/media/4006/open`, the old PDF of the 2017 K-8 standards that search engines
  still return, answers "Page not found". The current Google Doc above replaced it.
- The "NC Math 4" and "Precalculus" links on the resources page open glossaries of terms, not standards.
  Both courses' standards are in the K-12 document.

### How the documents were read

No PDF was involved. Each Google Doc was downloaded through its public export link
(`.../export?format=txt`, and `?format=html` to recover formatting the text export drops), parsed by a
script, and every count was checked against the codes in the document:

- **2017**: 361 numbered standards. Lettered parts (`NC.M1.A-SSE.1a`) are folded into their standard's
  `statement` as "a. ...", "b. ..."; unlettered sub-bullets as "- ..." lines. Math 4 and Precalculus
  are written as standards with numbered objectives (`NC.M4.N.1.1`), so their 71 objectives are kept in
  `objectives`; every other 2017 topic has an empty list. The 2017-to-2026 crosswalk cites 2017 codes
  that are all present; the catalog also has `NC.4.NBT.7`, `NC.8.EE.8` and `NC.M2.S-IC.2`, which the
  crosswalk does not cite (it labels `NC.8.EE.8`'s text as `NC.8.EE.7`).
- **2026**: 190 standards holding 873 objectives, 14 courses.
- `number` is the order in the document, which is not always numeric: NCDPI moved some standards
  without renumbering them (Kindergarten lists `NC.K.OA.6` before `NC.K.OA.5`; grade 1 lists
  `NC.1.NBT.7` after `NC.1.NBT.1`). Some numbers do not exist at all (`NC.3.OA.4`, `NC.8.G.1`): NC
  dropped them in 2017.

### Corrections made to the source text

The documents contain a few typing errors. Each was read as the obvious intended text:

| Document | As written | Read as |
| --- | --- | --- |
| 2017 | `NC.2.MD.4Measure` | `NC.2.MD.4` "Measure ..." |
| 2017 | `NC.5MD.1` | `NC.5.MD.1` |
| 2017 | `NC.MI.F-IF.3` | `NC.M1.F-IF.3` |
| 2017 | `NC.M3.S-IC1` | `NC.M3.S-IC.1` |
| 2017 | `NC.M4. AF.2.2`, `NC.M4. AF.2.3` | `NC.M4.AF.2.2`, `NC.M4.AF.2.3` |
| 2017 | Stray characters `P-;0-` and `-'[` before a grade 6 heading | Dropped |
| 2017 | Under `NC.2.MD.5`, a bullet repeating the text of `NC.2.MD.6` | Dropped from `NC.2.MD.5` (it is `NC.2.MD.6`) |
| 2017 | Domain heading "Number and Quality" (NC Math 1) | "Number and Quantity" |
| 2017 | Grade 5 fractions standards under a second "Number and Operations in Base Ten" heading | `unit` "Number and Operations – Fractions", from the `NF` in their codes |
| 2017 | Exponents lost in export: `x2 = p and x3 = p`, `ax2`, `i2`, `g(x) = abx`, `abct = d` | `x² = p and x³ = p`, `ax²`, `i²`, `g(x) = abˣ`, `abᶜᵗ = d` |
| 2017 | `NC.M3.A-APR.6`'s fraction laid out over two lines | Flattened to `a(x)/b(x)` and `r(x)/b(x)` |
| 2017 | Mathematical italic letters (𝑎, 𝑥) | Plain letters |
| 2026 | `7. SGMR.2.5` | `7.SGMR.2.5` |
| 2026 | `ASDS.CCD.3.` (number missing, between `.3.1` and `.3.3`) | `ASDS.CCD.3.2` |

For the 2017 edition, `unit` comes from the domain letters in each code (K-8: `OA`, `NBT`, `NF` ...; high
school: `N-`, `A-`, `F-`, `G-`, `S-`, and Math 4's `AF`, `SP`), named as the document names them. For
2026, `unit` is the document's own "Domain:" heading. Grade 8's heading reads "Algebraic and Numerical
Reasoning" although its codes are `8.ANFR` (in NC Math 1 and 2, `ANFR` is "Algebraic, Numerical, and
Functional Reasoning"); the catalog keeps the heading as written.

## Terms of use: may the full statements be stored?

Neither standards document carries a copyright notice or terms of its own (both were searched for
"copyright", "©", "license", "permission" and "reproduc"). Every dpi.nc.gov page links, as its
"Disclaimer & Terms of Use", to the State's general terms at https://www.nc.gov/disclaimer-terms-use,
which say, verbatim:

> Unless otherwise noted on an individual document, the State of North Carolina grants permission to
> copy and distribute non-image files, documents, and information for non-commercial use, provided they
> are copied and distributed without alteration and appropriately cite to the source.

and, at the foot of the page, "© 2026 The State of North Carolina. All rights reserved."

For the 2017 edition there is a second owner to consider. Its K-8 and Math 1-3 standards are adapted
from the Common Core State Standards, whose public license (https://www.thecorestandards.org/public-license/)
grants "a limited, non-exclusive, royalty-free license to copy, publish, distribute, and display the
Common Core State Standards for purposes that support the Common Core State Standards Initiative", and
requires any publication or public display to carry the notice "© Copyright 2010. National Governors
Association Center for Best Practices and Council of Chief State School Officers. All rights reserved."
(adopting states are exempt; a platform is not).

**Reading (not legal advice).** The State's grant covers copying and distributing the statements
*unaltered, with a citation, for non-commercial use*. Showing the full statements inside the portal is
distribution. If every organization on the platform is non-commercial, storing them is within the grant,
provided they are shown unaltered and cite NCDPI. A tutoring business charging families is a commercial
use, which the grant does not cover, so for the platform as it is sold the terms **do not clearly
permit** storing and displaying the full statements. The safe course is what the owner already
decided as the fallback: show the official code, our short name and our own paraphrase, and link to
NCDPI's document for the official wording, until NCDPI gives written permission (the K-12 Mathematics
section's contacts are on the Mathematics page above). For the 2017 statements derived from the Common
Core, the CCSS notice would also be needed wherever they are displayed.

The catalog files carry the official text in each topic's `statement` (and each objective's
`statement`) either way, so the code side can decide whether to load or display it; `description` and
`name` are our own wording and are safe to show.
