# Samjho: everything you need for the deck and the script

Use this file as the single source for slides and the spoken pitch. Every number here was measured or is in the repository. Nothing is rounded up.

---

## 0. Facts at a glance

| | |
| :--- | :--- |
| Product name | **Samjho** ("understand" in Urdu) |
| One line | Paste a lab report. Samjho checks every number against the lab's own range sheets, tells you what is normal and what is not, and gives you questions for your doctor. |
| Hackathon | Tech Fusion '26 AI Hackathon, Problem Statement B: Medical Lab Report Explainer (CityLab) |
| Live | https://techfusion.wyibe.com (same app: https://labsaathi.vercel.app) |
| Live test page | https://techfusion.wyibe.com/evals |
| Code | https://github.com/ahmedmalik07/labsaathi |
| Stack | Next.js 16 (App Router), TypeScript, Tailwind, React Three Fiber + drei, Framer Motion, Zod, Vitest, Groq, Vercel, Docker |
| AI | Groq free tier. `openai/gpt-oss-120b`, fallback `openai/gpt-oss-20b`. Open-weight, no fine-tuning. |
| Tests | 267 automated tests, all passing. 60 acceptance cases also run live on the site. |
| Cost | $0.00 per report on the free tier. About 1,030 tokens per explanation. |
| Speed | Rules engine: 0.3 to 2.4 ms. Full answer with AI wording: median 2.9 s. Cached: about 0.9 s. |

---

## 1. The problem (slide 1 to 2)

**Human version.** You get a lab report. It says "SGPT 45 U/L" and "FBS 6.0 mmol/L". You do not know if that is good. You search online at 2 a.m. and the internet tells you the worst, because it does not know your age, your sex or your lab.

**Hackathon version.** CityLab gives 14 patient reports and 6 reference files. Every file is about 2,000 words, and 96% of it is repeated legal boilerplate. The real data is tiny and buried. The bot must:

1. Match names and units (SGPT is ALT, FBS is Fasting Blood Sugar, mmol/L versus mg/dL).
2. Handle edge cases (a value exactly on the limit, missing age or sex).
3. Admit what it cannot classify (Serum Ferritin has no range in the files).
4. Protect privacy (never discuss another patient).
5. Give doctor questions and urgent warnings.

**The trap.** The organisers call it a RAG problem. If you put a language model in charge of deciding "normal or high", it will sometimes be wrong, and in health that is not acceptable.

---

## 2. Our idea in one sentence (slide 3)

> **Rules decide. AI only explains. And the AI's words are checked before you see them.**

- A tested rules engine decides normal, low, high, urgent, "needs more info" and "cannot classify".
- The language model only writes the friendly explanation. It never sees the patient's name or MRN, only the labelled results.
- A guard reads the model's text. If it contains a number that is not in the results, or a phrase like "you have diabetes", the text is rejected.

Why this wins: the part that must be right is ordinary code that can be unit tested. The part that needs to sound human is the only part given to the model.

---

## 3. How it works (slide 4, the architecture slide)

Eight steps. Say them as a pipeline.

1. **Cleaner.** Cuts every `### APPENDIX` block. 96.4% of the text disappears. Line numbers are kept so we can cite the original file.
2. **Reference loader.** At build time, reads the lab's files into tables: 9 aliases, 13 ranges, 4 urgent thresholds, 6 rules. Each row remembers its file and line. No number is typed into the code.
3. **Report parser.** Reads the patient's name, age, sex, MRN and tests from six or more layouts (lists, bold bullets, tables, "Test / Result" pairs, arrows, dotted lines). `[NOT PROVIDED]` or `[DATA CORRUPTED]` counts as missing.
4. **Rules engine.** Alias match, unit conversion (shown as a step), urgent check, range chosen by sex and age, classify. Every step is logged with a file citation.
5. **Explainer.** Groq writes what each test measures and what low or high can be linked with, at a class 8 reading level, plus 3 to 5 questions for the doctor.
6. **Guard.** No new numbers, no diagnosis wording. One retry, then a safe built-in template.
7. **Privacy lock.** The chat session is a signed token tied to one report. Ask about anyone else and the code refuses before the model is even called, citing the safety rules file.
8. **Reliability.** Timeout, exponential backoff on rate limits, a second model as fallback, a cache. If Groq is completely down, you still get every classification.

**Why no vector database (expect this question).** After cleaning, the whole knowledge base is 13 rows. A table lookup is exact and testable. Embedding search could only add mistakes, such as fetching the female range for a male patient.

---

## 4. What makes it different (slide 5)

