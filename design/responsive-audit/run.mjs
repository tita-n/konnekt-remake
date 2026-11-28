#!/usr/bin/env node
/**
 * Responsive audit — the UI-owned implementation of the audit contract.
 *
 *   node design/responsive-audit/run.mjs \
 *     --base-url <url> --routes design/audit-routes.json \
 *     --widths 320,360,375,390,412,430,600,768,820,1024,1280,1440,1920 \
 *     --themes light,dark --out <dir>
 *
 * Writes `<dir>/summary.json`, `<dir>/summary.md` and
 * `<dir>/shots/<route>-<width>-<theme>.jpg` for every route that has a defect,
 * plus one overview per route group per theme at 390 and 1280.
 *
 * This is deliberately stricter than `scripts/ui-audit-fallback.mjs`, which it
 * replaces when present (the workflow prefers this file). On top of the
 * fallback's seven checks it adds:
 *
 *   touch-spacing         adjacent interactive controls closer than 8px, so a
 *                         44px target that a thumb still grazes is a defect;
 *   fixed-bar-collision   content or controls hidden under a fixed/sticky bar
 *                         (mobile tab bar, sticky action bar) at any width;
 *   layout-shift          cumulative shift during load, CLS > 0.1, attributed
 *                         to the element that moved;
 *   masked-overflow       horizontal overflow the page hides with
 *                         `overflow-x: hidden` on a root instead of fitting it;
 *   missing-label         input/select/textarea without an associated label or
 *                         accessible name (the fallback only checks icon-only
 *                         buttons and links);
 *   clipped-text          wrapped text cut off by overflow, not just nowrap.
 *
 * Accuracy notes, because a loud auditor is worse than a quiet one:
 *
 *   * Colour parsing handles `rgb()`, `hsl()`, `color(srgb|display-p3 …)`,
 *     `lab()`, `oklab()`, `oklch()` and `color-mix()` results. The fallback
 *     understands only `rgb[a]`, so on this app — whose tokens resolve through
 *     `color-mix()` — it compares text against an assumed *white* canvas and
 *     reports 1.14:1 for near-white text in dark mode. Both the canvas colour
 *     and these syntaxes are resolved here, so a contrast row means something.
 *   * The audit runs in ONE page per (role, theme) and walks the widths inside
 *     it, which is why 101 routes × 13 widths × 2 themes fits in the job.
 *   * Everything is measured on the production build with real seeded data;
 *     nothing is stubbed and login is never bypassed (sessions come from
 *     `$UI_AUDIT_AUTH_DIR/<role>.json`).
 *
 * Never edit `design/audit-routes.json` to make a number go down. A route is
 * added to that file only when new presentation code needs covering, and the
 * change is listed in the pull request.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { buildSummaryMarkdown, pageIdFromPath, resultFileNames } from "../../scripts/lib/ui-audit.mjs";

const DEFAULT_WIDTHS = [320, 360, 375, 390, 412, 430, 600, 768, 820, 1024, 1280, 1440, 1920];
const DEFAULT_THEMES = ["light", "dark"];
/** Shots are the expensive artefact: every defective route once per width/theme,
 *  bounded so the results branch stays small. The full defect set is always in summary.json. */
const MAX_DEFECT_SHOTS = Number.parseInt(process.env.UI_AUDIT_MAX_SHOTS ?? "120", 10);
/** Fairness guard: the global budget must not be spent by whichever group happened to
 *  run first, because a reviewer needs to see one screen per group, not thirteen widths
 *  of the landing page. */
const MAX_SHOTS_PER_GROUP_THEME = Number.parseInt(process.env.UI_AUDIT_SHOTS_PER_GROUP ?? "10", 10);
const MAX_OVERVIEW_SHOTS = Number.parseInt(process.env.UI_AUDIT_MAX_OVERVIEWS ?? "40", 10);
const OVERVIEW_WIDTHS = [390, 1280];
/** Per-page reporting caps, per rule. Caps bound output size, never detection:
 *  the cap reached is recorded so a run can tell "12 findings" from "12+ findings". */
const CAPS = {
  "horizontal-overflow": 2,
  "masked-overflow": 2,
  "touch-target": 26,
  "touch-spacing": 6,
  "fixed-bar-collision": 6,
  overlap: 4,
  "clipped-text": 10,
  "image-aspect": 6,
  "accessible-name": 8,
  "missing-label": 8,
  "layout-shift": 3,
  contrast: 12,
};
const MIN_TOUCH = 44;
const MIN_SPACING = 8;
const CLS_LIMIT = 0.1;

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) args[key] = true;
    else {
      args[key] = value;
      index += 1;
    }
  }
  return args;
}

function splitList(value, fallback) {
  if (!value) return fallback;
  return String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function numberList(value, fallback) {
  const list = splitList(value, fallback.map(String))
    .map((entry) => Number.parseInt(entry, 10))
    .filter((entry) => Number.isFinite(entry) && entry > 0);
  return list.length > 0 ? list : fallback;
}

function heightFor(width) {
  if (width <= 430) return 844;
  if (width <= 820) return 1024;
  return 900;
}

function routeUrl(baseUrl, routePath) {
  return new URL(routePath.startsWith("/") ? routePath : `/${routePath}`, baseUrl).toString();
}

function storageStateFor(authDir, role) {
  return path.join(authDir, `${role}.json`);
}

/**
 * Replace `{token}` placeholders using the resolvers block, against the seeded
 * database. When Prisma cannot answer (no engine, or a database that has not
 * been seeded) the routes that need tokens are dropped and reported rather than
 * silently pointed at a made-up id: a fake id audits an error page and looks clean.
 */
async function loadRoutes(routesFile) {
  const config = JSON.parse(await readFile(routesFile, "utf8"));
  const resolvers = Object.entries(config.resolvers ?? {});
  let tokens = {};
  let resolverError = null;
  if (resolvers.length > 0) {
    try {
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      try {
        tokens = await resolveTokens(prisma, resolvers);
      } finally {
        await prisma.$disconnect().catch(() => undefined);
      }
    } catch (error) {
      resolverError = error instanceof Error ? error.message : String(error);
    }
  }

  const routes = [];
  const skipped = [];
  for (const group of config.groups ?? []) {
    for (const route of group.routes ?? []) {
      const entry = { ...route, group: group.id, groupLabel: group.label };
      const needed = [...String(route.path).matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]);
      const missing = needed.filter((name) => tokens[name] === undefined);
      if (missing.length > 0) {
        skipped.push({ route: route.id, path: route.path, reason: `unresolved token: ${missing.join(", ")}` });
        continue;
      }
      entry.path = String(route.path).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) => tokens[name]);
      routes.push(entry);
    }
  }
  return { config, routes, skipped, tokens, resolverError };
}

