/**
 * Deterministic template explanation.
 * Used when Groq is down, rate limited, or its text fails the guard twice.
 * It only restates engine facts, so it can never invent a number or a diagnosis.
 */
import type { EngineFacts, FactTest } from "./facts";
import { disclaimerFor } from "./guard";
import type { Explanation, TestExplanation } from "./types";

type Lang = "en" | "roman-urdu";

function shown(t: FactTest): string {
  const base = `${t.value}${t.unit ? " " + t.unit : ""}`;
  return t.converted ? `${base} (${t.converted})` : base;
}

function meaningEn(t: FactTest): string {
  const range = t.normalRange ? ` The lab's normal range for ${t.rangeFor} is ${t.normalRange}.` : "";
  switch (t.status) {
    case "normal":
      return `Your result is ${shown(t)}.${range} Your value is inside the normal range.`;
    case "low":
      return `Your result is ${shown(t)}.${range} Your value is lower than the normal range. Ask your doctor what this means for you.`;
    case "high":
      return `Your result is ${shown(t)}.${range} Your value is higher than the normal range. Ask your doctor what this means for you.`;
    case "abnormal":
      return `Your result is ${shown(t)}.${range} Your result is different from the expected result. Ask your doctor what this means for you.`;
    case "urgent":
      return `Your result is ${shown(t)}.${range} This is ${t.direction === "low" ? "dangerously low" : "dangerously high"} by the lab's urgent limits. See a doctor today.`;
    case "needs_info":
      return `Your result is ${shown(t)}. The normal range depends on details that are missing from the report, so it is not labelled yet. Please add the missing details.`;
    default:
      return `Your result is ${shown(t)}. The lab's reference files do not give a range for this, so it cannot be classified from the files. Please ask your doctor about it.`;
  }
}

function meaningUr(t: FactTest): string {
  const range = t.normalRange ? ` Lab ki normal range (${t.rangeFor}) ${t.normalRange} hai.` : "";
  switch (t.status) {
    case "normal":
      return `Aap ka result ${shown(t)} hai.${range} Yeh normal range ke andar hai.`;
    case "low":
      return `Aap ka result ${shown(t)} hai.${range} Yeh normal range se kam hai. Apne doctor se poochein ke is ka kya matlab hai.`;
    case "high":
      return `Aap ka result ${shown(t)} hai.${range} Yeh normal range se zyada hai. Apne doctor se poochein ke is ka kya matlab hai.`;
    case "abnormal":
      return `Aap ka result ${shown(t)} hai.${range} Yeh mutawaqqa result se mukhtalif hai. Apne doctor se poochein.`;
    case "urgent":
      return `Aap ka result ${shown(t)} hai.${range} Lab ki urgent limit ke mutabiq yeh khatarnaak had tak ${t.direction === "low" ? "kam" : "zyada"} hai. Aaj hi doctor ko dikhayein.`;
    case "needs_info":
      return `Aap ka result ${shown(t)} hai. Normal range un maloomat par depend karti hai jo report mein nahi hain, is liye abhi label nahi lagaya gaya. Meharbani kar ke woh maloomat dein.`;
    default:
      return `Aap ka result ${shown(t)} hai. Lab ki files mein is test ki range nahi hai, is liye files se classify nahi ho sakta. Apne doctor se poochein.`;
  }
}

function measures(t: FactTest, lang: Lang): string {
  const alias = t.reportedAs !== t.test ? (lang === "en" ? ` Your report calls it "${t.reportedAs}".` : ` Aap ki report mein isay "${t.reportedAs}" likha gaya hai.`) : "";
  return lang === "en"
    ? `${t.test} is one of the tests on your report.${alias} A plain-language description is not available right now, so only the facts from the lab's files are shown.`
    : `${t.test} aap ki report ka ek test hai.${alias} Is waqt asaan alfaaz mein tafseel dastiyab nahi, is liye sirf lab ki files ke haqaiq dikhaye ja rahe hain.`;
}

