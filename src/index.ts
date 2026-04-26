#!/usr/bin/env node
import { Command } from 'commander';
import { initProject } from './init';
import { updateRegistry } from './update';
import { runAudit } from './audit';

const program = new Command();

program
  .name('ariadne')
  .description('Ariadne - The AI Context Registry for Daedalus')
  .version('1.0.0');

program
  .command('init')
  .description('初始化 Ariadne 環境（.ariadne/registry 與 IDE 規則；目前僅 Cursor）')
  .option('--ide <name>', '目標 IDE（僅實作 cursor，預設 cursor）', 'cursor')
  .option(
    '-y, --yes',
    '略過關於 .ariadne/config.json 的互動，直接採用內建 include/exclude'
  )
  .action((opts: { ide: string; yes?: boolean }) =>
    initProject({
      ide: opts.ide,
      yes: Boolean(opts.yes),
    })
  );

program
  .command('update <filepath> [purpose]')
  .description('解析指定檔案並更新至註冊表（路徑須符合 .ariadne/config.json）')
  .action(updateRegistry);

program
  .command('audit')
  .description(
    'Full scan vs registry: counts + table. --issues (Purpose/missing), --stale (source_fingerprint drift), --files (paths only), --json'
  )
  .option('--json', 'One JSON object per symbol on stdout (for scripts)')
  .option(
    '--issues',
    'Only rows: missing registry .md or placeholder Purpose (OR with --stale: union filter)'
  )
  .option(
    '--stale',
    'Only rows where source_fingerprint is missing or != hash of current export AST nodes'
  )
  .option(
    '--files',
    'Print deduplicated source paths (one per line) for the row set after --issues/--stale; no markdown'
  )
  .action(
    async (opts: {
      json?: boolean;
      issues?: boolean;
      stale?: boolean;
      files?: boolean;
    }) => {
      await runAudit(process.cwd(), {
        json: Boolean(opts.json),
        issuesOnly: Boolean(opts.issues),
        staleOnly: Boolean(opts.stale),
        filesOnly: Boolean(opts.files),
      });
    }
  );

program.parse(process.argv);