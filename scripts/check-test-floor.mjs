import { readFileSync } from "node:fs";

const floor = JSON.parse(readFileSync("ci/test-floor.json", "utf8"));
const paths = {
  unit: "test-results/unit.json",
  integration: "test-results/integration.json",
  e2e: "test-results/e2e.json",
};

function read(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    console.error(`Missing or invalid test report: ${path}`);
    process.exit(1);
  }
}

function countVitest(report) {
  const tests = report.testResults.flatMap((file) => file.assertionResults);
  return {
    total: tests.length,
    skipped: tests.filter((test) => test.status === "skipped" || test.status === "pending" || test.status === "todo").length,
  };
}

function countPlaywright(report) {
  let total = 0;
  let skipped = 0;
  const visit = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        total += 1;
        if (test.expectedStatus === "skipped" || test.status === "skipped") skipped += 1;
      }
    }
    for (const child of suite.suites ?? []) visit(child);
  };
  for (const suite of report.suites ?? []) visit(suite);
  return { total, skipped };
}

const unit = countVitest(read(paths.unit));
const integration = countVitest(read(paths.integration));
const e2e = countPlaywright(read(paths.e2e));
const results = { unit, integration, e2e };
let failed = false;
for (const [name, result] of Object.entries(results)) {
  console.log(`${name}: ${result.total} discovered, ${result.skipped} skipped (floor ${floor[name]})`);
  if (result.total < floor[name]) {
    console.error(`FLOOR FAILURE: ${name} dropped below ${floor[name]}.`);
    failed = true;
  }
  if (result.skipped > 0) {
    console.error(`SKIP FAILURE: ${name} has ${result.skipped} skipped/pending test(s).`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log("Test floor passed.");
