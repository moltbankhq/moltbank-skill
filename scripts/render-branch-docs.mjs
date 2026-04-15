import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();

const BRANCH_CONFIG = {
  main: {
    CLI_PACKAGE: "@moltbankhq/cli",
    CLI_INSTALL_COMMAND: "npm install -g @moltbankhq/cli@0.1.1",
    HOMEPAGE_URL: "https://app.moltbank.bot",
    AUTH_HOSTNAME: "app.moltbank.bot",
  },
  preview: {
    CLI_PACKAGE: "@megalinker/mbcli",
    CLI_INSTALL_COMMAND: "npm install -g @megalinker/mbcli@0.1.1",
    HOMEPAGE_URL: "https://app.moltbank.bot",
    AUTH_HOSTNAME: "app.moltbank.bot",
  },
};

const DEFAULT_FILE_MAP = [
  ["README.template.md", "README.md"],
  ["SKILL.template.md", "SKILL.md"],
];

// Local renders intentionally only produce SKILL.local.md (gitignored).
// README.md stays tracked and only reflects main/preview branch outputs.
const LOCAL_FILE_MAP = [["SKILL.template.md", "SKILL.local.md"]];

function getBranch() {
  if (process.env.TARGET_BRANCH) return process.env.TARGET_BRANCH;

  try {
    return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
  } catch {
    try {
      const head = fs.readFileSync(path.join(ROOT, ".git", "HEAD"), "utf8").trim();
      if (head.startsWith("ref:")) {
        const ref = head.slice(5).trim();
        const parts = ref.split("/");
        return parts[parts.length - 1] || "";
      }
    } catch {
      // ignore and fall through
    }
    return "";
  }
}

function renderTemplate(template, vars) {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => {
    if (!(key in vars)) {
      throw new Error(`Missing template variable: ${key}`);
    }
    return vars[key];
  });
}

function writeIfChanged(filePath, next) {
  if (fs.existsSync(filePath)) {
    const prev = fs.readFileSync(filePath, "utf8");
    if (prev === next) return false;
  }
  fs.writeFileSync(filePath, next, "utf8");
  return true;
}

function loadDotenv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function buildLocalVars() {
  loadDotenv(path.join(ROOT, ".env"));

  const rawPath = process.env.LOCAL_OPENCLAW_PATH;
  if (!rawPath) {
    throw new Error(
      "LOCAL_OPENCLAW_PATH is not set. Copy .env.example to .env and point LOCAL_OPENCLAW_PATH at your local openclaw-npm checkout."
    );
  }

  const absPath = path.resolve(ROOT, rawPath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`LOCAL_OPENCLAW_PATH does not exist: ${absPath}`);
  }

  const pkgPath = path.join(absPath, "package.json");
  if (!fs.existsSync(pkgPath)) {
    throw new Error(
      `LOCAL_OPENCLAW_PATH is not a Node package (missing package.json): ${absPath}`
    );
  }

  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  } catch (cause) {
    throw new Error(
      `Could not parse ${pkgPath}: ${cause instanceof Error ? cause.message : cause}`
    );
  }

  const bin = pkg.bin;
  const hasMoltbankBin =
    (typeof bin === "string" && pkg.name === "moltbank") ||
    (bin && typeof bin === "object" && "moltbank" in bin);

  if (!hasMoltbankBin) {
    throw new Error(
      `LOCAL_OPENCLAW_PATH package.json does not expose a "moltbank" bin entry: ${pkgPath}`
    );
  }

  const homepageUrl = process.env.LOCAL_HOMEPAGE_URL || "https://localtest.app.moltbank.bot";
  let authHostname;
  try {
    authHostname = new URL(homepageUrl).hostname;
  } catch {
    throw new Error(`LOCAL_HOMEPAGE_URL is not a valid URL: ${homepageUrl}`);
  }

  return {
    CLI_PACKAGE: pkg.name || "@moltbankhq/cli",
    CLI_INSTALL_COMMAND: `cd ${absPath} && npm link`,
    HOMEPAGE_URL: homepageUrl,
    AUTH_HOSTNAME: authHostname,
  };
}

const branch = getBranch();

let vars;
let fileMap;

if (branch === "local") {
  vars = buildLocalVars();
  fileMap = LOCAL_FILE_MAP;
} else {
  vars = BRANCH_CONFIG[branch];
  if (!vars) {
    console.log(`Skipping docs render for unmanaged branch: ${branch}`);
    process.exit(0);
  }
  fileMap = DEFAULT_FILE_MAP;
}

let changed = false;

for (const [templateName, outputName] of fileMap) {
  const templatePath = path.join(ROOT, templateName);
  const outputPath = path.join(ROOT, outputName);

  const template = fs.readFileSync(templatePath, "utf8");
  const rendered = renderTemplate(template, vars);
  const didChange = writeIfChanged(outputPath, rendered);

  if (didChange) {
    changed = true;
    console.log(`Rendered ${outputName} for branch ${branch}`);
  }
}

if (!changed) {
  console.log(`Docs already up to date for branch ${branch}`);
}