| Feature | Why it matters |
| :--- | :--- |
| **"How we got this" on every card** | Shows the alias match, the unit conversion, the range and the exact file and line. The user and the judge can check the work. |
| **3D test tubes** | The liquid level shows where your value sits in the range. Two rings mark the low and high limits. Colour is the status. Urgent tubes pulse. |
| **Asks instead of guessing** | Missing age or sex shows a small form. It never reads sex from a name (sample P002 is "Bob Jones", Female, on purpose). |
| **Photo of a report** | Upload a picture. The text is read on the device (Tesseract OCR), shown for the user to check, then goes through the same rules. The image is never uploaded. |
| **Profiles ("Your people")** | Each report is filed under the person it belongs to. If the report has no name, Samjho asks whose it is. One family, many profiles, all stored on the device. |
| **Scroll story** | The site opens with a pinned, scroll-driven scene: the slip gets question marks, gets buried in scary search results, is scanned line by line, then becomes a 3D rack of filling tubes. |
| **Personal history** | The same patient's next report shows what changed: "Hemoglobin 6.8 → 9.4, Urgent → Low". Stored only in the browser, under that patient's own MRN. |
| **Roman Urdu** | One tap re-explains everything the way people here actually text. Read-aloud too. |
| **Doctor sheet** | A printable page with the results table and questions, with lines for notes. |
| **WhatsApp summary** | One tap sends a short summary to family. |
| **Privacy by maths** | The session token is cryptographically signed. You cannot swap in another patient's data. |
| **Live test page** | `/evals` runs 60 acceptance cases on the real server every time it loads. |
| **Works with AI switched off** | No Groq key, rate limited, or down: classifications and warnings still work. |

---

## 5. Proof (slide 6)

- **267 automated tests, all green.** Includes every boundary of every range row, generated from the lab's files.
- **All 14 sample reports pass**, including the traps:
  - P002: "Bob Jones" is female. SGPT 45 → ALT, female limit is 45, on the limit → normal.
  - P003: age and sex are corrupted → asks, classifies nothing.
  - P004: Hemoglobin 6.5 → urgent, "see a doctor today".
  - P005: 6.0 mmol/L → 108 mg/dL → high, conversion shown.
  - P006: Serum Ferritin → "cannot be classified from the files".
  - P012: AST 44 with sex missing → asks (normal for a man, high for a woman).
- **Nothing is hard-coded to the samples.** The engine never reads the expected answers. The ranking uses unseen reports, so we wrote synthetic ones in layouts the samples do not use.
- **Measured on the live site:** rules engine 0.3 to 2.4 ms per report. AI explanation median 2.9 s. In one run of 14 reports the guard rejected the first AI draft 4 times (mostly for writing "you have") and every one was fixed on retry.

---

## 6. How we map to the judging

| What judges look at | What to point at |
| :--- | :--- |
| Automated leaderboard on unseen reports | Generic parser, 60 acceptance cases, synthetic layouts, tolerant API (`/api/analyze` accepts several key names and plain text). |
| Commit history | 15+ commits, one per phase, with clear messages: scaffold, cleaner and loader, parser and engine, tests, API, explainer and guard, UI, extras, Docker, README. |
| Code structure | One file per pipeline step in `src/lib/`. All tunable decisions in `src/lib/config.ts`. |
| Error handling | Zod on every input. Errors are always clean JSON with a code and message. Bad session → 401. Empty report → 400 with the field named. |
| Rate-limit handling | Backoff with jitter, `Retry-After`, model fallback, concurrency gate, cache, time budget, template as the floor. Counters visible at `/api/health`. |
| README (15%) | Problem, architecture diagram, run steps, Docker, test results, measured cost and time, rate-limit strategy, and 15 honest known failure cases. |
| Rules compliance | `lab_reports/` is untouched (verified by diff against the organiser repo). Free tier only. Only `create-next-app` as scaffold. No secrets in git history. |

---

## 7. Demo script (about 3 minutes)

Open https://techfusion.wyibe.com. Have the four demo files downloaded (links are under the sample buttons).

**0:00 Hook.** "Everyone here has held a lab report they could not read. This is Samjho." Scroll once through the story: the report, the confusion, the 2 a.m. search, the same report explained. Scroll back up.

**0:25 The full check-up.** Upload `demo_1_ayesha_full_checkup.md`.
- Point at the red banner: "Hemoglobin 6.8. See a doctor today."
- Point at the tubes: "The level is where her value sits in the range."
- Open "How we got this" on SGPT: "The report says SGPT. The lab's glossary says that is ALT. Her value is 45, the female limit is 45, and the lab's rule says on the limit is normal. Here is the file and the line."
- Open it on FBS: "5.2 mmol/L. We convert first, and we show the sum."

**1:10 It asks, it does not guess.** Upload `demo_2_bilal_missing_details.md`.
- "Age and sex are missing. Bilal is obviously a man's name. Samjho will not use that." Show the form.
- Pick Male, 40 → SGOT 44 is normal. "If I had said female, the same number is high. That is why guessing is dangerous."

**1:40 It admits what it does not know.** Upload `demo_3_sana_messy_layout.md`.
- "No tables, mixed separators, 'Age/Sex: 52/F'. Still read."
- "17 mmol/L becomes 306, which crosses the urgent limit. Ferritin and RBC have no range in the lab's files, so it says 'cannot be classified'. It does not invent one."

**2:10 Privacy lock.** In "Ask a follow-up", tap "Show me another patient's report". "Refused in code, before the AI is called, citing the lab's safety rule."

