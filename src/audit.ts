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
import {
  fingerprintForExportNodes,
  fingerprintStale,
  parseStoredFingerprintFromRegistryFile,
} from './sourceFingerprint';

export type AuditOptions = {
  json?: boolean;
  /**
   * Only rows: missing registry .md or placeholder Purpose (not “no JSDoc only”).
   */
  issuesOnly?: boolean;
  /** Only rows where stored `source_fingerprint` != current export-node digest. */
  staleOnly?: boolean;
  /**
   * Print one relative source path per line (deduped), from the row set after
   * `--issues` / `--stale` filters; no markdown report.
   */
  filesOnly?: boolean;
};

type Row = {
  source: string;
  symbol: string;
  registryPath: string;
  registryExists: boolean;
  sourceHasJSDoc: boolean;
  purposeLooksEmpty: boolean;
  currentFingerprint: string;
  storedFingerprint: string | null;
  fingerprintStale: boolean;
};

function rowNeedsRegistryWork(r: Row): boolean {
  return !r.registryExists || r.purposeLooksEmpty;
}

function computeDisplayRows(
  rows: Row[],
  issuesOnly: boolean,
  staleOnly: boolean
): Row[] {
  if (issuesOnly && staleOnly) {
    return rows.filter(
      (r) => rowNeedsRegistryWork(r) || r.fingerprintStale
    );
  }
  if (issuesOnly) {
    return rows.filter(rowNeedsRegistryWork);
  }
  if (staleOnly) {
    return rows.filter((r) => r.fingerprintStale);
  }
  return rows;
}

/**
 * Compare every local `export` under config globs with `.ariadne/registry` entries.
 * Default: full table. `--issues` / `--stale` narrow rows; `--files` prints deduped paths only.
 */
