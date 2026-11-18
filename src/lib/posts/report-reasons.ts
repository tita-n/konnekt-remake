export const REPORT_REASON_OPTIONS = [
  { value: "SPAM", label: "Spam" },
  { value: "HARASSMENT", label: "Harassment or bullying" },
  { value: "HATE_OR_ABUSE", label: "Hate or abuse" },
  { value: "NUDITY_OR_SEXUAL_CONTENT", label: "Nudity or sexual content" },
  { value: "VIOLENCE_OR_THREATS", label: "Violence or threats" },
  { value: "IMPERSONATION", label: "Impersonation" },
  { value: "FALSE_INFORMATION", label: "False information" },
  { value: "SOMETHING_ELSE", label: "Something else" },
] as const;

export type ReportReasonValue = (typeof REPORT_REASON_OPTIONS)[number]["value"];
