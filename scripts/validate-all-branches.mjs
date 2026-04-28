#!/usr/bin/env node
// Renders + checks SKILL.md / README.md for every managed branch in
// BRANCH_CONFIG. Restores the merge-target render at the end so the
// committed file in this branch stays consistent. Used by CI and by
// reviewers to verify "the template is complete for ALL branches" —
// the Phase 6 plan's "check both main and preview" requirement —
// without claiming the committed file is somehow valid for two
// branches at once.

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

// Merge-target convention for this branch. The committed SKILL.md /
// README.md reflect this branch's render at commit time. If you add
// new managed branches, update this list AND BRANCH_CONFIG in the
// render/check scripts.
const MANAGED_BRANCHES = ["main", "preview", "preview-multiagent"];

// Default merge target restored at the end (so committed files don't
// silently switch on the developer running this script). Override via
// MERGE_TARGET env var when running on a branch with a different
// downstream.
const MERGE_TARGET = process.env.MERGE_TARGET ?? "preview";

function run(script, target) {
  try {
    execSync(`TARGET_BRANCH=${target} node ${path.join("scripts", script)}`, {
      cwd: ROOT,
      stdio: "inherit",
    });
    return true;
  } catch {
    return false;
  }
}

let failed = false;

for (const branch of MANAGED_BRANCHES) {
  console.log(`\n[validate] rendering for branch=${branch}`);
  if (!run("render-branch-docs.mjs", branch)) {
    console.error(`[validate] render failed for branch=${branch}`);
    failed = true;
    continue;
  }
  console.log(`[validate] checking for branch=${branch}`);
  if (!run("check-branch-docs.mjs", branch)) {
    console.error(`[validate] check failed for branch=${branch}`);
    failed = true;
  }
}

console.log(`\n[validate] restoring merge-target render (${MERGE_TARGET})`);
run("render-branch-docs.mjs", MERGE_TARGET);

// Sanity: after restore, check matches the merge target.
if (!run("check-branch-docs.mjs", MERGE_TARGET)) {
  console.error(`[validate] post-restore check failed for ${MERGE_TARGET}`);
  failed = true;
}

if (failed) {
  process.exit(1);
}
console.log(
  `\n[validate] OK — template renders cleanly for: ${MANAGED_BRANCHES.join(", ")}. ` +
    `Committed render reflects the ${MERGE_TARGET} merge target.`,
);