export async function runAudit(
  cwd: string = process.cwd(),
  options: AuditOptions = {}
) {
  const {
    issuesOnly = false,
    staleOnly = false,
    filesOnly = false,
  } = options;

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
      let body = '';
      if (registryExists) {
        body = await fs.readFile(regFile, 'utf8');
        purposeLooksEmpty = body.includes(ARIADNE_REGISTRY_EMPTY_PURPOSE);
      } else {
        purposeLooksEmpty = true;
      }

      const currentFingerprint = fingerprintForExportNodes(localNodes);
      const storedFingerprint = registryExists
        ? parseStoredFingerprintFromRegistryFile(body)
        : null;
      const fpStale = fingerprintStale(storedFingerprint, currentFingerprint);

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
        currentFingerprint,
        storedFingerprint,
        fingerprintStale: fpStale,
      });
    }
  }

  const displayRows = computeDisplayRows(rows, issuesOnly, staleOnly);

  if (filesOnly) {
    const paths = [...new Set(displayRows.map((r) => r.source))].sort();
    for (const p of paths) {
      console.log(p);
    }
    return;
  }

  const missing = rows.filter((r) => !r.registryExists);
  const needsNarrative = rows.filter(
    (r) => r.registryExists && r.purposeLooksEmpty
  );
  const noJSDocInSource = rows.filter((r) => !r.sourceHasJSDoc);
  const workQueue = rows.filter(rowNeedsRegistryWork);
  const staleRows = rows.filter((r) => r.fingerprintStale);
  const staleOk = rows.length - staleRows.length;

  if (options.json) {
    for (const r of displayRows) {
      console.log(
        JSON.stringify({
          source: r.source,
          symbol: r.symbol,
          registryPath: r.registryPath,
          registryExists: r.registryExists,
          sourceHasJSDoc: r.sourceHasJSDoc,
          purposeLooksEmpty: r.purposeLooksEmpty,
          needsRegistryWork: rowNeedsRegistryWork(r),
          currentFingerprint: r.currentFingerprint,
          storedFingerprint: r.storedFingerprint,
          fingerprintStale: r.fingerprintStale,
        })
      );
    }
    return;
  }

  let tableTitle = '## Rows (all symbols)';
  if (issuesOnly && staleOnly) {
    tableTitle =
      '## Rows (issues OR fingerprint stale: missing / placeholder Purpose / source changed)';
  } else if (issuesOnly) {
    tableTitle =
      '## Rows (issues only: missing registry or placeholder Purpose)';
  } else if (staleOnly) {
    tableTitle =
      '## Rows (fingerprint stale only: source node text changed vs registry)';
  }

  const out: string[] = [
    '# Ariadne audit',
    '',
    `Scanned with \`.ariadne/config.json\` under: \`${cwd}\``,
    '',
  ];

  const showAffected =
    (issuesOnly || staleOnly) && displayRows.length > 0;
  if (showAffected) {
    out.push('---', '', '## Affected source files (deduplicated, for triage)', '');
    const by = new Map<string, number>();
    for (const r of displayRows) {
      by.set(r.source, (by.get(r.source) ?? 0) + 1);
    }
    for (const [src, n] of [...by.entries()].sort((a, b) =>
      a[0].localeCompare(b[0])
    )) {
      out.push(`- \`${src}\` **(${n} symbol(s))**`);
    }
    out.push('', '---', '');
  } else if ((issuesOnly || staleOnly) && displayRows.length === 0) {
    out.push(
      '---',
      '',
      '## Affected source files',
      '',
      '*(no rows match the current filters)*',
      '',
      '---',
      ''
    );
  }

  if (issuesOnly || staleOnly) {
    const parts: string[] = [];
    if (issuesOnly) parts.push('`--issues`');
    if (staleOnly) parts.push('`--stale`');
    out.push(
      `**Mode:** ${parts.join(' and ')} - table lists the filtered subset. Summary below is always for the **full** scan.`,
      ''
    );
  }

  out.push(
    '## Summary',
    '',
    `- Exports in scope: **${rows.length}**`,
    `- **Fingerprint stale** (missing/mismatched \`source_fingerprint\` vs current source nodes): **${staleRows.length}**`,
    `- **Fingerprint up to date**: **${staleOk}**`,
    `- **Needs registry work** (missing file or placeholder Purpose): **${workQueue.length}**`,
    `- registry file **missing**: **${missing.length}**`,
    `- registry exists but **Purpose** is still placeholder: **${needsNarrative.length}**`,
    `- Exports with **no JSDoc in source**: **${noJSDocInSource.length}** *(not implied by \`--issues\`; use full table or JSON to triage)*`,
    '',
    '**Flags:** `ariadne audit` (full table); `--issues` (Purpose/missing); `--stale` (source drift); both together = **OR** filter; `--files` = one source path per line from the filtered set; `--json` with any filter.',
    '',
    tableTitle,
    '',
    '| Source | Symbol | registry .md | exists? | JSDoc? | Purpose placeholder? | fingerprint stale? |',
    '|--------|--------|--------------|--------:|-------:|----------------------:|---------------------:|'
  );

  for (const r of displayRows) {
    out.push(
      `| \`${r.source}\` | \`${r.symbol}\` | \`${r.registryPath}\` | ${r.registryExists ? 'yes' : '**no**'} | ${r.sourceHasJSDoc ? 'yes' : '**no**'} | ${!r.registryExists || r.purposeLooksEmpty ? '**yes**' : 'no'} | ${r.fingerprintStale ? '**yes**' : 'no'} |`
    );
  }

  out.push(
    '',
    '---',
    '',
    '## One-shot task for the Agent (copy below)',
    '',
    '```text',
    'You are helping with an Ariadne registry. Use the table above (respect any `--issues` / `--stale` filter).',
    '',
    '1. Rows with **fingerprint stale = yes**: re-read the **Source** export in the repo; update Purpose / Contract if the behavior changed; then run `ariadne update "<Source path>"` so `source_fingerprint` is refreshed.',
    '2. Rows with **missing registry** or **Purpose placeholder**: write 1-3 sentence English Purpose (or JSDoc on the export), then `ariadne update "<Source path>"`.',
    '3. Prefer JSDoc on stable APIs, then re-run `ariadne update` on affected source files as Purpose catches up to code.',
    '```',
    ''
  );

  console.log(out.join('\n'));
}
