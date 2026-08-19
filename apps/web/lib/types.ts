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
  source_count: number;
};

export type IssueOption = {
  id: string;
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
  updated_at: string;
  options: IssueOption[];
  sources: Array<{
    id: string;
    title: string;
    publisher: string;
    url: string;
    source_type: string;
  }>;
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
  like_count: number;
  dislike_count: number;
  rebuttal_count: number;
  viewer_reactions: string[];
  replies: Comment[];
};
