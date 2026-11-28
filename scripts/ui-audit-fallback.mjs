import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { buildSummaryMarkdown, pageIdFromPath, resultFileNames } from "./lib/ui-audit.mjs";

const DEFAULT_WIDTHS = [320, 360, 375, 390, 412, 430, 600, 768, 820, 1024, 1280, 1440, 1920];
const DEFAULT_THEMES = ["light", "dark"];
const MAX_DEFECT_SHOTS = 42;
const MAX_OVERVIEW_SHOTS = 18;
const PASSWORD = "KonnektDemo123!";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      args[key] = true;
    } else {
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

function parseNumberList(value, fallback) {
  return splitList(value, fallback.map(String)).map((entry) => Number.parseInt(entry, 10)).filter((entry) => Number.isFinite(entry) && entry > 0);
}

function heightFor(width) {
  if (width <= 430) return 844;
  if (width <= 820) return 1024;
  return 900;
}

async function resolveRouteTokens(routesFile) {
  const config = JSON.parse(await readFile(routesFile, "utf8"));
  const prisma = new PrismaClient();
  const resolved = {};
  try {
    for (const [name, spec] of Object.entries(config.resolvers ?? {})) {
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
      resolved[name] = String(value);
    }
  } finally {
    await prisma.$disconnect();
  }

  const replace = (template) =>
    String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
      if (!(key in resolved)) throw new Error(`Route token {${key}} has no resolver`);
      return resolved[key];
    });

  const routes = [];
  for (const group of config.groups ?? []) {
    for (const route of group.routes ?? []) {
      routes.push({
        ...route,
        path: replace(route.path),
        group: group.id,
        groupLabel: group.label,
      });
    }
  }
  return { config, routes, seed: resolved };
}

function storageStateFor(authDir, role) {
  return path.join(authDir, `${role}.json`);
}

export function routeUrl(baseUrl, routePath) {
  return new URL(routePath.startsWith("/") ? routePath : `/${routePath}`, baseUrl).toString();
}

async function runAction(page, action) {
  if (action.type !== "click") return false;
  try {
    let locator;
    if (action.selector) {
      locator = page.locator(action.selector).first();
    } else if (action.role) {
      locator = page.getByRole(action.role, action.name ? { name: action.name, exact: action.exact !== false } : undefined).first();
    } else if (action.text) {
      locator = page.getByText(action.text, { exact: action.exact !== false }).first();
    }
    if (!locator) return false;
    await locator.waitFor({ state: "visible", timeout: 2500 });
    await locator.click({ timeout: 2500 });
    await page.waitForLoadState("networkidle", { timeout: 2500 }).catch(() => undefined);
    await page.waitForTimeout(200);
    return true;
  } catch {
    return false;
  }
}

