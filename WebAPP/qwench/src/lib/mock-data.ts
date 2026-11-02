import type {
  TrendingWarning,
  RiskReport,
  CommunityReport,
  Article,
  WatchlistItem,
  Alert,
  UserReport,
} from "./types";

export const trendingWarnings: TrendingWarning[] = [
  {
    slug: "fortunex-pro",
    name: "FortuneX Pro",
    risk: "HIGH",
    reports: 247,
    description: "Promises 30% monthly returns · Not SEC licensed",
  },
  {
    slug: "goldvest-international",
    name: "GoldVest International",
    risk: "HIGH",
    reports: 189,
    description: "Fake forex platform · Unlicensed",
  },
  {
    slug: "easybit-trading",
    name: "EasyBit Trading",
    risk: "MEDIUM",
    reports: 83,
    description: "Unclear licensing · Withdrawal delays",
  },
];

export const riskReports: Record<string, RiskReport> = {
  "fortunex-pro": {
    slug: "fortunex-pro",
    name: "FortuneX Pro",
    score: 8.5,
    risk: "HIGH",
    riskLabel: "We recommend extreme caution",
    secStatus: "Not Licensed by SEC Ghana",
    secDetail: "No registration number found in SEC database",
    redFlags: [
      { number: 1, text: "Promises 30% monthly returns (unrealistic)" },
      { number: 2, text: "No verifiable team or office address" },
      { number: 3, text: "Not registered with SEC Ghana" },
      { number: 4, text: "Website registered just 2 months ago" },
    ],
    communityReports: 247,
    communityQuote: {
      author: "Kofi A.",
      text: '"Promised 30% monthly but 4 months in, no payout. Can\'t reach anyone."',
      timeAgo: "2 hours ago",
    },
    onlinePresence: {
      domainAge: "2 months",
      socialActivity: "Suspicious",
      officeVerified: "No",
      reviewsOnline: "Negative",
    },
    relatedSearches: [
      "GoldVest Intl",
      "EasyBit Trading",
      "QuickFlip",
      "SmartCash",
    ],
  },
  "goldvest-international": {
    slug: "goldvest-international",
    name: "GoldVest International",
    score: 7.8,
    risk: "HIGH",
    riskLabel: "We recommend extreme caution",
    secStatus: "Not Licensed by SEC Ghana",
    secDetail: "No registration number found in SEC database",
    redFlags: [
      { number: 1, text: "Claims guaranteed forex profits" },
      { number: 2, text: "Not registered with SEC Ghana" },
      { number: 3, text: "Multiple withdrawal complaints" },
      { number: 4, text: "Fake testimonials detected" },
    ],
    communityReports: 189,
    communityQuote: {
      author: "Akosua M.",
      text: '"They claim guaranteed forex profits. Lost my school fees money. SEC confirmed they are not licensed."',
      timeAgo: "4 hours ago",
    },
    onlinePresence: {
      domainAge: "5 months",
      socialActivity: "Suspicious",
      officeVerified: "No",
      reviewsOnline: "Negative",
    },
    relatedSearches: [
      "FortuneX Pro",
      "EasyBit Trading",
      "QuickFlip",
      "SmartCash",
    ],
  },
  "easybit-trading": {
    slug: "easybit-trading",
    name: "EasyBit Trading",
    score: 5.2,
    risk: "MEDIUM",
    riskLabel: "Exercise caution",
    secStatus: "Verification Pending",
    secDetail: "Claims to be licensed but registration not confirmed",
    redFlags: [
      { number: 1, text: "Unclear licensing status" },
      { number: 2, text: "Withdrawal delays reported" },
      { number: 3, text: "Limited company information available" },
    ],
    communityReports: 83,
    communityQuote: {
      author: "Yaw B.",
      text: '"Site claims they are licensed but I cannot find them in the SEC register. Withdrawals delayed 2 weeks."',
      timeAgo: "6 hours ago",
    },
    onlinePresence: {
      domainAge: "8 months",
      socialActivity: "Low",
      officeVerified: "Unverified",
      reviewsOnline: "Mixed",
    },
    relatedSearches: [
      "FortuneX Pro",
      "GoldVest Intl",
      "QuickFlip",
      "SmartCash",
    ],
  },
};

