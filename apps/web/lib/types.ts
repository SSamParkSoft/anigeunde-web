export type IssueSummary = {
  id: string;
  slug: string;
  question: string;
  brief: string;
  category: string;
  status: string;
  featured: boolean;
  participant_count: number;
  comment_count: number;
  published_at: string | null;
  closes_at: string | null;
};

export type IssueOption = {
  id: string;
  stance: "SUPPORT" | "OPPOSE";
  label: string;
  short_label: string;
};

export type IssueResult = {
  total: number;
  updated_at: string;
  options: Array<{
    option_id: string;
    label: string;
    count: number;
    percentage: number;
  }>;
};

export type IssueDetail = {
  id: string;
  slug: string;
  question: string;
  brief: string;
  category: string;
  status: string;
  published_at: string | null;
  closes_at: string | null;
  participation_open: boolean;
  updated_at: string;
  options: IssueOption[];
  my_position_id: string | null;
  results: IssueResult | null;
};

export type Comment = {
  id: string;
  nickname: string;
  body: string;
  position: string;
  created_at: string;
  depth: number;
  parent_id: string | null;
  is_mine: boolean;
  can_delete: boolean;
  is_deleted: boolean;
  is_blocked: boolean;
  like_count: number;
  dislike_count: number;
  rebuttal_count: number;
  viewer_reactions: string[];
  replies: Comment[];
};

export type CommentReportReason =
  | "POLICY_VIOLATION"
  | "HARASSMENT_OR_HATE"
  | "FALSE_OR_DEFAMATORY"
  | "PRIVACY"
  | "ILLEGAL_OR_DANGEROUS"
  | "SPAM"
  | "OTHER";

export type NewsCandidate = {
  id: string;
  title: string;
  description: string;
  url: string;
  naver_url: string | null;
  publisher_domain: string;
  published_at: string;
  status: string;
  filter_reason_codes: string[];
  categories: string[];
  cluster_id: string | null;
  cluster_status: string | null;
  candidate_score: number | null;
  ai_score: number | null;
  risk_flags: string[];
};

export type NewsCandidatePool = {
  items: NewsCandidate[];
  categories: string[];
  category_counts: Record<string, number>;
  total_count: number;
};

export type NewsSearchQuery = {
  id: string;
  category: string;
  query: string;
  enabled: boolean;
  interval_minutes: number;
  priority: number;
  last_fetched_at: string | null;
};

export type NewsFetchResult = {
  run_id: string;
  status: string;
  received_count: number;
  new_count: number;
  duplicate_count: number;
  filtered_count: number;
  created_cluster_count: number;
};

export type NewsBatchFetchResult = {
  items: Array<Partial<NewsFetchResult> & {
    query_id: string;
    query: string;
    status: string;
    error: string | null;
  }>;
  requested_count: number;
  succeeded_count: number;
  failed_count: number;
  created_cluster_count: number;
};

export type AdminIssue = {
  id: string;
  slug: string;
  question: string;
  brief: string;
  category: string;
  status: string;
  featured: boolean;
  scheduled_at: string | null;
  published_at: string | null;
  closes_at: string | null;
  submitted_by: string | null;
  approved_by: string | null;
  options: IssueOption[];
  sources: Array<{
    id: string;
    title: string;
    publisher: string;
    url: string;
    source_type: string;
  }>;
};

export type SelectedNewsDraft = {
  issue: AdminIssue;
  cluster_id: string;
  generation_status: string;
  duplicate_status: string;
  duplicate_issue_id: string | null;
  duplicate_issue_question: string | null;
  duplicate_reason: string;
  selected_at: string;
};