const AUDIT_SCRIPT = function auditPage() {
  const problems = [];
  const viewportWidth = window.innerWidth;
  const maxProblems = { overflow: 4, touch: 12, overlap: 4, clip: 8, image: 6, name: 8, contrast: 10 };

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

  function visible(element) {
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    if (element.closest("[aria-hidden='true']")) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0.5 && rect.height > 0.5;
  }

  function push(rule, element, value, severity = "medium", extra = {}) {
    const bucket = extra.bucket ?? rule;
    if (problems.filter((entry) => entry.rule === rule).length >= (maxProblems[bucket] ?? 8)) return;
    problems.push({
      rule,
      selector: selectorFor(element),
      value,
      severity,
      ...(extra.text ? { text: String(extra.text).slice(0, 120) } : {}),
    });
  }

  function inHorizontalScroller(element) {
    let node = element.parentElement;
    while (node && node !== document.body) {
      const style = getComputedStyle(node);
      if ((style.overflowX === "auto" || style.overflowX === "scroll") && node.scrollWidth > node.clientWidth + 1) return true;
      node = node.parentElement;
    }
    return false;
  }

  // Horizontal document overflow, naming the widest offender rather than only <html>.
  if (document.documentElement.scrollWidth > viewportWidth + 1) {
    let offender = document.documentElement;
    let widest = viewportWidth;
    for (const element of document.querySelectorAll("body *")) {
      if (!visible(element) || inHorizontalScroller(element)) continue;
      const rect = element.getBoundingClientRect();
      const right = rect.right + window.scrollX;
      if (right > widest + 1) {
        widest = right;
        offender = element;
      }
    }
    push(
      "horizontal-overflow",
      offender,
      `document ${document.documentElement.scrollWidth}px vs viewport ${viewportWidth}px${offender === document.documentElement ? "" : `; widest edge ${Math.round(widest)}px`}`,
      "high",
      { bucket: "overflow" },
    );
  }

  // Touch targets. Inline text links are intentionally exempt.
  const interactiveSelector = "a[href], button, input:not([type='hidden']), select, textarea, summary, [role='button'], [role='tab'], [role='link']";
  for (const element of document.querySelectorAll(interactiveSelector)) {
    if (!visible(element)) continue;
    if (element.disabled || element.getAttribute("aria-disabled") === "true") continue;
    const tag = element.tagName.toLowerCase();
    const type = (element.getAttribute("type") || "").toLowerCase();
    if (tag === "input" && (type === "checkbox" || type === "radio")) continue;
    const style = getComputedStyle(element);
    if (tag === "a" && style.display === "inline" && style.backgroundColor === "rgba(0, 0, 0, 0)" && style.borderTopWidth === "0px") continue;
    const rect = element.getBoundingClientRect();
    if (rect.width + 0.5 < 44 || rect.height + 0.5 < 44) {
      push("touch-target", element, `${Math.round(rect.width)}×${Math.round(rect.height)} px, needs at least 44×44`, "high", { bucket: "touch" });
    }
  }

  // Fixed/sticky surfaces overlapping each other (ignore ancestor/descendant pairs).
  const fixed = [...document.querySelectorAll("body *")].filter((element) => {
    if (!visible(element)) return false;
    const position = getComputedStyle(element).position;
    return position === "fixed" || position === "sticky";
  });
  for (let leftIndex = 0; leftIndex < fixed.length; leftIndex += 1) {
    const left = fixed[leftIndex];
    const a = left.getBoundingClientRect();
    if (a.width < 4 || a.height < 4) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < fixed.length; rightIndex += 1) {
      const right = fixed[rightIndex];
      if (left.contains(right) || right.contains(left)) continue;
      const b = right.getBoundingClientRect();
      const overlapWidth = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const overlapHeight = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      const area = overlapWidth * overlapHeight;
      const smaller = Math.min(a.width * a.height, b.width * b.height);
      if (area > 24 * 24 && area > smaller * 0.2) {
        push("overlap", left, `overlaps ${selectorFor(right)} by ${Math.round(area)}px²`, "medium", { bucket: "overlap" });
        break;
      }
    }
  }

  // Clipped single-line text.
  for (const element of document.querySelectorAll("body *")) {
    if (!visible(element) || !element.textContent?.trim()) continue;
    const style = getComputedStyle(element);
    if (style.whiteSpace !== "nowrap" && style.whiteSpace !== "pre") continue;
    if (!["hidden", "clip"].includes(style.overflowX)) continue;
    if (element.children.length > 0) continue;
    if (element.scrollWidth > element.clientWidth + 1) {
      push("clipped-text", element, `${element.clientWidth}px visible of ${element.scrollWidth}px`, "medium", { bucket: "clip", text: element.textContent.trim() });
    }
  }

  // Raster images without width/height attributes or a CSS aspect ratio.
  for (const image of document.images) {
    if (!visible(image)) continue;
    if (image.naturalWidth === 0) continue;
    const style = getComputedStyle(image);
    const hasAttributes = image.hasAttribute("width") && image.hasAttribute("height");
    const hasAspect = style.aspectRatio && style.aspectRatio !== "auto";
    if (!hasAttributes && !hasAspect) {
      push("image-aspect", image, `${image.naturalWidth}×${image.naturalHeight} natural, no reserved box`, "low", { bucket: "image" });
    }
  }

  // Icon-only controls need an accessible name.
  for (const element of document.querySelectorAll("button, a[href], [role='button'], [role='link']")) {
    if (!visible(element)) continue;
    const labelledBy = element.getAttribute("aria-labelledby");
    const labelText = labelledBy
      ? labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ").trim()
      : "";
    const name =
      (element.getAttribute("aria-label") || "").trim() ||
      labelText ||
      (element.getAttribute("title") || "").trim() ||
      (element.textContent || "").trim() ||
      [...element.querySelectorAll("img[alt]")].map((image) => image.getAttribute("alt")).join(" ").trim();
    const iconOnly = element.querySelector("svg, img") && !(element.textContent || "").trim();
    if (iconOnly && !name) {
      push("accessible-name", element, "icon-only control has no accessible name", "high", { bucket: "name" });
    }
  }

  function parseColor(value) {
    const match = String(value).match(/rgba?\(([^)]+)\)/);
    if (!match) return null;
    const parts = match[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    if (parts.length < 3) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
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

  function effectiveBackground(element) {
    let node = element;
    let result = { r: 255, g: 255, b: 255, a: 1 };
    const layers = [];
    while (node && node.nodeType === 1) {
      const style = getComputedStyle(node);
      if (style.backgroundImage && style.backgroundImage !== "none") return null;
      const color = parseColor(style.backgroundColor);
      if (color && color.a > 0) {
        layers.push(color);
        if (color.a >= 0.999) break;
      }
      node = node.parentElement;
    }
    for (let index = layers.length - 1; index >= 0; index -= 1) result = composite(layers[index], result);
    return result;
  }

  function luminance(color) {
    const channel = (value) => {
      const normalized = value / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
  }

  function ratio(a, b) {
    const first = luminance(a);
    const second = luminance(b);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  }

  for (const element of document.querySelectorAll("body *")) {
    if (!visible(element)) continue;
    const directText = [...element.childNodes].filter((node) => node.nodeType === 3).map((node) => node.textContent?.trim() ?? "").join(" ").trim();
    if (directText.length < 2) continue;
    if (element.closest("select, option, [aria-hidden='true'], .sr-only")) continue;
    const style = getComputedStyle(element);
    if (style.backgroundImage && style.backgroundImage !== "none") continue;
    const foreground = parseColor(style.color);
    const background = effectiveBackground(element);
    if (!foreground || !background) continue;
    const solidForeground = foreground.a < 1 ? composite(foreground, background) : foreground;
    const size = Number.parseFloat(style.fontSize);
    const bold = Number.parseInt(style.fontWeight, 10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const minimum = large ? 3 : 4.5;
    const contrast = ratio(solidForeground, background);
    if (contrast + 0.05 < minimum) {
      push("contrast", element, `${contrast.toFixed(2)}:1, needs ${minimum}:1`, "high", { bucket: "contrast", text: directText });
    }
  }

  return problems;
};

async function captureJpeg(page, outputPath) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const png = await page.screenshot({ type: "png", fullPage: false, animations: "disabled" });
  await sharp(png).resize({ width: 800, withoutEnlargement: true }).jpeg({ quality: 70, mozjpeg: true }).toFile(outputPath);
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = args["base-url"];
  const routesFile = args.routes ?? "design/audit-routes.json";
  if (!baseUrl) throw new Error("--base-url is required");
  const widths = parseNumberList(args.widths, DEFAULT_WIDTHS);
  const themes = splitList(args.themes, DEFAULT_THEMES);
  const outDir = path.resolve(args.out ?? ".ui-audit");
  const authDir = path.resolve(args["auth-dir"] ?? process.env.UI_AUDIT_AUTH_DIR ?? path.join(outDir, "auth"));
  const shotsDir = path.join(outDir, "shots");
  await mkdir(outDir, { recursive: true });
  await mkdir(shotsDir, { recursive: true });

  const startedAt = Date.now();
  const { config, routes, seed } = await resolveRouteTokens(routesFile);
  const groups = config.groups.map((group) => ({ id: group.id, label: group.label }));
  const missing = [...new Set(routes.filter((route) => route.role && route.role !== "anonymous").map((route) => route.role))].filter(
    (role) => !existsSync(storageStateFor(authDir, role)),
  );
  if (missing.length > 0) throw new Error(`Missing auth state for roles: ${missing.join(", ")}`);

  const browser = await chromium.launch({ headless: true });
  const defects = [];
  const routeErrors = [];
  const screenshots = [];
  const overviewGroups = new Set();
  let defectShotCount = 0;
  let overviewShotCount = 0;
  let routeStates = 0;

  const roles = [...new Set(routes.map((route) => route.role ?? "anonymous"))];
  const combinations = [];
  for (const theme of themes) for (const width of widths) combinations.push({ theme, width });

  async function auditCombination({ theme, width }) {
    let comboDefectShots = 0;
    const contextOptions = {
      viewport: { width, height: heightFor(width) },
      colorScheme: theme,
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    };
    const contexts = new Map();
    try {
      for (const role of roles) {
        const context = await browser.newContext({
          ...contextOptions,
          ...(role === "anonymous" ? {} : { storageState: storageStateFor(authDir, role) }),
        });
        await context.addInitScript((selectedTheme) => {
          try {
            localStorage.setItem("konnekt.theme", selectedTheme);
          } catch {}
          document.documentElement.dataset.theme = selectedTheme;
        }, theme);
        contexts.set(role, context);
      }

      for (const route of routes) {
        const context = contexts.get(route.role ?? "anonymous");
        const page = await context.newPage();
        let status = null;
        try {
          const response = await page.goto(routeUrl(baseUrl, route.path), { waitUntil: "domcontentloaded", timeout: 20_000 });
          status = response?.status() ?? null;
          await page.waitForFunction(() => document.styleSheets.length > 0, null, { timeout: 3000 }).catch(() => undefined);
          await page.waitForLoadState("networkidle", { timeout: 1500 }).catch(() => undefined);
          await page.waitForTimeout(100);
          await page.evaluate(async () => {
            if (document.fonts?.ready) await document.fonts.ready;
            document.documentElement.dataset.theme = localStorage.getItem("konnekt.theme") || document.documentElement.dataset.theme || "light";
          });
          for (const action of route.actions ?? []) {
            const clicked = await runAction(page, action);
            if (!clicked) routeErrors.push({ route: route.id, path: route.path, width, theme, message: `action not found: ${action.name ?? action.selector ?? action.text}` });
          }
          await page.waitForTimeout(120);
          routeStates += 1;
          const finalPath = new URL(page.url()).pathname;
          if ((route.role ?? "anonymous") !== "anonymous" && finalPath.startsWith("/login")) {
            routeErrors.push({ route: route.id, path: route.path, width, theme, message: "redirected to login" });
          }

          if (status && status >= 500) {
            routeErrors.push({ route: route.id, path: route.path, width, theme, message: `HTTP ${status}` });
          } else if (status && status >= 400 && route.id !== "not-found" && status !== route.expectedStatus) {
            routeErrors.push({ route: route.id, path: route.path, width, theme, message: `HTTP ${status}` });
          }

          const found = await page.evaluate(AUDIT_SCRIPT);
          for (const item of found) {
            defects.push({
              route: route.path,
              state: route.state ?? "default",
              routeId: route.id,
              group: route.group,
              groupLabel: route.groupLabel,
              width,
              theme,
              ...item,
            });
          }

          if (found.length > 0 && comboDefectShots < 2 && defectShotCount < MAX_DEFECT_SHOTS) {
            const relative = resultFileNames(route.id, width, theme).screenshot;
            await captureJpeg(page, path.join(outDir, relative));
            for (const item of defects) {
              if (item.route === route.path && item.width === width && item.theme === theme && item.state === (route.state ?? "default")) {
                item.screenshot = relative;
              }
            }
            screenshots.push(relative);
            defectShotCount += 1;
            comboDefectShots += 1;
          }
          if (
            overviewShotCount < MAX_OVERVIEW_SHOTS &&
            (width === 390 || width === 1280) &&
            theme === "light" &&
            !overviewGroups.has(`${route.group}-${width}`)
          ) {
            overviewGroups.add(`${route.group}-${width}`);
            const relative = `shots/overview-${pageIdFromPath(route.group)}-${width}.jpg`;
            await captureJpeg(page, path.join(outDir, relative));
            screenshots.push(relative);
            overviewShotCount += 1;
          }
        } catch (error) {
          routeErrors.push({ route: route.id, path: route.path, width, theme, message: error instanceof Error ? error.message : String(error) });
        } finally {
          await page.close().catch(() => undefined);
        }
      }
    } finally {
      for (const context of contexts.values()) await context.close().catch(() => undefined);
    }
  }

  const concurrency = Math.max(1, Number.parseInt(process.env.UI_AUDIT_CONCURRENCY ?? "4", 10));
  let cursor = 0;
  async function worker() {
    while (cursor < combinations.length) {
      const combination = combinations[cursor];
      cursor += 1;
      await auditCombination(combination);
    }
  }
  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, combinations.length) }, () => worker()));
  } finally {
    await browser.close();
  }

  const serverErrors = routeErrors.filter((entry) => /^HTTP 5/.test(entry.message));
  if (serverErrors.length > 20) throw new Error(`Audit server returned ${serverErrors.length} 5xx responses; treating as infrastructure failure`);
  const loginRedirects = routeErrors.filter((entry) => entry.message === "redirected to login");
  if (loginRedirects.length > 5) throw new Error(`Authenticated audit routes redirected to login ${loginRedirects.length} times; check the seeded sessions`);

  defects.sort((a, b) => a.route.localeCompare(b.route) || a.width - b.width || a.theme.localeCompare(b.theme) || a.rule.localeCompare(b.rule));
  const prNumber = Number.parseInt(args.pr ?? process.env.UI_AUDIT_PR ?? "0", 10) || 0;
  const runNumber = Number.parseInt(args.run ?? process.env.UI_AUDIT_RUN ?? "0", 10) || 0;
  const summary = {
    schemaVersion: 1,
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
    groups,
    routes: routes.map((route) => ({ id: route.id, group: route.group, path: route.path, state: route.state, role: route.role })),
    seedKeys: Object.keys(seed),
    routeErrors,
    defects,
    screenshots,
    totals: {
      routeStates,
      defects: defects.length,
      screenshots: screenshots.length,
      routeErrors: routeErrors.length,
    },
    strict: process.env.UI_AUDIT_STRICT === "true",
  };

  await writeFile(path.join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(
    path.join(outDir, "summary.md"),
    `${buildSummaryMarkdown(summary, { resultsPath: `${prNumber}/${runNumber}` })}\n\n_Route errors: ${routeErrors.length}. Defects are informational unless UI_AUDIT_STRICT is true._\n`,
  );
  console.log(
    `UI audit: ${defects.length} defects, ${screenshots.length} screenshots, ${routeErrors.length} route errors in ${Math.round((Date.now() - startedAt) / 1000)}s`,
  );
  console.log(`Wrote ${path.join(outDir, "summary.json")}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