**2:25 History.** Upload `demo_1b_ayesha_followup.md`. "Six weeks later. Hemoglobin 6.8 to 9.4, urgent to low. Platelets back to normal. Kept only on this device."

**2:40 Local touch.** Tap Roman Urdu, then Read aloud for two seconds. Show "Print this sheet" and the WhatsApp button.

**2:50 Close.** Open `/evals`: "60 of 60, running live right now. Rules decide, AI explains, and we check the AI."

Backup if the internet is slow: the sample buttons (Diana Prince for urgent, Laura Croft for missing sex, Fiona Gallagher for unknown test) do the same story.

---

## 8. Slide outline (10 slides)

1. **Title.** Samjho. "Got a lab report you can't read?" Logo, team, live link.
2. **The problem.** A raw report slip next to a search box full of scary results.
3. **The hackathon task.** Five checkpoints. "96% of every file is noise."
4. **Our idea.** "Rules decide. AI explains. We check the AI."
5. **Architecture.** The eight-step pipeline (copy the diagram from the README).
6. **Live demo.** (Switch to the browser.)
7. **Trust features.** Trace with file citations, asks instead of guessing, privacy lock, honest "cannot classify".
8. **Proof.** 267 tests, 14 of 14 samples, 60 of 60 live, 0.3 to 2.4 ms, $0.
9. **Honest limits.** Three or four from section 10 below. Judges respect this.
10. **What is next + thank you.** PDF upload and sturdier OCR, more labs' range sheets, Urdu script, a doctor-facing view.

---

## 9. Numbers you can quote safely

- 20 files in the corpus, 96.4% boilerplate removed by the cleaner.
- 13 range rows, 9 aliases, 4 urgent thresholds, 6 cited rules, all parsed from the files.
- 267 tests in 7 files. 60 acceptance cases live.
- Rules engine: 0.3 to 2.4 ms per report on the server.
- AI explanation: median 2.9 s fresh, about 0.9 s cached (mostly network from Pakistan to Vercel). One outlier of 12.6 s that we did not diagnose.
- Tokens: about 1,030 per report, about 2,220 when the guard forces a retry.
- Groq free tier: 8,000 tokens per minute per model. Two models give roughly 14 fresh explanations a minute. Classifications are not limited at all.
- Cost: $0.00.

Do not quote a paid-tier price: we did not verify one.

---

## 10. Honest limits (say them before a judge finds them)

1. **The glucose factor (×18) is not in the lab's files.** We use it only for Fasting Blood Sugar and the trace says so. Cholesterol in mmol/L is not converted.
2. **"Hit or pass" versus "Less than".** The urgent file contradicts itself. We treat a value equal to the threshold as urgent. It is one line to flip.
3. **Urine names are matched by context.** "pH Level" becomes "Urine pH" only when the report is clearly a urine report. A strict mode switch turns this off.
4. **Ages outside 18 to 100** get "cannot be classified", because the lab's sheets stop there.
5. **Photos work, with OCR limits.** In our test the OCR read the values right but misread the unit `mIU/L` as `mU/L`, so that one test came back "cannot be classified" until corrected. Handwriting and blurry photos are not expected to work.
6. **Roman Urdu wording is the model's.** It can make a small factual slip. The guard checks numbers and diagnosis wording, not general accuracy.
7. **History lives in one browser.** Clear the browser and it is gone. That is a privacy choice, not a database.

---

## 11. Likely questions and short answers

**"Why not let the LLM classify?"** Because a wrong "normal" is harmful and you cannot unit test a prompt. Our rules have 267 tests.

**"Is this RAG?"** The retrieval is exact: a typed lookup of the lab's own tables, with the file and line cited. We skipped embeddings because the cleaned knowledge base is 13 rows.

**"What if Groq is down or rate limited?"** Retry with backoff, then the second model, then a built-in template. The user always gets the classifications. See `/api/health`.

**"How do you stop it diagnosing?"** Three layers: the prompt forbids it, the guard rejects phrases like "you have" and disease verdicts in English and Roman Urdu, and the doctor line is added by code to every reply.

**"How is privacy enforced?"** The model never receives the name or MRN. The chat session is an HMAC-signed token holding one report. Other names, MRNs and "other patients" are refused in code before any model call.

**"Did you hard-code the 14 samples?"** No. Ranges come from the files at build time, and the expected answers live only in the test file. We test layouts and values the samples never use.

**"Where does the history go?"** Nowhere. It is in the browser's local storage under that patient's MRN, with a "forget" button.

**"What would you do with more time?"** better OCR with a unit-repair step, range sheets from more labs, Urdu script, and trend alerts across more than two reports.

---

## 12. Tone for the script

- Talk like a person, not a product page. "It asks. It does not guess." beats "robust demographic handling".
- Lead with the patient, then show the engineering.
- Say the limits out loud. It makes everything else more believable.
- Tagline options: "Rules decide. AI explains." / "Your report, in words you actually understand." / "Samjho. Phir doctor se poocho."
