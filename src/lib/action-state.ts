/** Shared shape for server-action form state (client-safe). */
export interface FormState {
  error?: string;
  field?: string;
  message?: string;
  ok?: boolean;
  step?: "email" | "code" | "done";
  email?: string;
  sentAt?: number;
  retryAfter?: number;
}

export const emptyFormState: FormState = {};
