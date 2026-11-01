export type RiskLevel = "HIGH" | "MEDIUM" | "LOW";

export interface TrendingWarning {
  slug: string;
  name: string;
  risk: RiskLevel;
  reports: number;
  description: string;
}

export interface RedFlag {
  number: number;
  text: string;
}

export interface CommunityQuote {
  author: string;
  text: string;
  timeAgo: string;
}

export interface OnlinePresence {
  domainAge: string;
  socialActivity: string;
  officeVerified: string;
  reviewsOnline: string;
}

export interface RiskReport {
  slug: string;
  name: string;
  score: number;
  risk: RiskLevel;
  riskLabel: string;
  secStatus: string;
  secDetail: string;
  redFlags: RedFlag[];
  communityReports: number;
  communityQuote: CommunityQuote;
  onlinePresence: OnlinePresence;
  relatedSearches: string[];
}

export interface CommunityReport {
  id: string;
  authorInitials: string;
  authorName: string;
  timeAgo: string;
  location: string;
  investmentName: string;
  risk: RiskLevel;
  body: string;
  upvotes: number;
  comments: number;
  category: string;
}

export interface Article {
  slug: string;
  title: string;
  description: string;
  category: string;
  categoryLabel: string;
  date: string;
  readTime: string;
  author?: string;
  featured?: boolean;
  gradientFrom: string;
  gradientTo: string;
}

export interface WatchlistItem {
  slug: string;
  name: string;
  score: number;
  risk: RiskLevel;
  change: string;
  addedAgo: string;
}

export interface Alert {
  id: string;
  type: "risk-change" | "verified" | "trending";
  title: string;
  description: string;
  timeAgo: string;
}

export interface UserReport {
  id: string;
  investmentName: string;
  status: string;
  timeAgo: string;
}
