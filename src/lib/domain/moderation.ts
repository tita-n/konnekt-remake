import type { ReportReason } from "@prisma/client";

/** Client-safe labels shared by report sheets and moderation consoles. */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  SPAM: "Spam",
  HARASSMENT: "Harassment or bullying",
  HATE_OR_ABUSE: "Hate or abuse",
  NUDITY_OR_SEXUAL_CONTENT: "Nudity or sexual content",
  VIOLENCE_OR_THREATS: "Violence or threats",
  IMPERSONATION: "Impersonation",
  FALSE_INFORMATION: "False information",
  SOMETHING_ELSE: "Something else",
};

export const REPORT_REASONS = Object.keys(REPORT_REASON_LABELS) as ReportReason[];
