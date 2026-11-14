# Samjho: presenter script

You present from the website: https://techfusion.wyibe.com
Just scroll. Each section below matches one section of the page, top to bottom.
About 4 minutes. Lines in *italics* are what you do, not what you say.

Before you start: open the site, press F11 for full screen, and have `demo_2_bilal_missing_details.md` in Downloads (from the "Demo files" links in the report box).

---

## 01 · Look at this number

*Page loads on the big "6.0" and the magnifying glass.*

Raise your hand if you've ever got a lab report back and had no idea what it meant.

Look at this number. 6.0. It's on a blood test report.

Is it normal? Is it high? Should someone be worried?

The person getting this report is expected to understand it, even though most of us were never taught how to read one.

## 02 · They Google it. They ask the family group.

*Scroll. The family chat fills in.*

So what do we do? We Google it. We ask relatives. We send it to the family WhatsApp group.

Phupho says six is fine. Chachu says stop eating sweets. Your cousin sends a screenshot asking if it's diabetes.

And a simple blood test turns into an evening of confusion.

## 03 · It answers. Confidently.

*Scroll. The red line strikes through the chatbot's answer.*

You might think: just ask a chatbot.

It will answer. Confidently. "6.0 is normal, don't worry."

But which normal? Not your lab's. It never asked your age or your sex. And it can't tell you where its number came from.

The problem isn't getting a test. The problem is understanding what comes after.

## 04 · 96% of every file is noise

*Scroll. Grey lines vanish, the orange result lines stay. The counter drops to 1,675.*

Problem Statement B gave us real-world style medical data. Forty thousand words. Ninety-six percent of it is legal boilerplate and compliance logs.

The actual results are a few lines buried inside. Point a normal AI search at this and it pulls up the disclaimer instead of the hemoglobin.

## 05 · The files don't cover everything

*Scroll. Five trap cards flip in. Point at them as you go.*

And the data has traps.

A patient called Bob Jones is female. Guess sex from a name and you use the wrong range.

The sugar conversion factor isn't in the files at all.

There are no ranges for children.

No range for ferritin, none for random blood sugar.

And no history of the patient, just one report.

A good answer has to know where the files stop, and say so.

## 06 · I'm Ahmed Malik

*Scroll. Your two photos drop in.*

I'm Ahmed Malik. I built this solo.

Last year my team won the National Agentic AI Hackathon regional round in Islamabad. This time it's just me, and one rule: a medical answer is either right, or it asks.

## 07 · Rules decide. AI explains.

*Scroll. The 3D test tubes fill one by one and the pipeline lights up.*

This is Samjho. It turns a lab report into something an ordinary person can understand, in plain English or Roman Urdu.

The core idea: no AI model is ever allowed to decide whether a result is normal, high or urgent.

Tested code does that, using the lab's own range sheets. The AI only puts the answer into everyday words.

## Nine kinds of answer. One tube each.

*Scroll slowly across the three rows.*

Here's everything it can say.

Normal. On the limit, which the lab's own rule says is normal. Low. High.

Converted first: 6.0 millimoles becomes 108, and it shows the sum.

Urgent low, urgent high: see a doctor today.

Then the two that make it trustworthy. When sex is missing, it asks instead of guessing. And when the lab's files have no range, it says "cannot be classified". It never invents one.

## 08 · Its words are checked before you see them

*Scroll. The bad AI draft gets struck through, then the fixed version appears.*

And we check the AI.

Every AI reply passes a guard. One: if it writes a number that isn't in our results, it's rejected. Two: if it sounds like a diagnosis, "you have diabetes", or "aap ko sugar ki bimari hai", it's rejected.

It gets one retry with the exact sentence that failed. If it fails again, we show a safe, built-in answer instead.

## 09 · Let me show you

*Click "Open the live app". You land on the report box.*

Enough slides. This is the live product.

### Demo A · It asks, it doesn't guess

*Click the sample "Laura Croft".*

This report has an AST of 44, but the patient's sex is missing.

