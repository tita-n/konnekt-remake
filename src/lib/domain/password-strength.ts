/** Client-safe password strength estimate (no network, no secrets). */

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Very weak" | "Weak" | "Fair" | "Good" | "Strong";
  suggestions: string[];
}

const COMMON = new Set([
  "password",
  "password1",
  "123456789",
  "qwertyuiop",
  "letmein",
  "iloveyou",
  "welcome",
  "admin123",
  "konnekt",
]);

export function passwordStrength(password: string, userInputs: string[] = []): PasswordStrength {
  const suggestions: string[] = [];
  let score = 0;
  if (password.length >= 10) score += 1;
  else suggestions.push("Use at least 10 characters.");
  if (password.length >= 14) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  else suggestions.push("Mix upper and lower case.");
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  else if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 0.5;
  else suggestions.push("Add a number or symbol.");

  const lower = password.toLowerCase();
  if (COMMON.has(lower)) {
    score = 0;
    suggestions.unshift("This password appears in breach lists.");
  }
  for (const input of userInputs) {
    if (input && input.length >= 3 && lower.includes(input.toLowerCase())) {
      score = Math.min(score, 1);
      suggestions.push("Avoid your name, email or username in your password.");
      break;
    }
  }

  if (password.length >= 20) score = Math.max(score, 3);

  const rounded = Math.max(0, Math.min(4, Math.round(score))) as PasswordStrength["score"];
  const labels: PasswordStrength["label"][] = ["Very weak", "Weak", "Fair", "Good", "Strong"];
  return { score: rounded, label: labels[rounded]!, suggestions: suggestions.slice(0, 3) };
}
