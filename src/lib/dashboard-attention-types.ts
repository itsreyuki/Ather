export type DashboardAttentionKind = "POST_ASSESSMENT" | "PHONELESS_STAFF" | "IMPORT_REVIEW" | "DRAFT_WORKSHOP";
export type DashboardAttentionTone = "warning" | "info" | "error" | "neutral";

export type DashboardAttentionItem = {
  key: string;
  fingerprint: string;
  kind: DashboardAttentionKind;
  tone: DashboardAttentionTone;
  title: string;
  description: string;
  href: string;
  statusLabel: string;
};
