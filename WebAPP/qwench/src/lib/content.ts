/**
 * Editorial content: the only text on this site that isn't either a fixed
 * template or something the API returned.
 *
 * Nothing here states a legal state, a date or a source. Which names to feature
 * is an editorial choice; what the site then says about each one comes from a
 * live check. See docs/spec/README.md rules 1, 2 and 15.
 */

/**
 * Names shown on the home page as examples. Every fact beside a name — its
 * state, its source, its date — is fetched from POST /v1/public/check at request
 * time. If a record is withdrawn, the card changes on its own.
 */
export const FEATURED_CHECKS = [
  "Yepbit Trading",
  "Menzgold Ghana Limited",
  "Expert Option",
  "Infarms",
  "Databank Financial Services",
  "IC Securities",
];

/** Names offered under the paste box, so a first-time visitor has somewhere to start. */
export const EXAMPLE_QUERIES = ["Yepbit Trading", "Menzgold", "sec.gov.gh", "Databank"];

export const HOW_IT_WORKS = [
  {
    title: "Search or paste a link",
    desc: "A company name, a MoMo number, a crypto wallet, a website, or a whole forwarded message.",
  },
  {
    title: "We check official sources",
    desc: "SEC Ghana notices, licence and sandbox registers, Bank of Ghana records, and reports a person has reviewed.",
  },
  {
    title: "You get evidence, not advice",
    desc: "The record, who published it, the date, the link, and questions worth asking. Qwench never tells you what to do.",
  },
];

export const WHAT_WE_DO_NOT_DO = [
  "We never give a score, a rating or a verdict.",
  "We never tell you whether to pay. That decision stays yours.",
  "We never block a payment, hold money, or contact anyone you ask about.",
  "We never publish who reported something, or who checked it.",
  "Nobody can pay us for a different result.",
];

/* ------------------------------------------------------------------ *
 * Blog
 * ------------------------------------------------------------------ */

export type Article = {
  slug: string;
  title: string;
  description: string;
  category: string;
  date: string;
  readTime: string;
  author?: string;
  gradientFrom: string;
  gradientTo: string;
  body?: string[];
};

/**
 * Written for the hackathon, so each one is a short explainer rather than a
 * full article. Qwench's own wording avoids "scam", "safe", "verified" and
 * "fraudulent" here too — these pages carry the same name as the check does.
 */
