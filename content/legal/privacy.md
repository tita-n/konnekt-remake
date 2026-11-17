---
title: Privacy Policy
version: 2026-01-01
updated: 1 January 2026
---

# Privacy Policy

**Version 2026-01-01.** Konnekt handles personal data under the **Nigeria Data Protection Act 2023 (NDPA)**. This policy explains what we collect, why, who can see it and how to exercise your rights.

## 1. What we collect

- **Account details:** full name, username, email address, password hash, profile photo, bio and interests.
- **Student verification:** university, matric number, department, level, postgraduate status, and — only while a request is pending — a photo of your student ID or course registration slip.
- **Security data:** hashed IP addresses, browser user-agent, session timestamps, and records of sign-in and security actions.
- **Consent records:** the policy version you accepted and when.
- **Preferences:** visibility settings for your department and level. Theme and Data saver choices stay on your device.

We do not collect your phone number, precise location, contacts, or advertising identifiers. We do not use third-party advertising trackers.

## 2. Why we process it (lawful basis)

| Purpose | Data | Basis |
| --- | --- | --- |
| Create and secure your account | Account and security data | Contract |
| Confirm you are a student of your university | Matric number, ID image, academic details | Legitimate interest and consent |
| Show your profile to verified students at your university | Name, username, photo, bio, interests, department and level (as you allow) | Consent |
| Keep the service safe | Session and audit records | Legitimate interest; legal obligation |

## 3. Who can see what

- Your profile is visible only to verified students of **your** university. There is no cross-university browsing.
- Your ID image is visible only to reviewers at your university, through short-lived signed links. It is deleted when your request is decided — approved or rejected.
- Konnekt staff may access account records to investigate abuse or honour legal requests. Access is logged.
- Service providers process data on our behalf under contract: Neon (database), Vercel (hosting), Cloudinary (image storage), Resend (email), Upstash (rate limiting), Cloudflare (bot protection) and Sentry (error monitoring). Some may process data outside Nigeria; transfers use appropriate safeguards.

We do not sell personal data.

## 4. How long we keep it

- Account and profile data: while your account exists, then 30 days after a deletion request.
- Pending ID images: until the request is decided; if a request is abandoned, the signup draft and image are deleted within 24 hours and by the nightly cleanup at the latest.
- Verification decision records (no image): up to 24 months for safety and audit.
- Email codes: 10 minutes, then expired; cleaned up in bulk.
- Sessions: until expiry or revocation, then retained briefly for security audit.
- Audit logs: up to 24 months, append-only, never editable.

## 5. Your rights

Under the NDPA you can ask to access, correct, export, restrict or delete your data, and to withdraw consent. In the app:

- **Export:** Settings → About → Export my data (JSON).
- **Correct:** Settings → Profile.
- **Delete:** Settings → Account (30-day grace period).
- **Privacy choices:** Settings → Privacy.

We respond to requests within the timelines required by law. If you believe we have mishandled your data, you can complain to the **Nigeria Data Protection Commission (NDPC)**.

## 6. Security

Passwords use Argon2id. Sessions are stored as hashes in `httpOnly`, `Secure`, `SameSite=Lax` cookies with CSRF protection. All access is authorised server-side and tenant-scoped. Sensitive actions are rate-limited and recorded in an append-only audit log. We never log passwords, ID images or full IP addresses.

## 7. Children

Konnekt is not for anyone under 16. If we learn that a user is under 16, we will close the account and delete the data.

## 8. Changes

We version this policy. A new version is presented before it takes effect for material changes, and your acceptance is recorded.

## 9. Contact

Data protection officer: **privacy@konnekt.ng**.
