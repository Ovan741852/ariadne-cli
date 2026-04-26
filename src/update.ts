import { Project } from 'ts-morph';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
  loadAriadneConfig,
  toProjectRelative,
  isPathAllowedByConfig,
} from './config';
import {
  listRegistryExportItems,
  pickJSDocDescription,
  contractHints,
  safeRegistryFileName,
  type RegistryExportTypeTag,
} from './exportRegistry';
import { fingerprintForExportNodes } from './sourceFingerprint';

export type { RegistryExportTypeTag };

/** @deprecated use listRegistryExportItems in ./exportRegistry */
export { listRegistryExportItems as listExportableFunctionOrClass } from './exportRegistry';

/** When the user did not pass `[purpose]`, we prefer JSDoc; this string is the internal sentinel. */
export const ARIADNE_DEFAULT_CLI_PURPOSE = '(cli purpose not provided)';
/** Shown in generated `.md` when an export has no JSDoc; `audit` matches this to flag work. */
export const ARIADNE_REGISTRY_EMPTY_PURPOSE = 'No JSDoc summary.';

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
    const items = listRegistryExportItems(sourceFile);

    if (items.length === 0) {
      console.log(
        `⚠️ 在 ${rel} 中沒有可註冊的本檔匯出（僅 re-export barrel、\`export * from '...'\`、或 \`export =\` 等會略過）。`
      );
      return true;
    }

    const fileNameKey = path.parse(rel).name;
    const relpos = rel.split(path.sep).join('/');

    for (const it of items) {
      const { name, type, codeSignature, localNodes } = it;
      const js = pickJSDocDescription(localNodes);
      const jsDoc =
        js || ARIADNE_REGISTRY_EMPTY_PURPOSE;
      const purposeBody =
        purpose !== ARIADNE_DEFAULT_CLI_PURPOSE ? purpose : jsDoc;
      const { importHint, inputHint, outputHint } = contractHints(type, name);
      const typeTag: RegistryExportTypeTag = type;

      const safeFile = safeRegistryFileName(name);
      const sourceFingerprint = fingerprintForExportNodes(localNodes);
      const mdContent = `---
id: "${fileNameKey}.${name.replace(/"/g, '\\"')}"
type: "${typeTag}"
source: "${relpos.replace(/"/g, '\\"')}"
source_fingerprint: "${sourceFingerprint}"
error_codes: "n/a"
dependencies: "n/a"
---

# ${name}

**Source:** \`${relpos}\`

## Purpose
${purposeBody}

## Code Signature (contract, not full body)
\`\`\`typescript
${codeSignature}
\`\`\`

## Contract (import / name / value domain)
Renders best when the signature alone (e.g. a large inline props type) is ambiguous. Flesh out for consumers: **how to import or call**, **name**, **input bounds**, **output / return domain**.

- **How to import or call (pattern):** n/a *— ${importHint}*
- **Exported symbol:** \`${name}\`
- **Input value domain (types, allowed set, invariants):** n/a *— ${inputHint}*
- **Output / return value domain:** n/a *— ${outputHint}*

## error codes & reasons
- n/a *— when stable, list \`code\` or category → **reason** (and align short codes in YAML \`error_codes\` above, if you replace \`"n/a"\` there).*
`;

      const outPath = path.join(registryDir, `${fileNameKey}_${safeFile}.md`);
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