export const communityReports: CommunityReport[] = [
  {
    id: "1",
    authorInitials: "KA",
    authorName: "Kofi A.",
    timeAgo: "2 hours ago",
    location: "Accra",
    investmentName: "FortuneX Pro",
    risk: "HIGH",
    body: '"Promised 30% monthly returns. 4 months in, nothing. Can\'t reach the \'account manager\' anymore. Please avoid."',
    upvotes: 42,
    comments: 8,
    category: "Ponzi/MLM",
  },
  {
    id: "2",
    authorInitials: "AM",
    authorName: "Akosua M.",
    timeAgo: "4 hours ago",
    location: "Kumasi",
    investmentName: "GoldVest International",
    risk: "HIGH",
    body: '"They claim \'guaranteed\' forex profits. Lost my school fees money. SEC confirmed they are not licensed."',
    upvotes: 28,
    comments: 12,
    category: "Forex",
  },
  {
    id: "3",
    authorInitials: "YB",
    authorName: "Yaw B.",
    timeAgo: "6 hours ago",
    location: "Takoradi",
    investmentName: "EasyBit Trading",
    risk: "MEDIUM",
    body: '"Site claims they are licensed but I cannot find them in the SEC register. Withdrawals delayed 2 weeks."',
    upvotes: 15,
    comments: 6,
    category: "Crypto",
  },
  {
    id: "4",
    authorInitials: "EO",
    authorName: "Esi O.",
    timeAgo: "8 hours ago",
    location: "Cape Coast",
    investmentName: "QuickFlip Invest",
    risk: "HIGH",
    body: '"Was told I could double my money in 2 weeks. Lost GHS 5,000. The website has since disappeared."',
    upvotes: 34,
    comments: 15,
    category: "Ponzi/MLM",
  },
  {
    id: "5",
    authorInitials: "KM",
    authorName: "Kwame M.",
    timeAgo: "1 day ago",
    location: "Tema",
    investmentName: "SmartCash Africa",
    risk: "HIGH",
    body: '"Classic pyramid scheme. They recruit people with promises of passive income. The math doesn\'t add up."',
    upvotes: 56,
    comments: 22,
    category: "Ponzi/MLM",
  },
];

export const mostReportedThisWeek = [
  { name: "FortuneX Pro", reports: 247, risk: "HIGH" as const },
  { name: "GoldVest Intl", reports: 189, risk: "HIGH" as const },
  { name: "EasyBit Trading", reports: 83, risk: "MEDIUM" as const },
  { name: "QuickFlip Invest", reports: 61, risk: "HIGH" as const },
  { name: "SmartCash Africa", reports: 47, risk: "HIGH" as const },
];

