import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();

const BRANCH_CONFIG = {
  main: {
    CLI_PACKAGE: "@moltbankhq/cli",
    CLI_INSTALL_COMMAND: "npm install -g @moltbankhq/cli",
    HOMEPAGE_URL: "https://app.moltbank.bot",
    AUTH_HOSTNAME: "app.moltbank.bot",
    HOME_DIR_NAME: ".moltbank",
    DEFAULT_CREDENTIALS_PATH: "${HOME}/.moltbank/agents/default/credentials.json",
    AGENT_CREDENTIALS_PATH_TEMPLATE: "~/.moltbank/agents/<name>/credentials.json",
  },
  preview: {
    CLI_PACKAGE: "@megalinker/mbcli",
    CLI_INSTALL_COMMAND: "npm install -g @megalinker/mbcli",
    HOMEPAGE_URL: "https://app.moltbank.bot",
    AUTH_HOSTNAME: "app.moltbank.bot",
    HOME_DIR_NAME: ".moltbank-test",
    DEFAULT_CREDENTIALS_PATH: "${HOME}/.moltbank-test/agents/default/credentials.json",
    AGENT_CREDENTIALS_PATH_TEMPLATE: "~/.moltbank-test/agents/<name>/credentials.json",
  },
  "preview-multiagent": {
    CLI_PACKAGE: "@megalinker/mbcli",
    CLI_INSTALL_COMMAND: "npm install -g @megalinker/mbcli",
    HOMEPAGE_URL: "https://app.moltbank.bot",
    AUTH_HOSTNAME: "app.moltbank.bot",
    HOME_DIR_NAME: ".moltbank-test",
    DEFAULT_CREDENTIALS_PATH: "${HOME}/.moltbank-test/agents/default/credentials.json",
    AGENT_CREDENTIALS_PATH_TEMPLATE: "~/.moltbank-test/agents/<name>/credentials.json",
  },
};

const FILE_MAP = [
  ["README.template.md", "README.md"],
  ["SKILL.template.md", "SKILL.md"],
];

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

const branch = getBranch();
const vars = BRANCH_CONFIG[branch];

if (!vars) {
  console.log(`Skipping docs render for unmanaged branch: ${branch}`);
  process.exit(0);
}

let changed = false;

for (const [templateName, outputName] of FILE_MAP) {
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
