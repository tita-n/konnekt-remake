# UI conventions

The refined UI keeps Konnekt's Phase 1 behaviour and data contracts. These
rules are for presentation changes only.

## Boundaries

- UI components must not call Prisma or tenant-scoped services directly. Server
  components receive already-authorized view models; client components use the
  existing `apiGet`/`apiPost`/`apiPatch` helpers.
- Never reimplement audience filtering, block/mute checks, moderation rules or
  role checks in a component.
- Public share previews render one blurred line for `PUBLIC` posts and generic
  copy for everything else. No author, avatar, count, media, campus name or
  fabricated image may appear there.
- Keep `src/lib/security/*`, `src/lib/env.ts`, `src/middleware.ts`,
  `next.config.ts` security headers and `src/lib/db/platform.ts` out of design
  changes.

## Tokens and surfaces

- Colours, radii, shadows and fonts come from `src/styles/tokens.css` and
  `tailwind.config.ts`. Do not hardcode a hex value in a component unless it is
  part of an illustration or a fixed preview swatch.
- University accents arrive through `accentCssVars()` on a subtree. Use
  `bg-accent`/`text-accent-fg` for filled controls, `bg-accent-soft`/
  `text-accent-ink` or `text-accent-soft-fg` for tinted surfaces, and
  `text-accent-ink` for accent-coloured text on the page.
- `--success-solid` is the accessible filled-green token. White text on it must
  clear 4.5:1.
- Paper surfaces use hairline borders and flat cards. Glass is limited to the
  top bar, bottom tab bar and bottom sheets. Use the existing `glass` class and
  keep the solid fallback (`data-glass="solid"`, reduced transparency, Data
  saver) working.
- Use the responsive shell classes rather than new fixed widths. The feed is
  `max-w-feed`; admin consoles use the sidebar on desktop and horizontal
  navigation on mobile.

## Components

- `Chip`: pass sizing classes through `className`; the selected colour is
  applied last so `text-small` cannot override `text-accent-fg`.
- Native form controls must remain the interactive element. Custom radios and
  checkboxes should be transparent overlays on the native input, not
  `sr-only` inputs covered by a label.
- Accessible names must be unique for the field they describe. Poll inputs are
  “Option 1…4”; the auxiliary buttons are “Clear answer 1…4” or
  “Remove answer 1…4”.
- Every icon-only button needs an `aria-label`; decorative icons use
  `aria-hidden="true"`.
- Empty, error and offline states use the shared `EmptyState`/`ErrorState`
  components and the local illustrations in `public/assets/illustrations/`.
- Status changes use `role="status"`; validation failures use `role="alert"`.
- Menus use the existing `BottomSheet`/`MenuItem` primitives. Do not introduce a
  second focus trap or a parallel dialog implementation.

## Accessibility

- Serious and critical axe violations are release blockers. Run
  `npm run test:e2e` before calling a visual change done.
- Body text must be 4.5:1; large text and non-text UI boundaries may use 3:1
  only where WCAG allows it.
- Preserve a visible focus ring (`:focus-visible`), 44 px touch targets on
  primary actions, and the skip link.
- Never encode meaning with colour alone. Pair status colour with text or an
  icon.
- Motion must respect `prefers-reduced-motion`; blur is never animated.
- Dark mode is a first-class theme: check every new token and illustration in
  both themes.

## Assets and content

- Prefer CSS, inline SVG and the clay-avatar/illustration components over
  bitmap assets.
- Seed imagery lives under `public/seed/`. Design review screenshots live under
  `design/review/` and are not runtime assets.
- Use sentence case, plain campus language and the existing account labels.
  Avoid hardcoded student names in shared/public UI unless they come from data.
- The seeded university is Nova University. Keep seed content fictional and
  keep the production seed guard untouched.

## Tests

- Presentation helpers get pure unit tests under `src/**/*.test.ts` or
  `tests/unit/`; both are included by Vitest.
- UI changes that alter a flow need an e2e assertion, not only a screenshot.
- E2E data must be unique per run and cleaned up. Blocks are durable and
  symmetric, so they must be removed through the authenticated API with the
  CSRF header.
- Do not add `.skip`/`.only` or weaken assertions to make a visual check pass.
