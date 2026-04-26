/**
 * Cursor `postToolUse` hook: after a tool successfully writes a file, injects
 * `additional_context` so the Agent re-reads the file and provides a good Purpose
 * (description) and runs `ariadne update` with it — not a headless `update`.
 */
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const EDIT_TOOLS = new Set([
  "Write",
  "search_replace",
  "str_replace",
  "StrReplace",
  "WriteFile",
  "write",
]);

function readStdinSync() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function out(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function toAbsolute(maybe, cwd) {
  if (!maybe) return null;
  if (path.isAbsolute(maybe)) return path.resolve(maybe);
  if (!cwd) return null;
  return path.resolve(cwd, maybe);
}

function findAriadneProjectRoot(fileAbs) {
  let d = path.dirname(fileAbs);
  for (;;) {
    if (fs.existsSync(path.join(d, ".ariadne"))) {
      return d;
    }
    const parent = path.dirname(d);
    if (parent === d) return null;
    d = parent;
  }
}

function extractFilePathFromToolInput(toolName, toolInput) {
  if (toolInput == null) return null;
  let ti = toolInput;
  if (typeof ti === "string") {
    try {
      ti = JSON.parse(ti);
    } catch {
      return null;
    }
  }
  if (typeof ti !== "object") return null;
  return (
    ti.file_path ||
    ti.path ||
    ti.target_file ||
    ti.file ||
    ti.filePath ||
    ti.target_path ||
    null
  );
}

function isRelevantSource(abs) {
  const p = String(abs).replace(/\\/g, "/");
  if (p.includes("node_modules/") || p.includes("node_modules\\")) return false;
  if (p.includes("/.git/") || p.includes("\\.git\\")) return false;
  if (/\.d\.ts$/i.test(p)) return false;
  if (!/\.(tsx?)$/i.test(p)) return false;
  return true;
}

function buildMessage(relpos) {
  return [
    "## Ariadne (postToolUse): registry description + update",
    "",
    `A file in this Ariadne project was just written: \`${relpos}\``,
    "",
    "Before you move on, you **must** (same turn or the very next):",
    "",
    "1. **Re-read** that file and list **exported** functions (or `export` blocks) you care about for this change.",
    "2. For each, draft a **1–3 sentence English Purpose** that matches the **Ariadne registry content contract** in `.cursor/rules/ariadne.mdc` (what / when, not a copy of implementation).",
    `3. Run: \`ariadne update ${relpos} "<your best Purpose>"\` — or rely on JSDoc on each export and run \`ariadne update ${relpos}\` (no custom purpose) so the CLI can pull the first JSDoc line.`,
    "4. If only formatting / comment-only, say so briefly; if **types or signatures** changed, still `update` so the registry head stays accurate.",
    "",
    "_This is injected as `additional_context`; it is not a silent `ariadne` run._",
  ].join("\n");
}

function main() {
  const raw = readStdinSync().trim();
  if (!raw) {
    return out({});
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return out({});
  }

  const toolName = data.tool_name || data.toolName;
  if (!toolName) {
    return out({});
  }

  if (!EDIT_TOOLS.has(String(toolName))) {
    return out({});
  }

  const cwd = data.cwd || data.workspace || process.cwd();
  const p = extractFilePathFromToolInput(toolName, data.tool_input);
  if (!p) {
    return out({});
  }

  const abs = toAbsolute(p, cwd);
  if (!abs || !isRelevantSource(abs)) {
    return out({});
  }

  const projectRoot = findAriadneProjectRoot(abs);
  if (!projectRoot) {
    return out({});
  }

  const relpos = path.relative(projectRoot, abs).split(path.sep).join("/");
  if (relpos.startsWith("..") || path.isAbsolute(relpos)) {
    return out({});
  }

  out({ additional_context: buildMessage(relpos) });
}

main();
