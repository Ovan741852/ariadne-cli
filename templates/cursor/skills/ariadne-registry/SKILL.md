---
name: ariadne-registry
description: >-
  Maintains the Ariadne registry under .ariadne/registry for TypeScript public
  exports. Use when the user or context changes exported APIs, JSDoc, registry
  Purpose, ariadne update, .ariadne, or Ariadne audit.
---

# Ariadne registry

## Why

Exports that others can import should have a **locatable** entry under `.ariadne/registry/` (one **export** per registry `.md`, per the project’s Ariadne rules and `ariadne update` behavior). The CLI does not call an LLM; the agent authors **Purpose** and keeps entries aligned with source.

## How the registry is meant to evolve

Ariadne is designed so the registry is often **incomplete or placeholder-heavy** at first (signatures and JSDoc/placeholders, not polished prose). Treat that as **normal**: the machine side gives you a **worklist**; the agent (or human) **reads the real source** and tightens each entry over time.

- **`ariadne audit`**: **full reconciling pass** for everything in `include`/`exclude`—**one table row per local export** (source + symbol + registry + flags including **fingerprint stale** when `source_fingerprint` disagrees with the current AST node text). **`ariadne audit --stale`** narrows to symbols whose **source changed** since the last `update` (or missing fingerprint). **`ariadne audit --issues`** narrows to **missing** registry files or **placeholder** Purpose. **`--issues` + `--stale`** uses a **union** filter. **`ariadne audit --files --stale`** (or with `--issues`) prints **one source path per line** so you know which `.ts` files to open next. It **does not** write or rewrite `.md`; it is only a **worklist**. Use **`--json`** for scripting.
- **Per-file `ariadne update`**: the **only** CLI that **writes** registry files and `source_fingerprint`—use after you have read the source and can pass a 1–3 sentence Purpose (or good JSDoc in source). **Re-read source → new Purpose (or JSDoc) → `update`** is how to clear **stale** in a way that keeps narrative quality.

## When to use this skill

- After **Write** / edits to files that **export** symbols covered by `.ariadne/config.json` (include / exclude).
- The user asks to refresh the registry, fix **audit** gaps, or run **`ariadne update`** / **`ariadne audit`**.
- A **postToolUse** hook (if installed) may nudge you—treat that as a reminder only. **`.cursor/rules/ariadne.mdc` still requires** Purpose (or JSDoc) and **`update`** when hooks are missing, disabled, or unsupported (Tab vs Chat, CI, older Cursor, etc.); do not skip the registry in those cases.

## Steps

1. **Read** the changed source and any existing `.ariadne/registry/*_<Symbol>.md` for that file.
2. **Author** a 1–3 sentence English **Purpose** (or add JSDoc on the export in source, then let the CLI pick it up).
3. From the **project root**, run:
   - `npx @koncrate/ariadne-cli update "<path-to-.ts>"` **only if** every local export in that file already has a JSDoc description; otherwise the CLI **exits with an error** and lists which symbols need JSDoc **or** you pass one purpose for the whole file:  
   - `npx @koncrate/ariadne-cli update "<path>" "1–3 sentence English Purpose"` (same text **every** export in that file).  
   - If `ariadne` is on PATH, same: `ariadne update "<path>"` (JSDoc everywhere) or `ariadne update "<path>" "…"`.
4. **When the user asks to refresh the registry repo-wide, clear stale rows, or “update everything”** — use this **fixed script** from the **project root** (teams can require agents to follow it verbatim):
   1. Run: `npx @koncrate/ariadne-cli audit --files --stale` (add `--issues` if you also want **missing** registry or **placeholder** Purpose rows in the worklist: filters **union** with `--stale`).
   2. For **each** path printed (one per line, no markdown), **`read`** the source `.ts`/`.tsx` and the matching `.ariadne/registry/*_<Symbol>.md` for that file.
   3. Re-understand changed exports, fix **Purpose** and/or **JSDoc** as needed.
   4. Run **once per file** after the file has **JSDoc on every export** (or one shared CLI Purpose): `npx @koncrate/ariadne-cli update "<path>"` or `npx @koncrate/ariadne-cli update "<path>" "Whole-file Purpose"`. A bare `update` with no JSDoc and no second **fails**; fix the file first.
   5. Optionally run a full `ariadne audit` again to confirm no rows remain that you care about.

   Same with global install: `ariadne audit --files --stale` → per-file `read` → per-file `ariadne update "<path>"`. **`audit` never writes** `.md`; only **`update`** does.

## Do not

- Expect **`ariadne audit`** alone to update the registry: it only **lists**; you still need **`update`** per source file to write **Purpose** and `source_fingerprint`.
- Run **`update "<path>"`** (no second argument) when **any** export in that file still lacks JSDoc—the command will **fail** on purpose. Add JSDoc to each symbol **or** pass `update "<path>" "shared Purpose"`.
- Paste full function bodies into the registry; **Code Signature** is contract-only. Source remains truth.

## Project rules

If the repo has **`.cursor/rules/ariadne.mdc`**, follow its workflow and content contract; it is the primary contract. This skill does not replace that file.
