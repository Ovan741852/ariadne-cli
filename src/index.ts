#!/usr/bin/env node
import { Command } from 'commander';
import { initProject } from './init';
import { updateRegistry } from './update';
import { syncFromConfig } from './sync';
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
  .option(
    '--sync',
    '在 init 最後執行 ariadne sync：僅機械批掃產生骨架（非 Agent 代寫 desc，可與 -y 併用）'
  )
  .action((opts: { ide: string; yes?: boolean; sync?: boolean }) =>
    initProject({
      ide: opts.ide,
      yes: Boolean(opts.yes),
      sync: Boolean(opts.sync),
    })
  );

program
  .command('update <filepath> [purpose]')
  .description('解析指定檔案並更新至註冊表（路徑須符合 .ariadne/config.json）')
  .action(updateRegistry);

program
  .command('sync')
  .description(
    'Batch re-index: signatures + JSDoc/placeholder only (not agent-written desc; prefer update + hook)'
  )
  .action(async () => {
    await syncFromConfig();
  });

program
  .command('audit')
  .description(
    'List all exports vs registry: gaps + placeholder Purposes; paste output to the agent for a full pass'
  )
  .option('--json', 'One JSON object per symbol on stdout (for scripts)')
  .action(async (opts: { json?: boolean }) => {
    await runAudit(process.cwd(), { json: Boolean(opts.json) });
  });

program.parse(process.argv);