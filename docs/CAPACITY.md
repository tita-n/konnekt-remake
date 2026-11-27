# Capacity model (November 2026)

Design target: 5,000 registered students, ~60% monthly active, on mid-range
Android in Lagos. This document is deliberately pessimistic: it exists to show
where the free tiers stop, not to claim they hold.

## Vendor limits (verified 27 November 2026)

| Vendor | Free allowance | Source |
| --- | --- | --- |
| Vercel Hobby | 1,000,000 function invocations, 4 Active CPU hours, 360 GB-hrs provisioned memory per month; **non-commercial use only** | https://vercel.com/docs/plans/hobby , https://vercel.com/docs/functions/usage-and-pricing |
| Neon Free | 100 CU-hours per project per month, 1 GB storage (writes blocked above), 5 GB egress, autoscaling to 2 CU, scale-to-zero after 5 min, compute suspended for the rest of the month at the CU-hour limit | https://neon.com/docs/introduction/plans , https://neon.com/pricing |
| Upstash Redis Free | 500K commands per month (FAQ also states 10,000 requests/day), 250 MB, 10 GB bandwidth | https://upstash.com/docs/redis/overall/billing |
| Cloudinary Free | 25 credits/month; 1 credit = 1,000 transformations **or** 1 GB storage **or** 1 GB image bandwidth | https://cloudinary.com/documentation/billing_and_plans |
| Resend Free | 100 emails/day | https://resend.com/pricing |

## Assumptions

- One **active student-day** = 20 function invocations (the design band is
  15–25, before the caching work lands). 30 days/month.
- Average Active CPU per invocation: 120 ms (warm, simple read). A cold Neon
  wake adds ~300 ms.
- Neon compute: 0.25 CU, awake 10 hours a day with traffic spread; scale-to-zero
  keeps idle periods free, but any request keeps it awake for another 5 minutes.
- Upstash: 6 commands per active student-day (auth, verification, writes only;
  reads never rate-limit).
- Cloudinary: 15 delivered images per active student-day at ~120 KB each.
- Resend: 0.5 emails per registered student per month.

## Monthly usage at 500 / 2,000 / 5,000 registered users (60% active)

| Resource | 500 | 2,000 | 5,000 |
| --- | --- | --- | --- |
| Active students | 300 | 1,200 | 3,000 |
| Vercel invocations | 180K | 720K | **1.8M** |
| Vercel Active CPU (hours) | 6.0 | 24 | **60** |
| Neon CU-hours (0.25 CU × 10 h/day) | 75 | 75 | 75–120 (traffic keeps it awake longer) |
| Upstash commands | 54K | 216K | **540K** |
| Cloudinary bandwidth (GB) | 16.2 | 64.8 | **162** |
| Resend emails/month | 250 | 1,000 | 2,500 (≈83/day) |

Bold = over the free allowance.

## What breaks first

1. **The Vercel Hobby commercial-use rule — immediately at launch.** A real
   student network taking money, ads or sponsorship is commercial and must be
   on Pro ($20/month). This is a terms limit, not a traffic limit.
2. **Vercel invocations at roughly 1,700 monthly active students** (1M ÷ 20 ÷ 30).
   Caching and batching can push this toward 2,500–3,000 but not to 5,000.
3. **Cloudinary bandwidth at roughly 450 monthly active students** at 15
   delivered images/day. Reducing delivered bytes (named widths, `f_auto`,
   browser caching, fewer images per screen) is the only lever; cached CDN hits
   still count as delivered bandwidth.
4. **Neon CU-hours at roughly 2,000–2,800 students** once traffic keeps the
   0.25 CU compute awake most of the day. 100 CU-hours is only 400 hours of a
   0.25 CU compute.
5. **Upstash commands at roughly 2,700 active students** at 6 commands/day, and
   sooner if the limiter is applied to ordinary reads (it must not be).
6. **Resend** is comfortable until roughly 6,000 registered students; bursts
   (a verification campaign) can still hit 100/day.

**Honest conclusion: the free tiers cannot hold 5,000 students.** Vercel Pro is
required for the terms alone; Neon Launch and Cloudinary Plus are required well
before 5,000.

## Upgrade triggers

| Trigger | Action | Current price |
| --- | --- | --- |
| Public launch | Vercel Pro (1 seat) | $20/month including $20 usage credit |
| Neon CU-hours > 70 in a month, or p95 connect latency > 300 ms | Neon Launch | $0.106/CU-hour |
| Upstash commands > 400K/month | Upstash Pay-as-you-go | $0.20 per 100K commands |
| Cloudinary bandwidth > 20 GB/month | Cloudinary Plus | see Cloudinary pricing |
| Resend > 80 emails/day for 3 days | Resend Pro | see Resend pricing |

## Degradation ladder

The app must never become a total outage because a quota ran out.

| Exhausted quota | Behaviour |
| --- | --- |
| Upstash | Auth, verification and upload **fail closed**; ordinary writes fall back to stricter in-process limits; reads continue (they never call Redis). |
| Neon CU-hours | Compute suspends until the billing period. The shell and cached static assets still render; every data request returns a clear 503 from `/api/health`-style handling. No writes are accepted. |
| Vercel invocations / Active CPU | The platform pauses functions. Nothing in-app can degrade this; it must be upgraded or traffic capped. |
| Cloudinary | Images fall back to alt text and reserved aspect boxes; posts, text and navigation keep working. Uploads return a clear error. |
| Resend | Emails stop; in-app notices and the login page explain that email is unavailable. Sessions and reads are unaffected. |

## Where to monitor

- Vercel: Project → Observability → Usage (Functions, Active CPU) and the
  billing page.
- Neon: Console → Project → Usage (CU-hours, storage, egress).
- Upstash: Database → Usage (commands, bandwidth).
- Cloudinary: Console → Settings → Usage (credits by transformation, storage,
  bandwidth).
- Resend: Dashboard → Usage (emails sent).

## Open work that changes this model

- Query-count reduction and shared feed caching (PR4) lower invocations and
  Active CPU; re-measure before choosing the paid tier.
- Named image widths and `f_auto` are in place; the delivered-bandwidth estimate
  still assumes 120 KB per image and needs a real measurement from staging.