export const articles: Article[] = [
  {
    slug: "5-red-flags-every-ghanaian-investor-should-know",
    title: "5 Red Flags Every Ghanaian Investor Should Know",
    description:
      "The warning signs that separate real investments from financial traps.",
    category: "TRENDING NOW",
    categoryLabel: "SCAM ALERT",
    date: "Oct 25",
    readTime: "5 min read",
    gradientFrom: "#e94560",
    gradientTo: "#f39c12",
  },
  {
    slug: "how-to-verify-a-crypto-project-before-you-invest",
    title: "How to Verify a Crypto Project Before You Invest",
    description:
      "A 7-step framework for spotting legit tokens from rug pulls.",
    category: "BEGINNER GUIDE",
    categoryLabel: "EDUCATION",
    date: "Oct 22",
    readTime: "7 min read",
    gradientFrom: "#2ecc71",
    gradientTo: "#00d4aa",
  },
  {
    slug: "sec-ghana-blacklists-14-firms-q3-2026",
    title: "SEC Ghana Blacklists 14 Firms in Q3 2026",
    description:
      "The quarterly scam register — and what it means for your portfolio.",
    category: "OFFICIAL",
    categoryLabel: "SEC UPDATE",
    date: "Oct 18",
    readTime: "4 min read",
    gradientFrom: "#00d4aa",
    gradientTo: "#0F3460",
  },
  {
    slug: "licensed-vs-unlicensed-why-it-matters",
    title: "Licensed vs Unlicensed: Why It Actually Matters",
    description: "Understanding SEC Ghana licensing in plain language.",
    category: "EXPLAINER",
    categoryLabel: "EDUCATION",
    date: "Oct 15",
    readTime: "6 min read",
    gradientFrom: "#f39c12",
    gradientTo: "#e94560",
  },
  {
    slug: "forex-trading-in-ghana-legit-or-trap",
    title: "Forex Trading in Ghana: Legit or Trap?",
    description:
      'Separating real brokers from the "guaranteed returns" shills.',
    category: "DEEP DIVE",
    categoryLabel: "CASE STUDY",
    date: "Oct 12",
    readTime: "9 min read",
    gradientFrom: "#0F3460",
    gradientTo: "#2ecc71",
  },
  {
    slug: "what-to-do-if-youve-been-scammed-in-ghana",
    title: "What to Do If You've Been Scammed in Ghana",
    description:
      "Legal steps, reporting channels, and recovery options.",
    category: "PROTECT YOURSELF",
    categoryLabel: "EDUCATION",
    date: "Oct 9",
    readTime: "5 min read",
    gradientFrom: "#00d4aa",
    gradientTo: "#f39c12",
  },
];

export const featuredArticle: Article & { author: string } = {
  slug: "how-fortunex-pro-scammed-2400-ghanaians",
  title: "How FortuneX Pro Scammed 2,400 Ghanaians",
  description:
    "A deep investigation into the Ponzi scheme that promised 30% monthly returns and vanished with GHS 12 million. We trace the warning signs, the SEC's response, and what every young investor can learn.",
  category: "CASE STUDY",
  categoryLabel: "CASE STUDY",
  date: "Oct 28, 2026",
  readTime: "8 min read",
  author: "Ama Nkrumah",
  featured: true,
  gradientFrom: "#1a1a2e",
  gradientTo: "#00d4aa",
};

export const watchlistItems: WatchlistItem[] = [
  {
    slug: "fortunex-pro",
    name: "FortuneX Pro",
    score: 8.5,
    risk: "HIGH",
    change: "unchanged in 7 days",
    addedAgo: "3d ago",
  },
  {
    slug: "easybit-trading",
    name: "EasyBit Trading",
    score: 5.2,
    risk: "MEDIUM",
    change: "worsening (+2.8)",
    addedAgo: "2w ago",
  },
  {
    slug: "databank-ghana",
    name: "Databank Ghana",
    score: 1.5,
    risk: "LOW",
    change: "stable",
    addedAgo: "1mo ago",
  },
];

export const alerts: Alert[] = [
  {
    id: "1",
    type: "risk-change",
    title: "EasyBit Trading risk changed",
    description: "Score went from Low (2.4) to Medium (5.2)",
    timeAgo: "2 hours ago",
  },
  {
    id: "2",
    type: "verified",
    title: "Databank Ghana re-verified",
    description: "SEC license renewed for 2026-2027",
    timeAgo: "1 day ago",
  },
  {
    id: "3",
    type: "trending",
    title: "New scheme trending",
    description: '"CediBoost" flagged by 23 users today',
    timeAgo: "3 days ago",
  },
];

export const userReports: UserReport[] = [
  {
    id: "1",
    investmentName: "GoldVest International",
    status: "Confirmed scam · Action taken by SEC",
    timeAgo: "5 days ago",
  },
  {
    id: "2",
    investmentName: "QuickFlip Invest",
    status: "Investigating · 12 corroborating reports",
    timeAgo: "2 days ago",
  },
];

export const user = {
  name: "Abdul-Hamid",
  initials: "AH",
};

export const stats = {
  scamsFlagged: 847,
  investmentsVerified: 12453,
  communityReports: 3206,
};