async function resolveTokens(prisma, resolvers) {
  const out = {};
  for (const [name, spec] of resolvers) {
    let value = null;
    if (spec.kind === "user") {
      const user = await prisma.user.findUnique({ where: { email: spec.email }, select: { id: true, username: true } });
      value = user?.[spec.field] ?? null;
    } else if (spec.kind === "post") {
      const post = await prisma.post.findFirst({
        where: {
          author: { email: spec.authorEmail },
          status: "ACTIVE",
          ...(spec.audienceKind ? { audienceKind: spec.audienceKind } : {}),
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      value = post?.id ?? null;
    } else if (spec.kind === "hashtag") {
      const hashtag = await prisma.hashtag.findFirst({ orderBy: { tag: "asc" }, select: { tag: true } });
      value = hashtag?.[spec.field] ?? null;
    } else if (spec.kind === "community") {
      const community = await prisma.community.findFirst({ where: { name: spec.name, status: "ACTIVE" }, select: { id: true, slug: true } });
      value = community?.[spec.field] ?? null;
    } else if (spec.kind === "community-membership") {
      const user = await prisma.user.findUnique({ where: { email: spec.email }, select: { id: true } });
      const membership = user
        ? await prisma.communityMember.findFirst({
            where: { userId: user.id, role: spec.role, community: { status: "ACTIVE" } },
            orderBy: { joinedAt: "asc" },
            select: { community: { select: { id: true, slug: true } } },
          })
        : null;
      value = membership?.community?.[spec.field] ?? null;
    } else if (spec.kind === "community-not-member") {
      const user = await prisma.user.findUnique({ where: { email: spec.email }, select: { id: true } });
      const community = await prisma.community.findFirst({
        where: {
          privacy: spec.privacy,
          status: "ACTIVE",
          ...(user ? { members: { none: { userId: user.id } } } : {}),
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, slug: true },
      });
      value = community?.[spec.field] ?? null;
    } else if (spec.kind === "event") {
      const event = await prisma.event.findFirst({ where: { title: spec.title }, orderBy: { createdAt: "asc" }, select: { id: true } });
      value = event?.id ?? null;
    } else if (spec.kind === "announcement") {
      const announcement = await prisma.announcement.findFirst({ where: { title: spec.title }, orderBy: { createdAt: "asc" }, select: { id: true } });
      value = announcement?.id ?? null;
    } else if (spec.kind === "report") {
      const report = await prisma.report.findFirst({ where: { status: spec.status }, orderBy: { createdAt: "desc" }, select: { id: true } });
      value = report?.id ?? null;
    } else if (spec.kind === "verification") {
      const request = await prisma.verificationRequest.findFirst({ where: { status: spec.status }, orderBy: { createdAt: "desc" }, select: { id: true } });
      value = request?.id ?? null;
    } else if (spec.kind === "university") {
      const university = await prisma.university.findUnique({ where: { slug: spec.slug }, select: { id: true } });
      value = university?.id ?? null;
    }
    if (value === null || value === undefined) {
      throw new Error(`Could not resolve seeded id "${name}" (${spec.kind}); run npm run db:seed against the audit database.`);
    }
    out[name] = String(value);
  }
  return out;
}

async function runAction(page, action) {
  if (action.type !== "click") return false;
  try {
    let locator;
    if (action.selector) locator = page.locator(action.selector).first();
    else if (action.role) locator = page.getByRole(action.role, action.name ? { name: action.name, exact: action.exact !== false } : undefined).first();
    else if (action.text) locator = page.getByText(action.text, { exact: action.exact !== false }).first();
    if (!locator) return false;
    await locator.waitFor({ state: "visible", timeout: 2500 });
    await locator.click({ timeout: 2500 });
    await page.waitForFunction(() => document.readyState === "complete", { timeout: 2500 }).catch(() => undefined);
    await page.waitForTimeout(160);
    return true;
  } catch {
    return false;
  }
}

/** Installed before every navigation so layout shifts are captured as they happen. */
const SHIFT_OBSERVER = function installShiftObserver() {
  window.__uiAuditShift = { score: 0, entries: [] };
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        window.__uiAuditShift.score += entry.value;
        const sources = (entry.sources ?? []).slice(0, 3).map((source) => ({
          value: entry.value,
          node: source.node?.nodeName ?? null,
          className: typeof source.node?.className === "string" ? source.node.className.slice(0, 80) : null,
          id: source.node?.id ?? null,
        }));
        window.__uiAuditShift.entries.push({ value: entry.value, sources });
      }
    });
    observer.observe({ type: "layout-shift", buffered: true });
  } catch {
    /* PerformanceObserver without layout-shift support: shifts are simply not scored. */
  }
};

/**
 * One pass over the document. Returns { defects, caps, metrics } — `caps` records
 * which rules hit their per-page reporting limit so a reader can tell a short list
 * from a truncated one.
 */
