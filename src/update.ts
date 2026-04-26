import { Project } from 'ts-morph';
import type { FunctionDeclaration } from 'ts-morph';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
  loadAriadneConfig,
  toProjectRelative,
  isPathAllowedByConfig,
} from './config';

/** When the user did not pass `[purpose]`, we prefer JSDoc; this string is the internal sentinel. */
export const ARIADNE_DEFAULT_CLI_PURPOSE = '(cli purpose not provided)';
/** Shown in generated `.md` when an export has no JSDoc; `audit` matches this to flag work. */
export const ARIADNE_REGISTRY_EMPTY_PURPOSE = 'No JSDoc summary.';

function getSignatureContractText(fn: FunctionDeclaration): string {
  const body = fn.getBody();
  const fileText = fn.getSourceFile().getFullText();
  if (body) {
    return fileText
      .slice(fn.getStart(), body.getStart())
      .replace(/\s+$/, '')
      .trimEnd();
  }
  return fn.getText().trim();
}

export type RunUpdateOptions = {
  /** 單檔 update 時做規範校驗；sync 已以 glob 篩過則關掉 */
  checkConfig?: boolean;
};

/**
 * 解析一個專案內檔案並寫入 registry。filepath 可為相對專案根之字串。
 */
export async function runUpdateFile(
  cwd: string,
  filepath: string,
  purpose: string = ARIADNE_DEFAULT_CLI_PURPOSE,
  options: RunUpdateOptions = {}
) {
  const { checkConfig = true } = options;
  const abs = path.resolve(cwd, filepath);

  if (!fs.existsSync(abs)) {
    console.error(`❌ 找不到檔案: ${abs}`);
    return false;
  }

  const rel = toProjectRelative(cwd, abs);
  if (rel == null) {
    console.error(`❌ 路徑必須在專案目錄內: ${filepath}`);
    return false;
  }

  const config = await loadAriadneConfig(cwd);
  if (checkConfig && !isPathAllowedByConfig(rel, config)) {
    console.error(
      `❌ 此檔案不符合專案 update 範圍: ${rel}\n   可編輯 ${path.join(
        '.ariadne',
        'config.json'
      )} 的 include / exclude。`
    );
    return false;
  }

  const registryDir = path.join(cwd, '.ariadne', 'registry');
  await fs.ensureDir(registryDir);

  try {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(abs);
    const functions = sourceFile
      .getFunctions()
      .filter((f) => f.isExported() && f.getName() != null);

    if (functions.length === 0) {
      console.log(`⚠️ 在 ${rel} 中沒有找到匯出函式（export function）。`);
      return true;
    }

    const fileNameKey = path.parse(rel).name;
    const relpos = rel.split(path.sep).join('/');

    for (const func of functions) {
      const name = func.getName()!;
      const jsDoc =
        func.getJsDocs()[0]?.getDescription().trim() ||
        ARIADNE_REGISTRY_EMPTY_PURPOSE;
      const contractHead = getSignatureContractText(func);
      const purposeBody =
        purpose !== ARIADNE_DEFAULT_CLI_PURPOSE ? purpose : jsDoc;
      const mdContent = `---
id: "${fileNameKey}.${name}"
type: "Function"
source: "${relpos.replace(/"/g, '\\"')}"
error_codes: "n/a"
dependencies: "n/a"
---

# ${name}

**Source:** \`${relpos}\`

## Purpose
${purposeBody}

## Code Signature (contract, not full body)
\`\`\`typescript
${contractHead}
\`\`\`

## Contract (import / name / value domain)
Renders best when the signature alone (e.g. a large inline props type) is ambiguous. Flesh out for consumers: **how to import or call**, **name**, **input bounds**, **output / return domain**.

- **How to import or call (pattern):** n/a *— e.g. \`import { ${name} } from '...'\` or the intended usage shape; default vs named.*
- **Exported symbol:** \`${name}\`
- **Input value domain (types, allowed set, invariants):** n/a *— props/args, numeric ranges, unions, "must be" rules.*
- **Output / return value domain:** n/a *— return type, rendered subtree contract, or side-effect summary.*

## error codes & reasons
- n/a *— when stable, list \`code\` or category → **reason** (and align short codes in YAML \`error_codes\` above, if you replace \`"n/a"\` there).*
`;

      const outPath = path.join(registryDir, `${fileNameKey}_${name}.md`);
      await fs.writeFile(outPath, mdContent);
      console.log(`✅ 已註冊: ${name} -> ${outPath}`);
    }
    return true;
  } catch (err) {
    console.error(`❌ 解析或寫入失敗 (${rel}):`, err);
    return false;
  }
}

/**
 * CLI：`ariadne update` 的 handler
 */
export async function updateRegistry(
  filepath: string,
  purpose: string = ARIADNE_DEFAULT_CLI_PURPOSE
) {
  const cwd = process.cwd();
  const ok = await runUpdateFile(cwd, filepath, purpose, { checkConfig: true });
  if (ok === false) {
    process.exit(1);
  }
}
