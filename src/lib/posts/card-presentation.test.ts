import test from "node:test";
import assert from "node:assert/strict";
import {
  formatReportDisplayId,
  maskMatricNumber,
  pollTimeRemaining,
  truncatePostBody,
} from "./card-presentation";

test("maskMatricNumber masks middle digits after last slash", () => {
  assert.equal(maskMatricNumber(null), "—");
  assert.equal(maskMatricNumber("NU/22/1187"), "NU/22/1**7");
  assert.equal(maskMatricNumber("NOU/22/03145"), "NOU/22/0***5");
});

test("formatReportDisplayId produces stable RP-YYYY-NNNN identifier", () => {
  const first = formatReportDisplayId("rep_abc123", "2026-11-12T10:00:00.000Z");
  const second = formatReportDisplayId("rep_abc123", "2026-11-12T10:00:00.000Z");
  assert.equal(first, second);
  assert.match(first, /^RP-2026-\d{4}$/);
});

test("pollTimeRemaining formats open and closed polls", () => {
  const base = Date.UTC(2026, 10, 10, 12, 0, 0);
  assert.equal(pollTimeRemaining(new Date(base + 86_400_000).toISOString(), true, base), "1 day left");
  assert.equal(pollTimeRemaining(new Date(base + 2 * 86_400_000).toISOString(), true, base), "2 days left");
  assert.equal(pollTimeRemaining(new Date(base + 86_400_000).toISOString(), false, base), "Poll ended");
  assert.equal(pollTimeRemaining(new Date(base - 1000).toISOString(), true, base), "Poll ended");
});

test("truncatePostBody truncates cleanly at word boundary when collapsed", () => {
  const shortText = "Short post body";
  assert.deepEqual(truncatePostBody(shortText, false, 100), { text: shortText, truncated: false });

  const longText = "a ".repeat(150).trim();
  const collapsed = truncatePostBody(longText, false, 200);
  assert.equal(collapsed.truncated, true);
  assert.ok(collapsed.text.endsWith("..."));
  assert.ok(collapsed.text.length <= 200);

  const open = truncatePostBody(longText, true, 200);
  assert.equal(open.truncated, true);
  assert.equal(open.text, longText);
});