const AUDIT = function auditPage(options) {
  const caps = options.caps;
  const minTouch = options.minTouch;
  const minSpacing = options.minSpacing;
  const clsLimit = options.clsLimit;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const defects = [];
  const seen = new Map();
  const used = new Map();
  const capped = new Set();

  const cssEscape = (value) => (window.CSS?.escape ? window.CSS.escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&"));

  function selectorFor(element) {
    if (!element || element.nodeType !== 1) return "document";
    if (element.id) return `#${cssEscape(element.id)}`;
    const testId = element.getAttribute("data-testid");
    if (testId) return `[data-testid="${cssEscape(testId)}"]`;
    const parts = [];
    let node = element;
    let depth = 0;
    while (node && node.nodeType === 1 && depth < 5) {
      let part = node.tagName.toLowerCase();
      const role = node.getAttribute("role");
      if (role) part += `[role="${role}"]`;
      const parent = node.parentElement;
      if (parent) {
        const same = [...parent.children].filter((sibling) => sibling.tagName === node.tagName);
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      if (node === document.body) break;
      node = parent;
      depth += 1;
    }
    return parts.join(" > ");
  }

  function push(rule, element, value, severity, extra = {}) {
    const usedCount = used.get(rule) ?? 0;
    const cap = caps[rule] ?? 8;
    const key = `${rule}|${selectorFor(element)}|${value}`;
    if (seen.has(key)) {
      seen.get(key).count += 1;
      return;
    }
    if (usedCount >= cap) {
      capped.add(rule);
      return;
    }
    used.set(rule, usedCount + 1);
    // A class hint inside the value turns "some <a> is small" into the utility that
    // needs changing, which is what makes the sticky comment actionable.
    const hint =
      typeof element.className === "string" && element.className.trim()
        ? ` · ${element.className.trim().split(/\s+/).filter((token) => !/^(group|peer|shrink|flex-1|min-w-0|w-full)$/.test(token)).slice(0, 4).join(" ")}`
        : "";
    const record = { rule, selector: selectorFor(element), value: `${value}${hint}`, severity, count: 1 };
    if (extra.text) record.text = String(extra.text).slice(0, 140);
    if (extra.measured !== undefined) record.measured = extra.measured;
    if (extra.spacing !== undefined) record.spacing = extra.measured;
    seen.set(key, record);
    defects.push(record);
  }

  const styleCache = new Map();
  function styleOf(element) {
    let value = styleCache.get(element);
    if (!value) {
      value = getComputedStyle(element);
      styleCache.set(element, value);
    }
    return value;
  }

  function isVisible(element) {
    const style = styleOf(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    if (element.closest("[aria-hidden='true']")) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0.5 || rect.height <= 0.5) return false;
    if (rect.bottom < 0 || rect.top > viewportHeight * 3 + viewportHeight || rect.right < -50) return false;
    return true;
  }

  function inHorizontalScroller(element) {
    let node = element.parentElement;
    while (node && node !== document.body) {
      const style = styleOf(node);
      if ((style.overflowX === "auto" || style.overflowX === "scroll") && node.scrollWidth > node.clientWidth + 1) return true;
      node = node.parentElement;
    }
    return false;
  }

  // ---------- colour ----------
  function parseColor(value) {
    const text = String(value ?? "").trim();
    if (!text || text === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    let match = text.match(/^rgba?\(([^)]+)\)$/);
    if (match) {
      const parts = match[1].split(/[ ,/]+/).filter(Boolean);
      if (parts.length >= 3) {
        const [r, g, b] = parts.slice(0, 3).map((part) => (part.endsWith("%") ? (parseFloat(part) / 100) * 255 : parseFloat(part)));
        return { r, g, b, a: parts.length > 3 ? alphaValue(parts[3]) : 1 };
      }
    }
    match = text.match(/^hsla?\(([^)]+)\)$/);
    if (match) {
      const parts = match[1].split(/[ ,/]+/).filter(Boolean);
      const [r, g, b] = hslToRgb(parseFloat(parts[0]), pct(parts[1]), pct(parts[2]));
      return { r, g, b, a: parts.length > 3 ? alphaValue(parts[3]) : 1 };
    }
    match = text.match(/^color\(\s*(srgb|srgb-linear|display-p3|a98-rgb|prophoto-rgb|rec2020|xyz)\s+([^)]+)\)$/i);
    if (match) {
      const parts = match[2].split(/[ ,/]+/).filter(Boolean);
      const scale = parts.length > 3 && (parts[3].endsWith("%") || parts[3].startsWith("/")) ? alphaValue(parts[3].replace("/", "")) : 1;
      const channels = parts.slice(0, 3).map((part) => (part.endsWith("%") ? parseFloat(part) / 100 : parseFloat(part)));
      const space = match[1].toLowerCase();
      let [r, g, b] = channels;
      if (space === "srgb-linear") [r, g, b] = [r, g, b].map(linearToSrgb);
      if (space === "display-p3" || space === "a98-rgb" || space === "prophoto-rgb" || space === "rec2020") {
        // Wide-gamut colours are compared as their sRGB clip. The differences are
        // a few points of luminance, far smaller than any real AA failure.
        [r, g, b] = [r, g, b];
      }
      return { r: r * 255, g: g * 255, b: b * 255, a: scale };
    }
    match = text.match(/^oklab\(\s*([^)]+)\)$/);
    if (match) return oklabToRgb(match[1]);
    match = text.match(/^oklch\(\s*([^)]+)\)$/);
    if (match) return oklchToRgb(match[1]);
    match = text.match(/^lab\(\s*([^)]+)\)$/);
    if (match) return labToRgb(match[1]);
    return null;
  }

  function alphaValue(part) {
    if (part === undefined) return 1;
    if (String(part).endsWith("%")) return parseFloat(part) / 100;
    const value = Number.parseFloat(part);
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
  }

  function pct(part) {
    const value = parseFloat(String(part));
    return String(part).includes("%") ? value / 100 : value;
  }

  function linearToSrgb(value) {
    return value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
  }

  function hslToRgb(h, s, l) {
    const hue = ((h % 360) + 360) % 360 / 360;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const channel = (offset) => {
      let t = hue + offset;
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [channel(1 / 3) * 255, channel(0) * 255, channel(-1 / 3) * 255];
  }

  function channelValue(part) {
    return String(part).includes("%") ? parseFloat(part) / 100 : parseFloat(part);
  }

  function oklabToRgb(raw) {
    const parts = String(raw).split(/[ ,/]+/).filter(Boolean);
    const L = pct(parts[0]);
    const a = parts[1] !== undefined ? channelValue(parts[1]) : 0;
    const b = parts[2] !== undefined ? channelValue(parts[2]) : 0;
    const alpha = parts[3] !== undefined ? alphaValue(parts[3]) : 1;
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ ** 3;
    const m = m_ ** 3;
    const s = s_ ** 3;
    let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    let b2 = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    r = linearToSrgb(Math.min(1, Math.max(0, r)));
    g = linearToSrgb(Math.min(1, Math.max(0, g)));
    b2 = linearToSrgb(Math.min(1, Math.max(0, b2)));
    return { r: r * 255, g: g * 255, b: b2 * 255, a: alpha };
  }

  function oklchToRgb(raw) {
    const parts = String(raw).split(/[ ,/]+/).filter(Boolean);
    const L = pct(parts[0]);
    const C = parts[1] ? parseFloat(parts[1]) : 0;
    let H = parts[2] ? parseFloat(parts[2]) : 0;
    if (String(parts[2] ?? "").includes("deg") || String(parts[2] ?? "").includes("rad")) {
      H = String(parts[2]).includes("rad") ? (parseFloat(parts[2]) * 180) / Math.PI : parseFloat(parts[2]);
    }
    const radians = (H * Math.PI) / 180;
    return oklabToRgb(`${L} ${Math.cos(radians) * C} ${Math.sin(radians) * C}${parts[3] !== undefined ? ` / ${parts[3]}` : ""}`);
  }

  function labToRgb(raw) {
    const parts = String(raw).split(/[ ,/]+/).filter(Boolean);
    const L = parseFloat(parts[0]);
    const a = parts[1] ? parseFloat(parts[1]) : 0;
    const b = parts[2] ? parseFloat(parts[2]) : 0;
    const fy = (L + 16) / 116;
    const fx = fy + a / 500;
    const fz = fy - b / 200;
    const finv = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
    const X = finv(fx) * 95.047;
    const Y = finv(fy) * 100;
    const Z = finv(fz) * 108.883;
    let r = (X / 95.047) * 3.2406 + (Y / 100) * -1.5372 + (Z / 108.883) * -0.4986;
    let g = (X / 95.047) * -0.9689 + (Y / 100) * 1.8758 + (Z / 108.883) * 0.0415;
    let b2 = (X / 95.047) * 0.0557 + (Y / 100) * -0.204 + (Z / 108.883) * 1.057;
    const gamma = (value) => (value <= 0.0031308 ? value * 12.92 : 1.055 * Math.abs(value) ** (1 / 2.4) - 0.055);
    return { r: gamma(Math.min(1, Math.max(0, r))) * 255, g: gamma(Math.min(1, Math.max(0, g))) * 255, b: gamma(Math.min(1, Math.max(0, b2))) * 255, a: parts[3] !== undefined ? alphaValue(parts[3]) : 1 };
  }

  function composite(foreground, background) {
    const alpha = foreground.a + background.a * (1 - foreground.a);
    if (alpha <= 0) return { r: 0, g: 0, b: 0, a: 1 };
    return {
      r: (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha,
      g: (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha,
      b: (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha,
      a: alpha,
    };
  }

  // The page canvas, resolved once: this app paints its background on <body>
  // through a token, so an element with no painted ancestor must compare
  // against that colour rather than an assumed white.
  const canvas = (() => {
    for (const node of [document.body, document.documentElement]) {
      if (!node) continue;
      const style = getComputedStyle(node);
      const colour = parseColor(style.backgroundColor);
      if (colour && colour.a > 0.999) return colour;
      if (style.backgroundImage && style.backgroundImage !== "none") {
        const gradient = style.backgroundImage.match(/(?:from|to|via)\s+(rgb|color|oklab|oklch|lab|hsl)[^,)]*/);
        if (gradient) {
          const partial = parseColor(gradient[0].replace(/^(?:from|to|via)\s+/, ""));
          if (partial) return partial;
        }
      }
    }
    return prefersDark() ? { r: 15, g: 17, b: 21, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
  })();

  function prefersDark() {
    const theme = document.documentElement.dataset.theme;
    if (theme) return theme === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  }

  function backgroundFor(element) {
    let node = element;
    const layers = [];
    while (node && node.nodeType === 1) {
      const style = styleOf(node);
      if (style.backgroundImage && style.backgroundImage !== "none" && !layers.length) {
        // A gradient or image behind text cannot be reduced to a single colour, so
        // the solid colour *underneath* it is the fair comparison; painted bands
        // still get measured instead of being skipped, which is where real failures
        // hide. If nothing solid exists, the page canvas is the answer.
        let ancestor = node.parentElement;
        while (ancestor && ancestor.nodeType === 1) {
          const above = parseColor(styleOf(ancestor).backgroundColor);
          if (above && above.a > 0.999) return above;
          ancestor = ancestor.parentElement;
        }
        return canvas;
      }
      const colour = parseColor(style.backgroundColor);
      if (colour && colour.a > 0) {
        layers.push(colour);
        if (colour.a >= 0.999) break;
      }
      node = node.parentElement;
    }
    let result = canvas;
    for (let index = layers.length - 1; index >= 0; index -= 1) result = composite(layers[index], result);
    return result;
  }

  function luminance(colour) {
    const channel = (value) => {
      const normalised = value / 255;
      return normalised <= 0.03928 ? normalised / 12.92 : ((normalised + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(colour.r) + 0.7152 * channel(colour.g) + 0.0722 * channel(colour.b);
  }

  function contrastRatio(a, b) {
    const first = luminance(a);
    const second = luminance(b);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  }

  // ---------- element sets ----------
  const body = document.body ?? document.documentElement;
  const all = [...body.querySelectorAll("*")];
  const interactiveSelector = "a[href], button, input:not([type='hidden']), select, textarea, summary, [role='button'], [role='tab'], [role='link'], [role='checkbox'], [role='radio'], [role='switch'], [role='menuitem'], [role='option']";
  const interactives = all.filter((element) => element.matches?.(interactiveSelector)).filter((element) => isVisible(element) && !element.disabled && element.getAttribute("aria-disabled") !== "true");

  // ---------- horizontal overflow (and overflow a root hides instead of fixing) ----------
  const rootStyle = styleOf(document.documentElement);
  const bodyStyle = styleOf(body);
  const masking = (rootStyle.overflowX === "hidden" || bodyStyle.overflowX === "hidden") && body.scrollWidth > viewportWidth + 1;
  const overflowing = document.documentElement.scrollWidth > viewportWidth + 1;
  if (overflowing || masking) {
    let offender = document.documentElement;
    let widest = viewportWidth;
    for (const element of all) {
      if (!isVisible(element) || inHorizontalScroller(element)) continue;
      const rect = element.getBoundingClientRect();
      const right = rect.right + window.scrollX;
      if (right > widest + 1) {
        widest = right;
        offender = element;
      }
    }
    const width = Math.round(Math.max(document.documentElement.scrollWidth, widest));
    if (overflowing) {
      push(
        "horizontal-overflow",
        offender,
        `document ${document.documentElement.scrollWidth}px vs viewport ${viewportWidth}px; widest edge ${width}px`,
        "high",
        { measured: width - viewportWidth },
      );
    } else {
      push(
        "masked-overflow",
        offender,
        `content is ${width}px wide at a ${viewportWidth}px viewport and overflow-x:hidden hides the difference`,
        "high",
        { measured: width - viewportWidth },
      );
    }
  }

  // ---------- touch targets, then spacing between them ----------
  for (const element of interactives) {
    const rect = element.getBoundingClientRect();
    const tag = element.tagName.toLowerCase();
    const type = (element.getAttribute("type") || "").toLowerCase();
    const style = styleOf(element);
    if (tag === "input" && (type === "checkbox" || type === "radio")) {
      // The control itself is 13px by design; the hit target is the label row.
      const row = element.closest("label") ?? element.parentElement;
      const rowRect = row ? row.getBoundingClientRect() : rect;
      if (rowRect.height + 0.5 < minTouch || rowRect.width + 0.5 < minTouch) {
        push(
          "touch-target",
          row ?? element,
          `${Math.round(rowRect.width)}×${Math.round(rowRect.height)} px label row for a ${Math.round(rect.width)}×${Math.round(rect.height)} checkbox, needs at least ${minTouch}×${minTouch}`,
          "medium",
          { measured: Math.round(Math.min(rowRect.width, rowRect.height)) },
        );
      }
      continue;
    }
    // Inline text links inside a paragraph are not touch targets; links styled as
    // buttons, in navs or in toolbars are.
    if (
      tag === "a" &&
      style.display === "inline" &&
      style.backgroundColor === "rgba(0, 0, 0, 0)" &&
      style.borderTopWidth === "0px" &&
      !element.querySelector("svg,img,button") &&
      !element.closest("nav,header,[role='tablist'],[role='toolbar'],.action-bar")
    ) {
      continue;
    }
    // A 1×1 or clipped input behind a styled control (file pickers, sr-only
    // radios) is an implementation detail: it is measured by missing-label instead.
    if (tag === "input" && (rect.width <= 4 || rect.height <= 4)) continue;
    if (style.clipPath && style.clipPath !== "none" && style.clipPath.includes("inset(50%")) continue;
    if (style.position === "absolute" && (rect.width < 4 || rect.height < 4)) continue;
    if (style.display === "inline" && rect.height < minTouch && tag !== "a" && tag !== "button") continue;
    if (rect.width + 0.5 < minTouch || rect.height + 0.5 < minTouch) {
      push(
        "touch-target",
        element,
        `${Math.round(rect.width)}×${Math.round(rect.height)} px, needs at least ${minTouch}×${minTouch}`,
        "high",
        { measured: Math.round(Math.min(rect.width, rect.height)) },
      );
    }
  }

  // Adjacent controls need a gap, not just a size: two 44px targets that touch are
  // one mistap. Measured between the rects of controls that share a row or column
  // and are not nested inside the same composite control.
  const boxes = interactives
    .map((element) => ({ element, rect: element.getBoundingClientRect() }))
    .filter((entry) => entry.rect.width > 1 && entry.rect.height > 1)
    .filter((entry) => !["text", "search", "email", "password", "number", "tel", "url"].includes((entry.element.getAttribute("type") ?? entry.element.tagName).toLowerCase()));
  const spacingPairs = new Set();
  for (let left = 0; left < boxes.length; left += 1) {
    const a = boxes[left];
    if ((used.get("touch-spacing") ?? 0) >= (caps["touch-spacing"] ?? 6)) break;
    for (let right = left + 1; right < boxes.length; right += 1) {
      const b = boxes[right];
      if (b.rect.left > a.rect.right + minSpacing * 2) break;
      if (a.element.contains(b.element) || b.element.contains(a.element)) continue;
      const sharedParent = a.element.parentElement && a.element.parentElement === b.element.parentElement;
      const parentInteractive = a.element.parentElement?.closest(interactiveSelector);
      if (parentInteractive && parentInteractive === b.element.parentElement?.closest(interactiveSelector)) continue;
      const horizontalGap = Math.max(0, Math.max(b.rect.left - a.rect.right, a.rect.left - b.rect.right));
      const rowsAligned = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top) > Math.min(a.rect.height, b.rect.height) * 0.6;
      // Side-by-side neighbours only: stacked rows in a nav list are separated by
      // the row height itself, so a 4px gutter there is density, not a mistap.
      if (!(rowsAligned && horizontalGap > 0.4 && horizontalGap < minSpacing)) continue;
      // Text links inside a paragraph are not touch targets and no spacing rule
      // can fix them without breaking typography.
      const inlineText = (entry) => {
        const entryStyle = styleOf(entry.element);
        return entry.element.tagName === "A" && entryStyle.display === "inline" && !entry.element.querySelector("svg,img");
      };
      if (inlineText(a) && inlineText(b)) continue;
      // And only when one of the pair is already under the target floor: two 44px
      // buttons 6px apart is a design choice a reviewer can keep.
      const smallControl = Math.min(a.rect.width, a.rect.height, b.rect.width, b.rect.height) < minTouch;
      if (!smallControl) continue;
      const pairKey = sharedParent ? `${selectorFor(a.element.parentElement)}|cluster` : `${selectorFor(a.element)}|${selectorFor(b.element)}`;
      if (spacingPairs.has(pairKey)) continue;
      spacingPairs.add(pairKey);
      push(
        "touch-spacing",
        a.element.parentElement ?? a.element,
        `${Math.round(horizontalGap)}px between ${selectorFor(a.element)} and ${selectorFor(b.element)}, needs at least ${minSpacing}px`,
        "medium",
        { measured: Math.round(horizontalGap) },
      );
      if ((used.get("touch-spacing") ?? 0) >= (caps["touch-spacing"] ?? 6)) break;
    }
  }

  // ---------- fixed / sticky bars ----------
  const bars = [];
  for (const element of all) {
    const style = styleOf(element);
    if (style.position !== "fixed" && style.position !== "sticky") continue;
    if (!isVisible(element)) continue;
    const rect = element.getBoundingClientRect();
    // A `position: sticky` element taller than ~96px is a sticky *wrapper* (the pulse
    // feed, a sidebar) rather than a bar: its rect spans content that scrolls freely,
    // so measuring it as a bar claimed the bottom nav overlaps the whole feed. Only a
    // short strip pinned against an edge counts.
    const pinned = style.position === "fixed" || (rect.height <= 96 && (rect.top <= 4 || rect.bottom >= viewportHeight - 4));
    if (!pinned) continue;
    if (rect.width < viewportWidth * 0.35 || rect.height < 8 || rect.height > viewportHeight * 0.4) continue;
    const colour = parseColor(style.backgroundColor);
    const painted = (colour && colour.a > 0.2) || (style.backgroundImage && style.backgroundImage !== "none") || style.backdropFilter !== "none";
    if (!painted) continue;
    bars.push({ element, rect, fixed: style.position === "fixed", top: rect.top <= 4, bottom: rect.bottom >= viewportHeight - 4 });
  }

  // Two bars landing on each other.
  for (let left = 0; left < bars.length; left += 1) {
    for (let right = left + 1; right < bars.length; right += 1) {
      const a = bars[left];
      const b = bars[right];
      if (a.element.contains(b.element) || b.element.contains(a.element)) continue;
      const width = Math.max(0, Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left));
      const height = Math.max(0, Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top));
      if (height <= 4) continue; // an abutting border is not a collision
      if (width * height < 400) continue;
      push(
        "overlap",
        a.element,
        `fixed bar overlaps ${selectorFor(b.element)} by ${Math.round(height)}px of height`,
        "high",
        { measured: Math.round(height) },
      );
    }
  }

  // A bar sitting on top of controls or text that the page has not padded away.
  // Only a `position: fixed` bar actually hides content: a sticky one is in flow
  // and moves out of the way. Measured at the bottom of the scroll, because that is
  // the only place a control can be permanently stuck: at scroll 0 the rows under
  // the nav are merely further down the page, which is what a bottom bar is for.
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - viewportHeight);
  if (maxScroll > 0) {
    window.scrollTo(0, maxScroll);
    for (const bar of bars) bar.rect = bar.element.getBoundingClientRect();
  }
  for (const bar of bars) {
    if (!bar.fixed) continue;
    if (!bar.top && !bar.bottom) continue;
    if ((used.get("fixed-bar-collision") ?? 0) >= (caps["fixed-bar-collision"] ?? 6)) break;
    for (const element of interactives) {
      if (bar.element.contains(element) || element.contains(bar.element)) continue;
      const rect = element.getBoundingClientRect();
      const centreY = rect.top + rect.height / 2;
      const centreX = rect.left + rect.width / 2;
      if (centreY < 0 || centreY > viewportHeight) continue;
      if (bar.bottom && centreY < bar.rect.top) continue; // scrolled clear of the bar
      const covered = centreY > bar.rect.top + 1 && centreY < bar.rect.bottom - 1 && centreX > bar.rect.left && centreX < bar.rect.right;
      if (!covered) continue;
      push(
        "fixed-bar-collision",
        element,
        `control centre ${Math.round(centreY)}px is under the ${bar.bottom ? "bottom" : "top"} ${bar.element.tagName.toLowerCase()} bar (${Math.round(bar.rect.top)}–${Math.round(bar.rect.bottom)}px)`,
        "high",
        { measured: Math.round(bar.bottom ? bar.rect.bottom - rect.bottom : rect.top - bar.rect.top) },
      );
      break;
    }
  }

  // ---------- clipped text ----------
  for (const element of all) {
    if ((used.get("clipped-text") ?? 0) >= (caps["clipped-text"] ?? 10)) break;
    if (!isVisible(element) || !element.textContent?.trim()) continue;
    if (element.children.length > 0 && element.tagName !== "LEGEND") continue;
    if (element.closest("select, option, [aria-hidden='true'], .sr-only")) continue;
    const style = styleOf(element);
    const clippedX = (style.overflowX === "hidden" || style.overflowX === "clip") && element.scrollWidth > element.clientWidth + 4;
    const clamped = style.webkitLineClamp && style.webkitLineClamp !== "none";
    const clippedY = !clamped && (style.overflowY === "hidden" || style.overflowY === "clip") && element.scrollHeight > element.clientHeight + 4;
    if (!clippedX && !clippedY) continue;
    if (clippedX && style.whiteSpace !== "nowrap" && style.whiteSpace !== "pre") continue;
    // Single-line ellipsis is an accepted pattern in dense rows — but only when the
    // full string is still reachable (a title attribute, or the row being a link to
    // the page that shows it). Ellipsis with no fallback loses information, so it is
    // reported as its own rule rather than being excused.
    if (clippedX && style.textOverflow === "ellipsis") {
      const row = element.closest("a,button,[role='button'],article,li");
      const hasTitle = element.hasAttribute("title") || element.getAttribute("aria-label");
      const linkedRow = row && (row.tagName === "A" || row.tagName === "BUTTON" || row.getAttribute("role") === "link");
      if (hasTitle || linkedRow) continue;
      push(
        "clipped-text",
        element,
        `ellipsis hides ${element.scrollWidth - element.clientWidth}px of ${element.scrollWidth}px and nothing exposes the full text (add a title, or make the row a link)`,
        "medium",
        { text: element.textContent.trim() },
      );
      continue;
    }
    push(
      "clipped-text",
      element,
      clippedX ? `${element.clientWidth}px visible of ${element.scrollWidth}px` : `${element.clientHeight}px visible of ${element.scrollHeight}px tall`,
      "medium",
      { text: element.textContent.trim() },
    );
  }

  // ---------- images without a reserved box ----------
  for (const image of document.images) {
    if ((used.get("image-aspect") ?? 0) >= (caps["image-aspect"] ?? 6)) break;
    if (!isVisible(image) || image.naturalWidth === 0) continue;
    const style = styleOf(image);
    const hasAttributes = image.hasAttribute("width") && image.hasAttribute("height");
    const hasAspect = style.aspectRatio && style.aspectRatio !== "auto";
    const parentReserves = image.parentElement?.parentElement ? styleOf(image.parentElement).aspectRatio !== "auto" : false;
    if (!hasAttributes && !hasAspect && !parentReserves) {
      push("image-aspect", image, `${image.naturalWidth}×${image.naturalHeight} natural, no width/height or aspect-ratio box`, "low");
    }
  }

  // ---------- accessible names ----------
  for (const element of all) {
    if (!element.matches?.("button, a[href], [role='button'], [role='link'], [role='tab']")) continue;
    if ((used.get("accessible-name") ?? 0) >= (caps["accessible-name"] ?? 8)) break;
    if (!isVisible(element)) continue;
    const labelledBy = element.getAttribute("aria-labelledby");
    const labelText = labelledBy
      ? labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" ")
          .trim()
      : "";
    const name =
      (element.getAttribute("aria-label") || "").trim() ||
      labelText ||
      (element.getAttribute("title") || "").trim() ||
      (element.textContent || "").trim() ||
      [...element.querySelectorAll("img[alt]")]
        .map((image) => image.getAttribute("alt"))
        .join(" ")
        .trim();
    // A `tabIndex={-1}` duplicate — the cover link inside a card whose title link is the
    // real target — is deliberately unnamed: it is not in the tab order, and labelling it
    // would read the same text twice. Only focusable icon-only controls are a defect.
    if (element.getAttribute("tabindex") === "-1" && !element.matches("[role='tab'],[role='button']")) continue;
    if (element.querySelector("svg,img,i,use") && !name) {
      push("accessible-name", element, "icon-only control has no accessible name", "high");
    }
  }

  for (const element of all) {
    if (!element.matches?.("input:not([type='hidden']), select, textarea")) continue;
    if ((used.get("missing-label") ?? 0) >= (caps["missing-label"] ?? 8)) break;
    if (!isVisible(element)) continue;
    if (element.getAttribute("aria-hidden") === "true") continue;
    if (element.closest("label")) continue;
    const id = element.id;
    const associated = id ? document.querySelector(`label[for="${cssEscape(id)}"]`) : null;
    const name =
      (element.getAttribute("aria-label") || "").trim() ||
      (element.getAttribute("title") || "").trim() ||
      (associated?.textContent || "").trim() ||
      (element.getAttribute("aria-labelledby") || "")
        .split(/\s+/)
        .map((reference) => document.getElementById(reference)?.textContent ?? "")
        .join(" ")
        .trim();
    if (!name) {
      push("missing-label", element, `${element.tagName.toLowerCase()}${element.type ? `[type=${element.type}]` : ""} has no label or accessible name`, "high");
    }
  }

  // ---------- contrast ----------
  for (const element of all) {
    if ((used.get("contrast") ?? 0) >= (caps["contrast"] ?? 12)) break;
    if (!isVisible(element)) continue;
    const directText = [...element.childNodes]
      .filter((node) => node.nodeType === 3)
      .map((node) => node.textContent?.trim() ?? "")
      .join(" ")
      .trim();
    if (directText.length < 2) continue;
    if (element.closest("select, option, [aria-hidden='true'], .sr-only")) continue;
    const style = styleOf(element);
    const foreground = parseColor(style.color);
    if (!foreground) continue;
    const background = backgroundFor(element);
    const solid = foreground.a < 1 ? composite(foreground, background) : foreground;
    const size = Number.parseFloat(style.fontSize);
    const bold = Number.parseInt(style.fontWeight, 10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const minimum = large ? 3 : 4.5;
    const ratio = contrastRatio(solid, background);
    if (ratio + 0.05 < minimum) {
      push(
        "contrast",
        element,
        `${ratio.toFixed(2)}:1 on ${background.r | 0},${background.g | 0},${background.b | 0} — needs ${minimum}:1`,
        "high",
        { text: directText, measured: Number(ratio.toFixed(2)) },
      );
    }
  }

  // ---------- layout shift ----------
  const shift = window.__uiAuditShift ?? { score: 0, entries: [] };
  if (shift.score > clsLimit) {
    const worst = [...shift.entries].sort((a, b) => b.value - a.value)[0];
    const source = worst?.sources?.[0];
    const element = source?.id ? document.getElementById(source.id) : null;
    push(
      "layout-shift",
      element ?? body,
      `CLS ${shift.score.toFixed(3)} during load, largest ${worst?.value?.toFixed(3) ?? "?"} from ${source?.node ?? "unknown"}${source?.className ? `.${String(source.className).split(" ")[0]}` : ""}`,
      "medium",
      { measured: Number(shift.score.toFixed(3)) },
    );
  }

  if (maxScroll > 0) window.scrollTo(0, 0);

  return {
    defects,
    capped: [...capped],
    metrics: {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: viewportWidth,
      shiftScore: Number(shift.score.toFixed(4)),
      interactive: interactives.length,
      bars: bars.length,
    },
  };
};

async function captureJpeg(page, outputPath) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const png = await page.screenshot({ type: "png", fullPage: false, animations: "disabled" });
  await sharp(png).resize({ width: 800, withoutEnlargement: true }).jpeg({ quality: 70, mozjpeg: true }).toFile(outputPath);
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = args["base-url"];
  if (!baseUrl) throw new Error("--base-url is required");
  const routesFile = path.resolve(args.routes ?? "design/audit-routes.json");
  const widths = numberList(args.widths, DEFAULT_WIDTHS);
  const themes = splitList(args.themes, DEFAULT_THEMES);
  const outDir = path.resolve(args.out ?? ".ui-audit");
  const authDir = path.resolve(args["auth-dir"] ?? process.env.UI_AUDIT_AUTH_DIR ?? path.join(outDir, "auth"));
  const shotsDir = path.join(outDir, "shots");
  const concurrency = Math.max(1, Number.parseInt(process.env.UI_AUDIT_CONCURRENCY ?? "5", 10));
  await mkdir(shotsDir, { recursive: true });

  const startedAt = Date.now();
  const { config, routes, skipped, tokens, resolverError } = await loadRoutes(routesFile);
  const groups = (config.groups ?? []).map((group) => ({ id: group.id, label: group.label }));
  if (routes.length === 0) throw new Error(`No audit routes could be resolved from ${routesFile}${resolverError ? ` (${resolverError})` : ""}`);

  const roles = [...new Set(routes.map((route) => route.role ?? "anonymous"))];
  const missingStates = roles.filter((role) => role !== "anonymous" && !existsSync(storageStateFor(authDir, role)));
  if (missingStates.length > 0) throw new Error(`Missing auth state for roles: ${missingStates.join(", ")} (looked in ${authDir})`);

  const defects = [];
  const routeErrors = [];
  const cappedNotes = new Map();
  const screenshots = [];
  let defectShotCount = 0;
  let overviewShotCount = 0;
  let routeStates = 0;
  const overviewDone = new Set();
  const shotKeys = new Set();
  const shotsByGroup = new Map();

  // Same escape hatch as scripts/shots.mjs, so the audit can run against a system
  // Chromium where Playwright's own download is unavailable.
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  // One worker per (theme, width band): a page is kept for the whole run so the
  // only per-route cost is the navigation itself.
  const CHUNK = Math.max(2, Number.parseInt(process.env.UI_AUDIT_CHUNK ?? "6", 10));
  const tasks = [];
  // Chunk first, theme second: lanes then alternate light and dark, so the shot
  // budget and the defect list cover both themes instead of exhausting the run on one.
  for (const role of roles) {
    const forRole = routes.filter((route) => (route.role ?? "anonymous") === role);
    for (let index = 0; index < forRole.length; index += CHUNK) {
      const chunk = forRole.slice(index, index + CHUNK);
      for (const theme of themes) tasks.push({ theme, role, routes: chunk });
    }
  }

  async function worker(task) {
    if (task.routes.length === 0) return;
    const context = await browser.newContext({
      viewport: { width: widths[0], height: heightFor(widths[0]) },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
      ...(task.role === "anonymous" ? {} : { storageState: storageStateFor(authDir, task.role) }),
    });
    await context.addInitScript((value) => {
      try {
        window.localStorage.setItem("konnekt.theme", value);
      } catch {}
    }, task.theme);
    await context.addInitScript(SHIFT_OBSERVER);
    const page = await context.newPage();
    await page.emulateMedia({ colorScheme: task.theme });
    try {
      for (const width of widths) {
        await page.setViewportSize({ width, height: heightFor(width) });
        let comboShots = 0;
        for (const route of task.routes) {
          const shotName = resultFileNames(route.id, width, task.theme).screenshot;
          try {
            const response = await page.goto(routeUrl(baseUrl, route.path), { waitUntil: "domcontentloaded", timeout: 25_000 });
            const status = response?.status() ?? null;
            await page.waitForFunction(() => document.styleSheets.length > 0 && document.readyState !== "loading", null, { timeout: 4000 }).catch(() => undefined);
            await page.waitForTimeout(60);
            await page.evaluate(() => {
              document.documentElement.dataset.theme = window.localStorage.getItem("konnekt.theme") || document.documentElement.dataset.theme;
            });
            for (const action of route.actions ?? []) {
              const clicked = await runAction(page, action);
              if (!clicked) {
                routeErrors.push({ route: route.id, path: route.path, width, theme: task.theme, message: `action not found: ${action.name ?? action.selector ?? action.text}` });
              }
            }
            await page.waitForTimeout(80);
            routeStates += 1;

            const finalPath = new URL(page.url()).pathname;
            if (task.role !== "anonymous" && finalPath.startsWith("/login")) {
              routeErrors.push({ route: route.id, path: route.path, width, theme: task.theme, message: "redirected to login" });
            }
            if (status && status >= 500) {
              routeErrors.push({ route: route.id, path: route.path, width, theme: task.theme, message: `HTTP ${status}` });
            } else if (status && status >= 400 && route.id !== "not-found" && status !== route.expectedStatus) {
              routeErrors.push({ route: route.id, path: route.path, width, theme: task.theme, message: `HTTP ${status}` });
            }

            const found = await page.evaluate(AUDIT, { caps: CAPS, minTouch: MIN_TOUCH, minSpacing: MIN_SPACING, clsLimit: CLS_LIMIT });
            const rows = found.defects ?? [];
            for (const item of rows) {
              defects.push({
                route: route.path,
                state: route.state ?? "default",
                routeId: route.id,
                group: route.group,
                groupLabel: route.groupLabel,
                width,
                theme: task.theme,
                ...item,
              });
            }
            if (found.capped?.length) {
              for (const rule of found.capped) {
                const noteKey = `${route.id}|${rule}`;
                if (!cappedNotes.has(noteKey)) {
                  cappedNotes.set(noteKey, { route: route.id, rule, widths: [], message: `more ${rule} findings exist than the per-page reporting cap (${CAPS[rule] ?? 8}); the totals still count every one of them` });
                }
                const note = cappedNotes.get(noteKey);
                if (!note.widths.includes(width)) note.widths.push(width);
              }
            }

            const groupThemeKey = `${route.group}|${task.theme}`;
            const groupTaken = shotsByGroup.get(groupThemeKey) ?? 0;
            if (
              rows.length > 0 &&
              !shotKeys.has(shotName) &&
              defectShotCount < MAX_DEFECT_SHOTS &&
              groupTaken < MAX_SHOTS_PER_GROUP_THEME
            ) {
              shotsByGroup.set(groupThemeKey, groupTaken + 1);
              await captureJpeg(page, path.join(outDir, shotName));
              shotKeys.add(shotName);
              screenshots.push(shotName);
              defectShotCount += 1;
              comboShots += 1;
              for (const defect of defects) {
                if (defect.routeId === route.id && defect.width === width && defect.theme === task.theme && !defect.screenshot) {
                  defect.screenshot = shotName;
                }
              }
            }
            const overviewKey = `${route.group}-${width}-${task.theme}`;
            if (
              overviewShotCount < MAX_OVERVIEW_SHOTS &&
              OVERVIEW_WIDTHS.includes(width) &&
              !overviewDone.has(overviewKey)
            ) {
              overviewDone.add(overviewKey);
              const name = `shots/overview-${pageIdFromPath(route.group)}-${width}-${task.theme}.jpg`;
              if (!shotKeys.has(name)) {
                await captureJpeg(page, path.join(outDir, name));
                shotKeys.add(name);
                screenshots.push(name);
                overviewShotCount += 1;
              }
            }
          } catch (error) {
            routeErrors.push({ route: route.id, path: route.path, width, theme: task.theme, message: error instanceof Error ? error.message.slice(0, 200) : String(error) });
          }
        }
      }
    } finally {
      await page.close().catch(() => undefined);
      await context.close().catch(() => undefined);
    }
  }

  let cursor = 0;
  async function lane() {
    while (cursor < tasks.length) {
      const task = tasks[cursor];
      cursor += 1;
      await worker(task);
    }
  }
  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => lane()));
  } finally {
    await browser.close();
  }

  const serverErrors = routeErrors.filter((entry) => /^HTTP 5/.test(entry.message));
  if (serverErrors.length > 20) {
    throw new Error(`Audit server returned ${serverErrors.length} 5xx responses; treating as infrastructure failure`);
  }
  const loginRedirects = routeErrors.filter((entry) => entry.message === "redirected to login");
  if (loginRedirects.length > 5) {
    throw new Error(`Authenticated audit routes redirected to login ${loginRedirects.length} times; check the seeded sessions`);
  }

  defects.sort(
    (a, b) =>
      String(a.routeId).localeCompare(String(b.routeId)) ||
      a.width - b.width ||
      a.theme.localeCompare(b.theme) ||
      a.rule.localeCompare(b.rule) ||
      String(a.selector).localeCompare(String(b.selector)),
  );

  // Deduplicated across width and theme: the row count is the run size, this is
  // the work queue.
  const unique = new Map();
  for (const defect of defects) {
    const key = `${defect.routeId}|${defect.rule}|${defect.selector}`;
    const entry = unique.get(key) ?? { rule: defect.rule, routeId: defect.routeId, group: defect.group, selector: defect.selector, value: defect.value, severity: defect.severity, text: defect.text, widths: [], themes: new Set(), occurrences: 0 };
    entry.occurrences += 1;
    if (!entry.widths.includes(defect.width)) entry.widths.push(defect.width);
    entry.themes.add(defect.theme);
    unique.set(key, entry);
  }
  const distinct = [...unique.values()]
    .map((entry) => ({ ...entry, themes: [...entry.themes], widths: entry.widths.sort((a, b) => a - b) }))
    .sort((a, b) => b.occurrences - a.occurrences || a.rule.localeCompare(b.rule) || String(a.routeId).localeCompare(String(b.routeId)));

  const prNumber = Number.parseInt(args.pr ?? process.env.UI_AUDIT_PR ?? "0", 10) || 0;
  const runNumber = Number.parseInt(args.run ?? process.env.UI_AUDIT_RUN ?? "0", 10) || 0;
  const summary = {
    schemaVersion: 1,
    engine: "design/responsive-audit",
    generatedAt: new Date().toISOString(),
    baseUrl,
    branch: process.env.UI_AUDIT_BRANCH ?? process.env.GITHUB_HEAD_REF ?? null,
    commit: process.env.UI_AUDIT_COMMIT ?? process.env.GITHUB_SHA ?? null,
    runUrl: process.env.UI_AUDIT_RUN_URL ?? null,
    prNumber,
    runNumber,
    durationMs: Date.now() - startedAt,
    widths,
    themes,
    rules: Object.keys(CAPS),
    thresholds: { minTouch: MIN_TOUCH, minSpacing: MIN_SPACING, clsLimit: CLS_LIMIT },
    groups,
    routes: routes.map((route) => ({ id: route.id, group: route.group, path: route.path, state: route.state, role: route.role })),
    routesSkipped: skipped,
    resolverError,
    seedKeys: Object.keys(tokens),
    routeErrors,
    reportingCaps: [...cappedNotes.values()],
    defects,
    distinct,
    screenshots,
    totals: {
      routeStates,
      defects: defects.length,
      distinctDefects: distinct.length,
      screenshots: screenshots.length,
      routeErrors: routeErrors.length,
    },
    strict: process.env.UI_AUDIT_STRICT === "true",
  };

  await writeFile(path.join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  const markdown = buildSummaryMarkdown(summary, { resultsPath: `${prNumber}/${runNumber}` });
  const byRule = new Map();
  for (const item of distinct) byRule.set(item.rule, (byRule.get(item.rule) ?? 0) + 1);
  const extra = [
    "",
    "## Distinct defects (deduplicated across widths and themes)",
    "",
    `The run reported **${defects.length}** rows, which is **${distinct.length}** distinct problems: the same element at several widths is one fix.`,
    "",
    "| Rule | Distinct | Rows |",
    "| --- | ---: | ---: |",
    ...[...byRule.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([rule, count]) => `| ${rule} | ${count} | ${defects.filter((defect) => defect.rule === rule).length} |`),
    "",
    `Routes skipped because their seeded id could not be resolved: ${skipped.length}${resolverError ? ` (${resolverError.slice(0, 120)})` : ""}.`,
    `Route errors (navigation, missing actions, status codes): ${routeErrors.length}.`,
    summary.reportingCaps.length > 0
      ? `Per-page reporting caps reached (${summary.reportingCaps.length} route/rule pairs): ${summary.reportingCaps
          .slice(0, 8)
          .map((note) => `${note.route} · ${note.rule}`)
          .join(", ")}${summary.reportingCaps.length > 8 ? `, and ${summary.reportingCaps.length - 8} more` : ""}.`
      : "Per-page reporting caps: none reached, so every finding is listed.",
    "",
    `_Engine: \`design/responsive-audit/run.mjs\` — rules ${summary.rules.join(", ")}. Defects are informational unless \`UI_AUDIT_STRICT\` is true._`,
  ].join("\n");
  await writeFile(path.join(outDir, "summary.md"), `${markdown}\n${extra}\n`);

  console.log(
    `UI audit (${summary.engine}): ${defects.length} defects / ${distinct.length} distinct, ${screenshots.length} screenshots, ${routeErrors.length} route errors in ${Math.round((Date.now() - startedAt) / 1000)}s`,
  );
  console.log(`Wrote ${path.join(outDir, "summary.json")}`);
}

await run().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
