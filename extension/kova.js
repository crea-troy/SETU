/**
 * KOVA v4 — Universal Prompt Rewriter
 * Fixed topic detection (combination-based, not single keyword)
 * Precise templates with "answer ONLY what was asked" constraints
 * Expertise-aware: detects beginner vs expert, adjusts output
 * One Shot mode: ensures complete answer in single message
 * 25+ languages, 25+ topics, all major models
 */

const KOVA = (() => {

  // ── Language detection ───────────────────────────
  const LANGS = [
    [/[\u0900-\u097F]/, {code:"hi",name:"Hindi"}],
    [/[\u0A80-\u0AFF]/, {code:"gu",name:"Gujarati"}],
    [/[\u0600-\u06FF]/, {code:"ar",name:"Arabic"}],
    [/[\u4E00-\u9FFF]/, {code:"zh",name:"Chinese"}],
    [/[\uAC00-\uD7AF]/, {code:"ko",name:"Korean"}],
    [/[\u3040-\u309F\u30A0-\u30FF]/, {code:"ja",name:"Japanese"}],
    [/[\u0400-\u04FF]/, {code:"ru",name:"Russian"}],
    [/[\u0E00-\u0E7F]/, {code:"th",name:"Thai"}],
    [/[\u0980-\u09FF]/, {code:"bn",name:"Bengali"}],
    [/[\u0B80-\u0BFF]/, {code:"ta",name:"Tamil"}],
    [/[\u0C00-\u0C7F]/, {code:"te",name:"Telugu"}],
    [/[\u0A00-\u0A7F]/, {code:"pa",name:"Punjabi"}],
    [/[\u0D00-\u0D7F]/, {code:"ml",name:"Malayalam"}],
    [/[äöüÄÖÜß]/,       {code:"de",name:"German"}],
    [/[àâèêîôùûçœæ]/i, {code:"fr",name:"French"}],
    [/[áéíóúüñ¿¡]/i,   {code:"es",name:"Spanish"}],
    [/[àèìòùÀÈÌÒÙ]/i,  {code:"it",name:"Italian"}],
    [/[ãõâêîôûç]/i,    {code:"pt",name:"Portuguese"}],
    [/[ğışöüçĞİŞÖÜÇ]/,  {code:"tr",name:"Turkish"}],
    [/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/, {code:"pl",name:"Polish"}],
    [/[æøåÆØÅ]/,        {code:"no",name:"Norwegian"}],
    [/[őűÖÜÁÉÍÓÚ]/,    {code:"hu",name:"Hungarian"}],
  ];
  function detectLang(t) {
    for (const [rx,l] of LANGS) if (rx.test(t)) return l;
    return {code:"en",name:"English"};
  }

  // ── Topic detection v4 — combination-based ───────
  // CRITICAL: business/startup checked BEFORE code
  function detectTopic(text) {
    const t = text.toLowerCase();

    // ── Business (before code — fixes "build AI company" bug) ──
    if (/\b(startup|saas|b2b|b2c|mrr|arr|venture|funding|investor|pitch deck|monetize|side hustle|entrepreneur|founder|freelance|bootstrapped)\b/.test(t)) return "finance_business";
    if (/\b(profit|revenue|income|earning)\b/.test(t) && !/\b(tax return|income tax)\b/.test(t)) return "finance_business";
    if (/\b(build|start|launch|create|make|grow)\b.{0,30}\b(company|startup|business|agency|brand|product to sell)\b/.test(t)) return "finance_business";
    if (/\b(make|earn|generate|get)\b.{0,20}\b(money|income|profit|revenue|clients|customers)\b/.test(t)) return "finance_business";
    if (/\b(business plan|business model|business idea|go to market|product market fit|unit economics)\b/.test(t)) return "finance_business";
    if (/\b(cold email|outreach|sales funnel|conversion|churn|ltv|cac|arr)\b/.test(t)) return "finance_business";

    // ── Code errors (very specific) ──
    if (/typeerror|nameerror|syntaxerror|attributeerror|valueerror|indexerror|runtimeerror|traceback|segfault|undefined is not|cannot read prop|null pointer|stack overflow error/.test(t)) return "code_debug";

    // ── ML/AI (before general education) ──
    if (/\b(machine learning|neural network|deep learning|transformer|large language model|llm|fine.?tun|embedding|rag|vector database|backprop|gradient descent|overfitting|training.*loss|classification.*model)\b/.test(t)) return "science_ml";
    if (/\b(explain|what is|understand|how does|how do)\b.{0,25}\b(ai|ml|neural|gpt|llm|deep learning|machine learning|reinforcement learning|diffusion model)\b/.test(t)) return "science_ml";

    // ── Specific code languages ──
    if (/\b(python|django|flask|fastapi|pandas|numpy|pytorch|tensorflow|scikit|asyncio|conda|jupyter|pip install)\b/.test(t)) return "code_python";
    if (/\b(javascript|typescript|react|vue|angular|nodejs|npm|webpack|nextjs|tailwind|css|html|jquery|fetch api|promise|async await)\b/.test(t)) return "code_js";
    if (/\b(rust|golang|go lang|java |kotlin|swift|c\+\+|cpp|haskell|scala|elixir)\b/.test(t)) return "code_other";
    if (/\b(sql|mysql|postgres|mongodb|redis|firebase|supabase|orm|database schema|migration|query optimization)\b/.test(t)) return "code_db";
    if (/\b(docker|kubernetes|k8s|ci.?cd|github actions|terraform|aws|gcp|azure|nginx|devops|deployment pipeline)\b/.test(t)) return "code_devops";
    if (/\b(git |github|merge conflict|rebase|branch|pull request|git push|git clone|git stash)\b/.test(t)) return "code_git";
    if (/\b(algorithm|data structure|big o|time complexity|recursion|sorting|binary search|hash map|tree|graph)\b/.test(t)) return "code_algo";
    if (/\b(api|rest api|graphql|websocket|http|endpoint|authentication|oauth|jwt|cors|swagger)\b/.test(t)) return "code_api";

    // ── Science ──
    if (/\b(quantum|entanglement|relativity|particle physics|atom|wave function|superposition|hadron|quark|boson|lhc|cern)\b/.test(t)) return "science_physics";
    if (/\b(calculus|integral|derivative|linear algebra|matrix eigenvalue|differential equation|fourier|probability distribution|bayes theorem|statistics)\b/.test(t)) return "science_math";
    if (/\b(biology|dna|rna|cell|evolution|genetics|crispr|organism|protein|enzyme|genome)\b/.test(t)) return "science_bio";
    if (/\b(chemistry|molecule|reaction|periodic table|chemical bond|acid base|organic chemistry|thermodynamics)\b/.test(t)) return "science_chem";

    // ── Health ──
    if (/\b(diabetes|blood sugar|insulin|glucose|hba1c|diabetic)\b/.test(t)) return "health_diabetes";
    if (/\b(anxiety|depression|mental health|stress relief|therapy|burnout|panic attack|mindfulness)\b/.test(t)) return "health_mental";
    if (/\b(diet|nutrition|calories|weight loss|bmi|macro|protein intake|keto|intermittent fasting)\b/.test(t)) return "health_nutrition";
    if (/\b(exercise|workout|gym|fitness|muscle|cardio|yoga|running|strength training)\b/.test(t)) return "health_fitness";
    if (/\b(doctor|medicine|symptom|disease|illness|treatment|surgery|prescription|health condition|chronic)\b/.test(t)) return "health_general";

    // ── Finance ──
    if (/\b(stock|mutual fund|etf|equity|portfolio|dividend|crypto|nifty|sensex|nasdaq|dow jones|sip|index fund)\b/.test(t)) return "finance_invest";
    if (/\b(invest|vs stocks|vs mutual|fund comparison|stock market|share market|trading)\b/.test(t)) return "finance_invest";
    if (/\b(budget|saving money|expense tracker|salary|debt|loan|mortgage|emi|personal finance|credit card)\b/.test(t)) return "finance_personal";
    if (/\b(income tax|gst|vat|tax return|tax deduction|itr filing|tax saving)\b/.test(t)) return "finance_tax";

    // ── Career ──
    if (/\b(resume|cv |interview prep|job search|career change|promotion|salary negotiat|linkedin profile|hiring manager|cover letter)\b/.test(t)) return "career";
    if (/\b(cold email|write.*email|email.*template)\b/.test(t)) return "career";

    // ── Language learning ──
    if (/learn (spanish|english|hindi|french|german|arabic|chinese|japanese|korean|italian|portuguese|turkish|russian)/.test(t)) return "lang_learn";
    if (/\b(learn|speak|fluent|grammar|vocabulary|pronunciation)\b.{0,20}\b(english|hindi|spanish|french|german|arabic|chinese|japanese|korean)\b/.test(t)) return "lang_learn";

    // ── Travel/Legal ──
    if (/\b(travel|flight booking|hotel|visa application|itinerary|backpacking|tourism|trip plan)\b/.test(t)) return "travel";
    if (/\b(law|legal advice|contract|rights|lawyer|lawsuit|regulation|compliance|gdpr|terms of service)\b/.test(t)) return "legal";

    // ── Code general ──
    if (/\b(code|program|algorithm|debug|refactor|deploy|script|backend|frontend|fullstack|software)\b/.test(t) && !/\b(company|business|startup)\b/.test(t)) return "code_general";
    if (/\b(write|build|create|make)\b.{0,20}\b(function|script|program|api|bot|tool|website|app|game|extension)\b/.test(t)) return "code_general";

    // ── Education ──
    if (/\b(explain|understand|what is|what are|tell me about|describe|how does|how do)\b/.test(t)) return "education";

    return "general";
  }

  // ── Intent detection ─────────────────────────────
  function detectIntent(text) {
    const t = text.toLowerCase();
    if (/\b(fix|error|bug|not working|broken|exception|crash|failed|traceback)\b/.test(t)) return "debug";
    if (/\b(compare|vs|versus|difference between|better|which.*should|pros.*cons|or )\b/.test(t)) return "compare";
    if (/\b(how to|how do|steps to|guide|tutorial|kaise|كيف|कैसे)\b/.test(t)) return "howto";
    if (/\b(write|create|make|generate|draft|build|design|develop|produce)\b/.test(t)) return "create";
    if (/\b(summarize|summary|brief|tldr|key points|short version)\b/.test(t)) return "summarize";
    if (/\b(review|check|feedback|improve|critique|evaluate|assess)\b/.test(t)) return "review";
    if (/\b(translate|in english|in hindi|in arabic|in spanish)\b/.test(t)) return "translate";
    return "explain";
  }

  // ── Expertise detection ───────────────────────────
  // Detects if user is beginner or expert from their question
  function detectExpertise(text) {
    const t = text.toLowerCase();
    // Expert signals
    if (/\b(implementation|architecture|optimization|algorithm|complexity|tradeoff|paradigm|inference|backprop|gradient|eigenvalue|divergence|convergence|stochastic|heuristic)\b/.test(t)) return "expert";
    if (/\b(phd|research|paper|publication|theorem|proof|dissertation|hypothesis|methodology)\b/.test(t)) return "expert";
    // Beginner signals
    if (/\b(beginner|newbie|new to|just started|don't know|have no idea|help me understand|explain.*simply|what is|what are|tell me about|i am learning)\b/.test(t)) return "beginner";
    if (/\b(basically|simply|easy way|dumb it down|like i'm 5|eli5|simple terms)\b/.test(t)) return "beginner";
    return "intermediate";
  }

  // ── Question quality score ────────────────────────
  function scoreQuestion(text) {
    let score = 10;
    const issues = [];
    const t = text.toLowerCase().trim();

    if (t.length < 10) { score -= 4; issues.push("too short"); }
    if (t.length < 20) { score -= 2; issues.push("very brief"); }
    if (!/[?]/.test(t) && t.length < 30) { score -= 1; issues.push("no clear question"); }
    if (/\b(basically|simply|just|you know|like)\b/g.test(t)) { score -= 1; issues.push("filler words"); }
    if (!/\b(what|why|how|when|where|which|who|explain|help|fix|compare|create|write)\b/.test(t)) { score -= 2; issues.push("unclear intent"); }
    if (t.split(" ").length < 5) { score -= 2; issues.push("needs more context"); }

    score = Math.max(1, Math.min(10, score));
    return {
      score,
      label: score >= 8 ? "good" : score >= 5 ? "ok" : "needs improvement",
      issues,
      tip: issues.length > 0 ? `Could improve: ${issues.join(", ")}` : "Question is clear",
    };
  }

  // ── Clean filler words ───────────────────────────
  function clean(text) {
    return text.trim()
      .replace(/\b(can you please|could you please|please help me|i would like you to|i want you to)\b/gi, "")
      .replace(/\b(basically|literally|honestly|kind of|sort of|you know)\b/gi, "")
      .replace(/^(hey|hi|hello|ok so|so|um|uh|well),?\s*/gi, "")
      .replace(/\s+/g, " ").trim()
      .replace(/^./,s=>s.toUpperCase());
  }

  // ── One Shot constraint ───────────────────────────
  // Adds instructions to ensure complete answer in one message
  function oneShot(model) {
    if (model === "claude") return "\n<one_shot>Answer completely in this single response. Do not ask clarifying questions. Make reasonable assumptions and state them briefly.</one_shot>";
    return "\n\nIMPORTANT: Give a complete answer now. Don't ask for clarification — make reasonable assumptions.";
  }

  // ── Template builder ─────────────────────────────
  function build(model, langLine, question, points, constraint, expertise, os = false) {
    const shot = os ? oneShot(model) : "";
    const expNote = expertise === "expert" ? "" : expertise === "beginner" ? "\nUse simple language. Avoid jargon. Use analogies." : "";

    if (model === "claude")
      return `${langLine}<question>${question}</question>\n<cover>\n${points.map((p,i)=>`${i+1}. ${p}`).join("\n")}\n</cover>\n<constraint>${constraint}${expNote}</constraint>${shot}`;
    if (model === "perplexity" || model === "grok")
      return `${langLine}${question}\n${points.slice(0,3).map(p=>`- ${p}`).join("\n")}\nMax 150 words.${shot}`;
    if (model === "gemini")
      return `${langLine}${question}\n\nFor each point include a real example:\n${points.map((p,i)=>`${i+1}. ${p}`).join("\n")}\n${constraint}${shot}`;
    // chatgpt default
    return `${langLine}${question}\n\n${points.map((p,i)=>`${i+1}. ${p}`).join("\n")}\n${constraint}${expNote}${shot}`;
  }

  // ── Perplexity-specific: web-search-aware prompts ──
  // Perplexity searches the web — prompts should trigger that
  function perplexityPrompt(q, topic, intent, expertise, ll) {
    const c = clean(q);
    const year = new Date().getFullYear();
    const timeRef = `as of ${year}`;

    if (topic.includes("finance_invest"))
      return `${ll}${c} (${timeRef})\nInclude: current rates/values, recent changes, best platforms available now. Use latest data.`;
    if (topic.includes("science_ml"))
      return `${ll}What is the current state of ${c}? (${timeRef})\nInclude: latest models/approaches, recent breakthroughs, practical tools available now.`;
    if (topic.includes("finance_business"))
      return `${ll}${c} (${timeRef})\nInclude: current market conditions, real examples of companies doing this now, latest tools/platforms.`;
    if (topic.includes("code"))
      return `${ll}${c}\nInclude: latest best practices ${timeRef}, current recommended libraries/frameworks, recent changes to watch out for.`;
    if (intent === "compare")
      return `${ll}Compare ${c} (${timeRef})\nCurrent pricing, features, and which is better for what use case right now.`;

    return `${ll}${c} (${timeRef})\nUse recent sources. Include current best options/approaches.`;
  }

  // ── Full rewrite library ──────────────────────────
  const RW = {

    finance_business: {
      explain: (q,m,ll,exp,os) => m==="perplexity"||m==="grok" ? perplexityPrompt(q,"finance_business","explain",exp,ll) : build(m,ll,clean(q),
        ["Core concept with one REAL company example (not generic advice)",
         "Why most people fail (specific honest reason)",
         "The one thing that actually matters most",
         "Realistic first step to take this week",
         "One metric to know you're on the right track"],
        "Max 200 words. Real examples only. No vague advice. Answer ONLY what was asked.",exp,os),
      howto: (q,m,ll,exp,os) => m==="perplexity"||m==="grok" ? perplexityPrompt(q,"finance_business","howto",exp,ll) : build(m,ll,clean(q),
        ["Week 1 — exact action (not 'research your market')",
         "How to validate before building (specific method)",
         "How to get first paying customer",
         "How to turn into recurring revenue",
         "Biggest mistake to avoid"],
        "Specific steps. Name actual tools. Max 220 words.",exp,os),
      compare: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Key difference (1 sentence each)","Which makes money faster and why","Which is harder to copy","Fits solo founder vs team","Clear recommendation"],
        "Max 180 words. One clear recommendation.",exp,os),
      create: (q,m,ll,exp,os) => {
        const c=clean(q);
        if(m==="claude") return `${ll}<task>${c}</task>\n<requirements>\n- Specific and actionable\n- Real examples\n- No generic advice\n- Answer ONLY what was asked\n</requirements>\n<constraint>Max 250 words.</constraint>${os?oneShot(m):""}`;
        return `${ll}${c}\n\nSpecific. Real examples. No generic advice. Max 250 words.${os?oneShot(m):""}`;
      },
    },

    code_debug: {
      debug: (q,m,ll,exp,os) => {
        const c=clean(q);
        if(m==="claude") return `${ll}<bug>${c}</bug>\n<fix>\n1. Root cause (1 sentence)\n2. Minimal corrected code\n3. What was wrong\n4. Prevention pattern\n</fix>\n<constraint>Start with root cause. No preamble.</constraint>${os?oneShot(m):""}`;
        if(m==="perplexity"||m==="grok") return `${ll}${c}\nRoot cause + minimal fix. No preamble.`;
        return `${ll}${c}\n\n1. Root cause (1 sentence)\n2. Corrected code\n3. Why it happened\n4. Prevention\nNo preamble.${os?oneShot(m):""}`;
      },
      explain:(q,m,ll,exp,os)=>RW.code_debug.debug(q,m,ll,exp,os),
    },

    code_python: {
      explain: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["What it does (1 sentence)","Minimal runnable example","Line-by-line explanation","When to use vs NOT use","One common mistake"],
        "Runnable code. Max 15 lines. Answer ONLY this question.",exp,os),
      howto: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Complete working solution","Imports needed","Key steps explained","How to test","Edge case to handle"],
        "Runnable. Max 25 lines. Include error handling.",exp,os),
      create: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Complete implementation","Comments on non-obvious parts","Usage example","Error handling","How to extend"],
        "Production-ready. Runnable. Max 35 lines.",exp,os),
      debug:(q,m,ll,exp,os)=>RW.code_debug.debug(q,m,ll,exp,os),
    },

    code_js: {
      explain: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["One-sentence definition","Working ES6+ example","Key parts explained","Browser vs Node if different","One common pitfall"],
        "Runnable. Max 15 lines. Modern JS.",exp,os),
      howto: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Complete working solution","Setup/imports","Steps explained","How to test","Common issues"],
        "Runnable. Max 25 lines. Error handling.",exp,os),
      debug:(q,m,ll,exp,os)=>RW.code_debug.debug(q,m,ll,exp,os),
    },

    code_general: {
      explain: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Definition (1-2 sentences)","Working example","Step-by-step explanation","Real-world use case","Key thing to remember"],
        "Runnable. Max 20 lines. Answer ONLY this question.",exp,os),
      howto: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Complete solution","Prerequisites","Implementation steps","How to verify","Common issues"],
        "Production quality. Error handling. Explain steps.",exp,os),
      create: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Complete implementation","Comments on key parts","Usage example","Error handling","How to extend"],
        "Production-ready. Runnable.",exp,os),
      debug:(q,m,ll,exp,os)=>RW.code_debug.debug(q,m,ll,exp,os),
    },

    code_algo: {
      explain: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Plain English (no jargon first)","Visual walkthrough with small example","Code in Python","Time and space complexity","When to use vs alternatives"],
        "Example with array [3,1,4,1,5]. Show Big O.",exp,os),
    },

    code_db: {
      explain: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Plain terms explanation","SQL with sample data","Step-by-step","Performance tip","Common mistake"],
        "CREATE TABLE + sample INSERT + query. Max 20 lines.",exp,os),
    },

    code_api: {
      explain: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["What it does and when","Request/response with real data","Auth method","Error handling","Rate limiting note"],
        "Show both request AND response. Real data.",exp,os),
    },

    code_devops: {
      howto: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Exact copy-paste commands","What each does","Verify success","Common failures + fixes"],
        "Copy-paste ready. Include verification step.",exp,os),
    },

    code_git: {
      howto: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Exact commands","What each does","Verify success","How to undo"],
        "Copy-paste commands. Include undo steps.",exp,os),
    },

    code_other: {
      explain: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["What it does","Working example","Key syntax","When to use","Common gotcha"],
        "Working example. Max 15 lines.",exp,os),
    },

    science_ml: {
      explain: (q,m,ll,exp,os) => m==="perplexity"||m==="grok" ? perplexityPrompt(q,"science_ml","explain",exp,ll) : build(m,ll,clean(q),
        ["What it is — compare to how humans learn (analogy required)","How it works — mechanism (3 steps max)","Types/variants (1 sentence each if applicable)","Real product using this now (Netflix/Gmail/etc)","How to get started (3 specific steps)"],
        "Real product required. Max 220 words. No academic language.",exp,os),
      howto: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Working code (scikit-learn/PyTorch)","Data preparation","Training loop","Evaluation","Next step to improve"],
        "Working code first. Use iris/MNIST. Max 30 lines.",exp,os),
    },

    science_physics: {
      explain: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Core concept (1 precise sentence, no jargon)","Everyday analogy (in first 60 words)","How it works (3 points max)","Why it matters — one real application","One surprising implication"],
        "Analogy first. Max 200 words. One equation max.",exp,os),
    },

    science_math: {
      explain: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Intuitive explanation (no formulas first)","Geometric/visual interpretation","Formal definition","Fully worked numerical example","Where this appears in real problems"],
        "Intuition before formulas. One complete worked example.",exp,os),
      howto: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Step-by-step method","Fully worked example","Check your answer","Common mistakes"],
        "Show every step. Concrete numbers.",exp,os),
    },

    science_bio: {
      explain: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Plain language definition","How it works (simplified)","Real-world significance","Common misconception"],
        "Max 180 words. Analogy if possible.",exp,os),
    },

    science_chem: {
      explain: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Plain definition","What it looks like/how to recognize","Mechanism at molecular level","Real application","Safety note if relevant"],
        "Max 200 words. Real example required.",exp,os),
    },

    health_diabetes: {
      explain: (q,m,ll,exp,os) => build(m,ll,"What is diabetes and how is it managed?",
        ["Definition: what happens in the body (key/lock analogy)","Type 1 vs Type 2: one key difference each","Main symptoms (max 4, specific)","Management: diet + medication + lifestyle","Warning signs needing immediate help"],
        "Max 200 words. No jargon. Analogy required. Not medical advice.",exp,os),
      howto: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Specific foods to eat and avoid (examples)","Exercise type, duration, frequency","How/when to monitor blood sugar","Medication (consult doctor)","When to seek help urgently"],
        "Practical. Specific examples. Max 220 words. Not medical advice.",exp,os),
    },

    health_mental: {
      explain: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Clear definition without stigma","Common signs (how they feel from inside)","3 evidence-based coping strategies","When professional help needed","One free resource"],
        "Compassionate tone. Practical. Max 200 words.",exp,os),
    },

    health_nutrition: {
      howto: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Core principle (1 sentence)","Specific foods to eat","Specific foods to avoid","Practical meal timing","One common myth"],
        "Specific foods not categories. Max 200 words. Not medical advice.",exp,os),
    },

    health_fitness: {
      howto: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Starting point (beginner-friendly)","Weekly schedule","Specific exercises with form tips","How to track progress","Most common beginner mistake"],
        "Specific exercises. Max 220 words.",exp,os),
    },

    health_general: {
      explain: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Definition (1-2 sentences)","Main causes","Key symptoms","Treatment options","When to see doctor urgently"],
        "Max 180 words. Plain language. Not medical advice.",exp,os),
      howto: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Numbered practical steps","Safety precautions","What to avoid","When professional help needed"],
        "Practical only. Max 200 words.",exp,os),
    },

    finance_invest: {
      explain: (q,m,ll,exp,os) => m==="perplexity"||m==="grok" ? perplexityPrompt(q,"finance_invest","explain",exp,ll) : build(m,ll,clean(q),
        ["Simple definition","How it works with $1000 example","Expected returns (historical)","Key risks","How to get started (specific)"],
        "Number example required. Max 180 words. Not financial advice.",exp,os),
      compare: (q,m,ll,exp,os) => m==="perplexity"||m==="grok" ? perplexityPrompt(q,"finance_invest","compare",exp,ll) : build(m,ll,clean(q),
        ["Key difference (1 sentence each)","Risk: low/medium/high with reason","Realistic returns","Who each suits","Recommendation with reasoning"],
        "Use $1000 example. Max 200 words. Not financial advice.",exp,os),
      howto: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Exact steps to start","Minimum amount needed","Platform (name it)","First milestone","Biggest mistake"],
        "Specific. Name platforms. Max 200 words.",exp,os),
    },

    finance_personal: {
      howto: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Specific numbered steps","Useful numbers/percentages","Free tools","Realistic timeline","One thing most overlook"],
        "Practical. Specific numbers. Max 200 words.",exp,os),
    },

    finance_tax: {
      explain: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Plain English explanation","Who it applies to","Key deadlines","Common deductions","When to consult professional"],
        "Plain language. Max 180 words. Not tax advice.",exp,os),
    },

    career: {
      howto: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Specific action steps","What to prepare first","Common mistakes","Realistic timeline","One thing most overlook"],
        "Specific actions. Max 200 words.",exp,os),
      create: (q,m,ll,exp,os) => {
        const c=clean(q);
        if(m==="claude") return `${ll}<task>${c}</task>\n<requirements>\n- Specific to role and company\n- Quantify achievements (numbers, %)\n- ATS-friendly\n- No clichés\n- Answer ONLY what was asked\n</requirements>${os?oneShot(m):""}`;
        return `${ll}${c}\n\nSpecific to role. Quantify achievements. No clichés. ATS-friendly.${os?oneShot(m):""}`;
      },
    },

    lang_learn: {
      howto: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Realistic timeline to conversational level","Weeks 1-2: exactly what to learn first","Best free resource (name it specifically)","First achievable milestone","Most common beginner mistake"],
        "Name actual apps/tools. No vague advice. Max 200 words.",exp,os),
    },

    travel: {
      howto: (q,m,ll,exp,os) => m==="perplexity"||m==="grok" ? perplexityPrompt(q,"travel","howto",exp,ll) : build(m,ll,clean(q),
        ["Step-by-step process","Documents required","Estimated costs and time","Best time to go","Common issues to avoid"],
        "Specific. Include cost ranges. Max 200 words.",exp,os),
    },

    legal: {
      explain: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Plain English explanation","When it applies","Key rights/obligations","Common misconceptions","When to consult lawyer"],
        "Plain language. Max 180 words. Not legal advice.",exp,os),
    },

    education: {
      explain: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Simplest definition (one sentence)","Intuitive analogy from everyday life","How it works (3-4 points)","Concrete example","Why it matters"],
        "Analogy required. Max 180 words. Answer ONLY this specific question.",exp,os),
    },

    general: {
      explain: (q,m,ll,exp,os) => {
        const c=clean(q),shot=os?oneShot(m):"";
        if(m==="claude") return `${ll}<question>${c}</question>\n<format>\n- Direct answer first (1-2 sentences)\n- Key details (max 4 points)\n- One concrete example\n</format>\n<constraint>Answer in first sentence. Max 150 words. Answer ONLY what was asked.</constraint>${shot}`;
        if(m==="perplexity"||m==="grok") return `${ll}${c}\nDirect answer first. Key points. One example. Max 120 words.${shot}`;
        return `${ll}${c}\n\nAnswer directly in first sentence.\n1. Key details (max 4 points)\n2. One concrete example\nMax 150 words.${shot}`;
      },
      compare: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Key differences","Pros and cons each","Best use case for each","Clear recommendation"],
        "Max 200 words.",exp,os),
      howto: (q,m,ll,exp,os) => build(m,ll,clean(q),
        ["Numbered steps","Prerequisites","Common mistakes","How to verify"],
        "Actionable. Max 180 words.",exp,os),
      create: (q,m,ll,exp,os) => {
        const c=clean(q),shot=os?oneShot(m):"";
        if(m==="claude") return `${ll}<task>${c}</task>\n<requirements>Complete, practical, ready to use. Answer ONLY what was asked.</requirements>${shot}`;
        return `${ll}Task: ${c}\n\nComplete and practical.${shot}`;
      },
      debug:(q,m,ll,exp,os)=>RW.code_debug.debug(q,m,ll,exp,os),
    },
  };

  // ── Token counter ────────────────────────────────
  function countTokens(text) {
    const h=(text.match(/[\u0900-\u097F\u0A80-\u0AFF]/g)||[]).length;
    const a=(text.match(/[\u0600-\u06FF]/g)||[]).length;
    const c=(text.match(/[\u4E00-\u9FFF\uAC00-\uD7AF\u3040-\u30FF]/g)||[]).length;
    return Math.max(1, Math.ceil(h/2 + a/1.5 + c/1.5 + (text.length-h-a-c)/4));
  }

  // ── Main optimize ────────────────────────────────
  function optimize(rawText, targetModel="claude", memoryContext="", oneShotMode=false) {
    const lang     = detectLang(rawText);
    const topic    = detectTopic(rawText);
    const intent   = detectIntent(rawText);
    const expertise= detectExpertise(rawText);
    const quality  = scoreQuestion(rawText);
    const langLine = lang.code !== "en" ? `Respond in ${lang.name}.\n\n` : "";
    const topicRW  = RW[topic] || RW.general;
    const fn       = topicRW[intent] || topicRW.explain || RW.general.explain;
    let optimized  = fn(rawText, targetModel, langLine, expertise, oneShotMode);
    if (memoryContext) optimized = `[Context: ${memoryContext}]\n\n${optimized}`;
    const tokOrig  = countTokens(rawText);
    const tokOpt   = countTokens(optimized);
    return {
      original: rawText, optimized,
      lang, topic, intent, expertise, quality, targetModel,
      tokOrig, tokOpt,
      saved: Math.max(0, tokOrig - tokOpt),
      outReduction: 0.35,
      contextUsed: !!memoryContext,
      oneShotMode,
      note: `KOVA v4: ${lang.name} · ${topic.replace(/_/g," ")} · ${intent} · ${expertise} · ${targetModel}`,
    };
  }

  return { optimize, detectLang, detectTopic, detectIntent, detectExpertise, scoreQuestion, countTokens };
})();

if (typeof module !== "undefined") module.exports = KOVA;
