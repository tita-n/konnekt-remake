/**
 * Lighthouse CI. Point LHCI_URL at a deployed preview to audit that instead of
 * the local production build:
 *   LHCI_URL=https://staging.example npx lhci autorun
 */
module.exports = {
  ci: {
    collect: {
      url: [process.env.LHCI_URL ?? "http://localhost:3100/"],
      numberOfRuns: 1,
      settings: {
        chromeFlags: "--headless=new --no-sandbox",
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
        "categories:seo": ["warn", { minScore: 0.9 }],
        "color-contrast": ["error", { minScore: 1 }],
        "document-title": ["error", { minScore: 1 }],
        "html-has-lang": ["error", { minScore: 1 }],
        "meta-viewport": ["error", { minScore: 1 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci",
    },
  },
};
