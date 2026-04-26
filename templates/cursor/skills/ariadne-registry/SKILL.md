---
name: ariadne-registry
description: >-
  Maintains the Ariadne registry under .ariadne/registry for TypeScript public
  exports. Use when the user or context changes exported APIs, JSDoc, registry
  Purpose, ariadne update, .ariadne, or Ariadne audit.
---

# Ariadne registry

## Why

Exports that others can import should have a **locatable** entry under `.ariadne/registry/` (one symbol per file, per `ariadne update` / `ariadne sync` rules in the project). The CLI does not call an LLM; the agent authors **Purpose** and keeps entries aligned with source.

## When to use this skill

- After **Write** / edits to files that **export** symbols covered by `.ariadne/config.json` (include / exclude).
- The user asks to refresh the registry, fix **audit** gaps, or run **`ariadne update`** / **`ariadne audit`**.
- A **postToolUse** hook (if installed) nudges you to re-read the file and update the registry—do it.

## Steps

1. **Read** the changed source and any existing `.ariadne/registry/*_<Symbol>.md` for that file.
2. **Author** a 1–3 sentence English **Purpose** (or add JSDoc on the export in source, then let the CLI pick it up).
3. From the **project root**, run:
   - `npx @koncrate/ariadne-cli update "<relative-or-absolute-path-to-.ts>"`  
   - Or with an explicit purpose: `npx @koncrate/ariadne-cli update "<path>" "<Purpose text>"`  
   - If `ariadne` is on PATH: `ariadne update "<path>"` (same args).
4. Optional full pass: `npx @koncrate/ariadne-cli audit` (or `ariadne audit`), `--json` for scripts.

## Do not

- Use **`ariadne sync`** as the only step when the user needs **agent-quality** Purpose text (sync is batch / mechanical; see project README and rules).
- Paste full function bodies into the registry; **Code Signature** is contract-only. Source remains truth.

## Project rules

If the repo has **`.cursor/rules/ariadne.mdc`**, follow its workflow and content contract; it is the primary contract. This skill does not replace that file.
