# Samjho: demo video script

**Length:** about 3 minutes. **Format:** screen recording of https://techfusion.wyibe.com with your voice over it, plus a few seconds of your face at the start and end if you can.

Two columns per shot: what's on screen, and what you say. Speak slowly; you can always cut silence in editing.

---

## Before you record

- Use Chrome, full screen (F11), zoom at 100%, window 1920×1080 if possible.
- Clear old history so the demo starts clean: open the site, then DevTools Console and run `localStorage.clear()`, then reload.
- Download the four demo files from the report box ("Demo files to download"): Ayesha, Ayesha again, Bilal, Sana.
- Turn on the Groq key check: open `https://techfusion.wyibe.com/api/health` and make sure it says `"status":"ok"`.
- Mic test. Record in a quiet room; the voice demo needs it.
- Hide bookmarks bar and close other tabs. Turn off notifications.
- Recorder: OBS, or Windows Snipping Tool (Win+Shift+R) for screen recording.

---

## Shot list

### 1 · Hook (0:00 to 0:15)

| On screen | Voice |
| :--- | :--- |
| *Optional: your face, 3 seconds.* Then the site's first screen: big "6.0" and the magnifying glass. | "This is a real kind of number from a real kind of blood test. 6.0. Is it normal? Is it high? Should you be worried? Most people have no idea." |

### 2 · The problem (0:15 to 0:40)

| On screen | Voice |
| :--- | :--- |
| Scroll slowly. The family WhatsApp chat fills in. | "So we ask the family group. Everyone has an opinion, nobody has an answer." |
| Scroll. The chatbot answer gets struck through. | "Or we ask a chatbot. It answers confidently, but it doesn't know your lab's ranges, your age or your sex." |
| Scroll. The grey lines vanish, the counter drops to 1,675 words. | "And the data for this hackathon was 40,000 words, 96 percent of it legal boilerplate, with real traps hidden inside." |
| Pause on the five trap cards for 2 seconds. | "Like a patient called Bob Jones who is female." |

### 3 · You (0:40 to 0:50)

| On screen | Voice |
| :--- | :--- |
| Scroll to "I'm Ahmed Malik", your photos and the 4x winner badge. | "I'm Ahmed Malik. I built Samjho solo, with one rule: a medical answer has to be right, or it has to ask." |

### 4 · The idea (0:50 to 1:10)

| On screen | Voice |
| :--- | :--- |
| Scroll to "Rules decide. AI explains." The 3D tubes fill. | "Samjho never lets an AI decide if a result is normal, high or urgent. Tested code does that, using the lab's own range sheets. The AI only explains it in plain words." |
| Scroll slowly through the nine-tube gallery. | "Normal, on the limit, low, high, converted, urgent. And two honest ones: it asks when a detail is missing, and it says 'cannot be classified' when the lab's files don't cover a test." |
| Scroll to the guard scene. Let the bad draft get struck out. | "And the AI's words are checked. A made-up number or anything that sounds like a diagnosis is thrown out before you see it." |

### 5 · Live demo: full report (1:10 to 1:40)

| On screen | Voice |
| :--- | :--- |
| Click "Open the live app". Upload `demo_1_ayesha_full_checkup.md`. Click "Explain my report". | "Here's a real-looking report with seven tests." |
| Red banner appears. Hover over the Hemoglobin card so it tilts. | "Hemoglobin 6.8 crosses the lab's urgent limit, so the first thing you see is: see a doctor today." |
| Click "How we got this" on the FBS card. | "Every card shows its working. This sugar was in millimoles, so it converts first, shows the sum, picks the range and cites the exact file and line." |
| Scroll to "Plain explanation", click Roman Urdu. | "And it explains everything in plain English, or Roman Urdu." |

### 6 · It asks instead of guessing (1:40 to 2:00)

| On screen | Voice |
| :--- | :--- |
| Scroll up, click the sample "Laura Croft". | "This report is missing the patient's sex. For this liver test, the same 44 is normal for a man and high for a woman." |
| Point at the blue "I need one more detail" form. Pick Female, click Update. The card turns HIGH. | "So Samjho stops and asks. Confidence se ghalat jawab dene se behtar hai aik sawal pooch lena." |

### 7 · Privacy lock (2:00 to 2:15)

| On screen | Voice |
| :--- | :--- |
| Click the sample "Michael Scott". Open "Ask a follow-up", tap "Show me another patient's report". | "One patient per session. Ask about anyone else, and it refuses in code, before the AI is even called." |

### 8 · Voice in Urdu (2:15 to 2:30)

| On screen | Voice |
| :--- | :--- |
| Still in the chat, tap the mic and say clearly: "Mera sugar kitna zyada hai?" Tap again. Let the answer play for 3 seconds. | *(your question is the voiceover here)* Then: "You can just ask out loud, in Urdu, and it answers back." |

### 9 · History and tools (2:30 to 2:45)

| On screen | Voice |
| :--- | :--- |
| Upload `demo_1b_ayesha_followup.md`. Scroll to "Ayesha's history". | "Bring the next report and it shows what changed. Hemoglobin from 6.8 to 9.4, urgent to low. Kept only on your own device." |
| Click "Tools" in the navbar, open "What if?" and drag the hemoglobin slider down until the card turns urgent. | "The Tools page has fourteen helpers. Drag a value and watch the rules react: low, then urgent." |
| Open "Many reports at once", click "Run all 14 samples". | "And for a clinic: all fourteen reports in one table, urgent ones on top." |
| Back on Diana's result, click "QR for the doctor". | "And you can hand it to your doctor as a QR code, or save it as an image for the family group." |

### 10 · Close (2:45 to 3:00)

| On screen | Voice |
| :--- | :--- |
| Click "How we tested". Show 60 of 60. | "Every time this page opens, it re-checks 60 reports live. All correct." |
| Go back to the home page, scroll to the bottom: "Back to that number", the yellow tube. | "So, 6.0? That's 108. The lab says 70 to 99. High, not urgent, and here are the questions for your doctor. Samjho turns medical data into medical understanding." |
| *Optional: your face.* End card: site URL and your name. | "I'm Ahmed Malik. Thank you." |

---

## End card text

> **Samjho**: your lab report, in words you understand
> techfusion.wyibe.com · github.com/ahmedmalik07/labsaathi
> Ahmed Malik · 4x National Hackathon Winner

---

## Editing tips

- Speed up the scroll sections to 1.25× if you run long; keep the live demo at normal speed.
- Add a small zoom (120%) on "How we got this" and on the history panel so the text is readable.
- Put captions on the Urdu lines.
- If the voice demo fails on the take, cut it. Section 7 flows straight into section 9.
- Low background music, well under your voice. Nothing with lyrics.

## Backup if something breaks while recording

- AI slow or down: the results, warnings and questions still appear; only the wording falls back to a plain template. Keep going.
- Upload not working: use the sample buttons (Diana Prince for urgent, Laura Croft for missing sex, Fiona Gallagher for "cannot be classified").