For this test the lab's limit is 48 for men and 43 for women. So the same 44 is normal for a man and high for a woman.

A typical chatbot would see "Laura" and assume. Samjho stops and asks.

*Pick Female, click "Update results". The card turns HIGH.*

Because medical information mein confidence se ghalat jawab dene se behtar hai aik sawal pooch lena.

### Demo B · Urgent, but no diagnosis

*Click the sample "Michael Scott".*

Fasting sugar: 350. The lab's own urgent file says 300 or more is critical.

*Point at the red banner.*

So the first thing you see is: see a doctor today.

But notice what it doesn't say. It doesn't say diabetes. It explains the number. It doesn't pretend to be a doctor.

*Open "How we got this" on the card.*

And every result shows its working: the value it read, the limit it checked, the range it picked, and the exact file and line it came from.

### Demo C · Privacy lock

*Open "Ask a follow-up". Tap "Show me another patient's report".*

Let's try to get another patient's data from this session.

Refused. And that's not the AI being polite. That's code, running before the AI is ever called, citing the lab's own safety rule.

One patient, one session. Patient data is not a group chat.

### Demo D · Ask out loud, in Urdu (optional, 15 seconds)

*Tap Roman Urdu at the top. In the chat, tap the mic and say: "Mera sugar kitna zyada hai?" Tap again.*

People here don't type medical questions, they ask them. So you can just ask, in Urdu. And it answers back, out loud.

*If the room is loud, skip this one.*

### Demo E · History (optional, 15 seconds)

*Upload `demo_1_ayesha_full_checkup.md`, then `demo_1b_ayesha_followup.md`.*

And a report is rarely the whole story. Bring the next one, and it shows what changed. Hemoglobin from 6.8 to 9.4, urgent to low. Kept only on the patient's own device.

## Under the hood

*Scroll down past the results to the seven boxes.*

So here's the engineering decision.

We didn't upload a PDF to an AI and ask what it thinks.

A cleaner cuts the noise. A loader turns the lab's sheets into tables. A parser reads the report, even from a photo. The rules engine decides, with 267 automated tests behind it. The AI writes. The guard checks. The privacy lock keeps one patient per session.

The AI explains. The rules decide what the numbers say.

And if the AI is down, every result and every warning still works.

This is a medical app, so before real clinical use, the rules need review by actual doctors. I'd rather say that than have you find it.

## Back to that number

*Scroll to the last section, the yellow tube.*

Let's come back to that number. 6.0.

It's 108. The lab says 70 to 99. So it's high, but not urgent. Worth a conversation with your doctor, and Samjho gives you the questions to ask.

Nobody should need a medical degree, three Google searches and a family WhatsApp group to understand their own report.

Samjho turns medical data into medical understanding.

I'm Ahmed Malik. Thank you.

---

## If a judge asks

- **"Why not let the AI decide?"** A wrong "normal" can hurt someone, and you can't unit test a prompt. The rules have 267 tests.
- **"Is this RAG?"** The retrieval is exact: a lookup in the lab's own tables, with the file and line cited. After cleaning, the knowledge base is 13 rows, so vector search would only add ways to be wrong.
- **"What if Groq is down?"** Retry, then a second model, then a built-in template. Results and warnings never depend on the AI.
- **"Did you hard-code the 14 samples?"** No. Ranges are parsed from the files at build time, and the expected answers only live in the tests. We test layouts the samples never use.
- **"Where does the history go?"** Nowhere. It's in the browser on that device, with a delete button.
- **"Photos?"** Yes, read on the device. OCR can misread a unit, so the app shows the text to check first.

## Things to be careful about on stage

- Say "Samjho", not "LabSaathi". The site says Samjho.
- Don't say it integrates with labs. It doesn't yet. Say you can share a report into it from WhatsApp on Android.
- The voice demo needs a quiet room and microphone permission. Rehearse the exact sentence.
- If the Wi-Fi is slow, the sample buttons (Laura Croft, Michael Scott, Diana Prince) work without uploading anything.
