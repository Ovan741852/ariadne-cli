import fg from 'fast-glob';
import { Project } from 'ts-morph';
import * as fs from 'fs-extra';
import * as path from 'path';
import { loadAriadneConfig } from './config';
import { ARIADNE_REGISTRY_EMPTY_PURPOSE } from './update';
import {
  listRegistryExportItems,
  pickJSDocDescription,
  safeRegistryFileName,
} from './exportRegistry';

export type AuditOptions = {
  /** JSON line per row to stdout (for scripts) */
  json?: boolean;
};

type Row = {
  source: string;
  symbol: string;
  registryPath: string;
  registryExists: boolean;
  sourceHasJSDoc: boolean;
  purposeLooksEmpty: boolean;
};

/**
 * Compare every resolvable `export` (see `listRegistryExportItems`) under config
 * globs with `.ariadne/registry` entries
 * and print a report + a block the user can paste to an agent for one-shot review.
 */
export async function runAudit(
  cwd: string = process.cwd(),
  options: AuditOptions = {}
) {
  const config = await loadAriadneConfig(cwd);
  const relPaths = await fg(config.update.include, {
    cwd,
    absolute: true,
    onlyFiles: true,
    unique: true,
    ignore: config.update.exclude,
  });

  const registryDir = path.join(cwd, '.ariadne', 'registry');
  const rows: Row[] = [];

  for (const abs of relPaths) {
    const rel = path.relative(cwd, abs).split(path.sep).join('/');
    const project = new Project();
    let sourceFile;
    try {
      sourceFile = project.addSourceFileAtPath(abs);
    } catch {
      continue;
    }
    const exportables = listRegistryExportItems(sourceFile);

    const fileNameKey = path.parse(rel).name;

    for (const ex of exportables) {
      const { name, localNodes } = ex;
      const hasJSDoc = Boolean(pickJSDocDescription(localNodes));
      const regFile = path.join(
        registryDir,
        `${fileNameKey}_${safeRegistryFileName(name)}.md`
      );
      const registryExists = fs.existsSync(regFile);
      let purposeLooksEmpty = true;
      if (registryExists) {
        const body = await fs.readFile(regFile, 'utf8');
        purposeLooksEmpty = body.includes(ARIADNE_REGISTRY_EMPTY_PURPOSE);
      } else {
        purposeLooksEmpty = true;
      }

      rows.push({
        source: rel,
        symbol: name,
        registryPath: path
          .relative(cwd, regFile)
          .split(path.sep)
          .join('/'),
        registryExists,
        sourceHasJSDoc: hasJSDoc,
        purposeLooksEmpty,
      });
    }
  }

  const missing = rows.filter((r) => !r.registryExists);
  const needsNarrative = rows.filter(
    (r) => r.registryExists && r.purposeLooksEmpty
  );
  const noJSDocInSource = rows.filter((r) => !r.sourceHasJSDoc);

  if (options.json) {
    for (const r of rows) {
      console.log(
        JSON.stringify({
          source: r.source,
          symbol: r.symbol,
          registryPath: r.registryPath,
          registryExists: r.registryExists,
          sourceHasJSDoc: r.sourceHasJSDoc,
          purposeLooksEmpty: r.purposeLooksEmpty,
        })
      );
    }
    return;
  }

  const lines: string[] = [
    '# Ariadne audit',
    '',
    `Scanned with \`.ariadne/config.json\` under: \`${cwd}\``,
    '',
    '## Summary',
    '',
    `- Exports found: **${rows.length}**`,
    `- Registry file **missing**: **${missing.length}**`,
    `- Registry exists but **Purpose** still the placeholder \`No JSDoc summary\` / not improved: **${needsNarrative.length}**`,
    `- Exports with **no JSDoc in source** (add JSDoc or set Purpose via \`update\`): **${noJSDocInSource.length}**`,
    '',
    '## Rows (all symbols)',
    '',
    '| Source | Symbol | registry .md | exists? | JSDoc in source? | Purpose is placeholder? |',
    '|--------|--------|--------------|--------:|-----------------:|------------------------:|',
  ];

  for (const r of rows) {
    lines.push(
      `| \`${r.source}\` | \`${r.symbol}\` | \`${r.registryPath}\` | ${r.registryExists ? 'yes' : '**no**'} | ${r.sourceHasJSDoc ? 'yes' : '**no**'} | ${!r.registryExists || r.purposeLooksEmpty ? '**yes (needs review)**' : 'no'} |`
    );
  }

  lines.push(
    '',
    '---',
    '',
    '## One-shot task for the Agent (copy below)',
    '',
    '```text',
    'You are helping with an Ariadne registry. The table above is authoritative.',
    '',
    '1. For every row with registry **missing** or **Purpose is placeholder = yes (needs review)**:',
    '   - Open the **Source** file, read the export, and write a 1–3 sentence English **Purpose** per the contract in .cursor/rules/ariadne.mdc.',
    '2. For each, run:  ariadne update "<Source path>" "<Purpose>"',
    '   Or add JSDoc on the export in source, then:  ariadne update "<Source path>"  (no literal purpose) so the CLI takes JSDoc.',
    '3. Prefer fixing **Source** with JSDoc for symbols that are stable APIs.',
    '4. Do not run ariadne sync to replace this workflow unless the user only wants a mechanical skeleton.',
    '```',
    ''
  );

  console.log(lines.join('\n'));
}
