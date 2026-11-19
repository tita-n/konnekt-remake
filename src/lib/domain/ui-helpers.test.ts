import test from "node:test";
import assert from "node:assert/strict";
import { accentCssVars, checkAccentContrast, contrastRatio, deriveDarkAccents } from "./color";
import {
  deriveClayAvatarTraits,
  formatCompactCount,
  hashAvatarSeed,
  shouldCollapsePostBody,
} from "./card-presentation";

test("formatCompactCount hides zero and abbreviates >= 1000", () => {
  assert.equal(formatCompactCount(0), "");
  assert.equal(formatCompactCount(-3), "");
  assert.equal(formatCompactCount(18), "18");
  assert.equal(formatCompactCount(999), "999");
  assert.equal(formatCompactCount(1000), "1k");
  assert.equal(formatCompactCount(1240), "1.2k");
  assert.equal(formatCompactCount(14800), "15k");
});

test("deriveClayAvatarTraits is deterministic and varies across student seeds", () => {
  const a1 = deriveClayAvatarTraits("chinedu_okafor");
  const a2 = deriveClayAvatarTraits("chinedu_okafor");
  const b = deriveClayAvatarTraits("aisha_bello");
  assert.deepEqual(a1, a2);
  assert.notEqual(hashAvatarSeed("chinedu_okafor"), hashAvatarSeed("aisha_bello"));
  assert.ok(a1.skinTone.startsWith("#"));
  assert.ok(b.shirtColor.startsWith("#"));
});

test("shouldCollapsePostBody applies to long posts and questions only", () => {
  const longText = "A".repeat(280);
  assert.equal(shouldCollapsePostBody(longText, "POST"), true);
  assert.equal(shouldCollapsePostBody(longText, "QUESTION"), true);
  assert.equal(shouldCollapsePostBody(longText, "POLL"), false);
  assert.equal(shouldCollapsePostBody("Short campus update", "POST"), false);
});

test("deriveDarkAccents keeps dark text ink and filled buttons AA readable", () => {
  const indigo = deriveDarkAccents("#4F46E5");
  assert.equal(indigo.darkInk, "#8B93FF");
  assert.equal(indigo.darkButton, "#5C5BF0");
  assert.ok(contrastRatio(indigo.darkInk, "#171A1F") >= 4.5);
  assert.ok(contrastRatio("#FFFFFF", indigo.darkButton) >= 4.5);

  const deepGreen = deriveDarkAccents("#147A57");
  assert.ok(contrastRatio(deepGreen.darkInk, "#171A1F") >= 4.5);
  assert.equal(checkAccentContrast("#4F46E5").passes, true);
  assert.equal(accentCssVars("#4F46E5")["--accent-dark-ink"], "#8B93FF");
});