export const ARTICLES: Article[] = [
  {
    slug: "what-a-sec-ghana-notice-actually-says",
    title: "What an SEC Ghana notice actually says",
    description:
      "A public notice is a legal act with a date, a publisher and wording you can read for yourself. Here is how to find and read one.",
    category: "Explainer",
    date: "28 Oct 2026",
    readTime: "5 min read",
    gradientFrom: "#00d4aa",
    gradientTo: "#0F3460",
    body: [
      "When the Securities and Exchange Commission names a company in a public notice, it publishes a document: a title, a date, and wording that says what the Commission found. That document is the evidence. Everything else — what people say online, what a group chat claims, what an agent tells you on a call — is not.",
      "Qwench shows you the notice, the publisher, the date it was published, and a link to the original. It does not summarise the Commission's finding in its own words, because a paraphrase can drift from what was actually said.",
      "A notice is also not permanent. Records are withdrawn, licences lapse and sandbox approvals expire. That is why every result carries the date the data was last loaded, and why a result from six months ago should be checked again.",
    ],
  },
  {
    slug: "licensed-is-not-the-same-as-safe",
    title: "“Licensed” is not the same as safe",
    description:
      "A name on SEC Ghana's licensed list tells you one specific thing. Here is what it does and does not cover.",
    category: "Explainer",
    date: "24 Oct 2026",
    readTime: "4 min read",
    gradientFrom: "#2ecc71",
    gradientTo: "#00d4aa",
    body: [
      "A licence says that a firm has met the Commission's requirements to operate in a particular role — a fund manager, a broker-dealer, a custodian. It is a fact about the firm's legal standing on a given date.",
      "It does not say an investment will pay. It does not say a product is suitable for you. And it very much does not say that the person messaging you is really from that firm, which is the most common way a licensed name gets used against someone.",
      "This is why a licensed result in Qwench still comes with a question: can you confirm this with the firm, using the contact details on the firm's own website rather than the ones you were sent?",
    ],
  },
  {
    slug: "the-arithmetic-of-a-return-promise",
    title: "The arithmetic of a return promise",
    description:
      "30% a month is 360% a year by simple multiplication. No judgement needed — just the multiplication.",
    category: "Explainer",
    date: "20 Oct 2026",
    readTime: "3 min read",
    gradientFrom: "#f39c12",
    gradientTo: "#e94560",
    body: [
      "When Qwench finds a stated return in a message, it does one thing: it restates it per year by simple multiplication, and says so. 30% a month becomes about 360% a year. 2% a day becomes about 730% a year.",
      "That is not a forecast, and it is not a claim about whether the offer is real. It is arithmetic, shown so you can put the number next to what you know about returns elsewhere.",
      "Compounding would give a much larger figure. Qwench deliberately uses the smaller, simpler one, because the point is to make the promise legible, not to make it look worse than it is.",
    ],
  },
  {
    slug: "when-a-name-is-almost-a-real-name",
    title: "When a name is almost a real name",
    description:
      "One letter changed, one word added. Why Qwench asks which name you meant before it says anything.",
    category: "Explainer",
    date: "16 Oct 2026",
    readTime: "4 min read",
    gradientFrom: "#e94560",
    gradientTo: "#f39c12",
    body: [
      "A name one letter away from a registered firm is a hard case. Answering about the registered firm would be wrong if you meant the other one. Answering about the other one would be wrong if you simply mistyped.",
      "So Qwench asks. When a name you search is close to one on a register, you get the choice before you get a result, and the result you get afterwards is about the name you picked.",
      "Where a person at Qwench has reviewed a case and found a name being used as another business's, that becomes a record of its own — an impersonation finding, naming the business whose name was used.",
    ],
  },
  {
    slug: "what-happens-to-a-report",
    title: "What happens to a report",
    description:
      "A report never changes a public result on its own. It opens a review, and two people have to agree.",
    category: "How Qwench works",
    date: "12 Oct 2026",
    readTime: "4 min read",
    gradientFrom: "#0F3460",
    gradientTo: "#2ecc71",
    body: [
      "Reports are the most useful thing people send Qwench, and the easiest thing to get wrong. A single report, published as-is, is an accusation nobody has checked.",
      "So a report does one thing: it opens a review. A person reads it, looks for something checkable — a link, a published notice, a register entry — and captures a record. A second person, who is not the first, then has to approve it before it appears in any result.",
      "This is why you will not find a feed of other people's reports on this site. Until two people have reviewed something, there is nothing Qwench is willing to say about it in public.",
    ],
  },
  {
    slug: "how-to-check-before-you-send-money",
    title: "How to check before you send money",
    description: "Five things worth doing in the two minutes before a transfer goes out.",
    category: "Practical",
    date: "8 Oct 2026",
    readTime: "5 min read",
    gradientFrom: "#00d4aa",
    gradientTo: "#f39c12",
    body: [
      "Ask for a licence number, then confirm it with SEC Ghana on 0800 100 065 rather than with whoever gave it to you.",
      "Look up the firm's own website and use the contact details there. A number sent to you in a message proves nothing about who owns it.",
      "Check whether the name you were given matches the name on the payment prompt. A mismatch is worth stopping for.",
      "Write down what you were promised, in the words it was promised to you. If a figure was mentioned, keep the figure.",
      "If money has already gone and you think something is wrong, call the Cyber Security Authority on 292 and your bank. The sooner the better.",
    ],
  },
];

export const FEATURED_ARTICLE = ARTICLES[0];

export const BLOG_CATEGORIES = ["All posts", "Explainer", "How Qwench works", "Practical"];