export function templateQuestions(facts: EngineFacts, lang: Lang): string[] {
  const q: string[] = [];
  const en = lang === "en";
  for (const t of facts.tests) {
    if (q.length >= 3) break;
    if (t.status === "urgent") q.push(en ? `My ${t.test} is ${shown(t)}, which the lab marks as urgent. What should I do right now?` : `Mera ${t.test} ${shown(t)} hai aur lab ne isay urgent kaha hai. Mujhe abhi kya karna chahiye?`);
    else if (t.status === "low" || t.status === "high") q.push(en ? `My ${t.test} is ${t.status} at ${shown(t)}. What could be the reason?` : `Mera ${t.test} ${shown(t)} hai jo ${t.status === "low" ? "kam" : "zyada"} hai. Is ki kya wajah ho sakti hai?`);
    else if (t.status === "abnormal") q.push(en ? `My ${t.test} result is ${shown(t)}, which is not the expected result. What does this mean?` : `Mera ${t.test} result ${shown(t)} hai jo mutawaqqa nahi. Is ka kya matlab hai?`);
    else if (t.status === "unclassified") q.push(en ? `The lab's sheets have no range for ${t.test} (${shown(t)}). Is my value okay?` : `Lab ki files mein ${t.test} (${shown(t)}) ki range nahi hai. Kya mera result theek hai?`);
  }
  const general = en
    ? [
        "Do I need to repeat any of these tests, and when?",
        "Is there anything in my food or daily routine I should change?",
        "Could any of my medicines affect these results?",
        "Do I need any other tests to understand these results better?",
      ]
    : [
        "Kya mujhe in mein se koi test dobara karwana chahiye, aur kab?",
        "Kya mujhe apni khurak ya rozmarra routine mein kuch badalna chahiye?",
        "Kya meri koi dawai in results par asar daal sakti hai?",
        "Kya in results ko samajhne ke liye mujhe koi aur test karwana chahiye?",
      ];
  for (const g of general) {
    if (q.length >= 4) break;
    q.push(g);
  }
  return q.slice(0, 5);
}

export function templateExplanation(facts: EngineFacts, lang: Lang, violations: string[] = [], attempts = 0): Explanation {
  const en = lang === "en";
  const count = (s: string[]) => facts.tests.filter((t) => s.includes(t.status)).length;
  const out = count(["low", "high", "abnormal"]);
  const urgent = count(["urgent"]);
  const normal = count(["normal"]);
  const open = count(["needs_info", "unclassified"]);

  const parts: string[] = [];
  if (en) {
    parts.push(`This report has ${facts.tests.length} test result${facts.tests.length === 1 ? "" : "s"}.`);
    if (urgent) parts.push(`${urgent} reached the lab's urgent limit. See a doctor today.`);
    if (out) parts.push(`${out} ${out === 1 ? "is" : "are"} outside the normal range.`);
    if (normal) parts.push(`${normal} ${normal === 1 ? "is" : "are"} inside the normal range.`);
    if (open) parts.push(`${open} could not be labelled from the lab's files yet.`);
  } else {
    parts.push(`Is report mein ${facts.tests.length} test result hain.`);
    if (urgent) parts.push(`${urgent} result lab ki urgent limit tak pohanch gaya hai. Aaj hi doctor ko dikhayein.`);
    if (out) parts.push(`${out} result normal range se bahar hai.`);
    if (normal) parts.push(`${normal} result normal range ke andar hai.`);
    if (open) parts.push(`${open} result ko abhi lab ki files se label nahi kiya ja saka.`);
  }

  const tests: TestExplanation[] = facts.tests.map((t) => ({
    test: t.test,
    measures: measures(t, lang),
    meaning: en ? meaningEn(t) : meaningUr(t),
  }));

  return {
    lang,
    overview: parts.join(" "),
    tests,
    doctorQuestions: templateQuestions(facts, lang),
    disclaimer: disclaimerFor(lang),
    source: "template",
    model: null,
    guard: { passed: violations.length === 0, attempts, violations },
  };
}
