#!/usr/bin/env node
import { Command } from 'commander';
import { initProject } from './init';
import { updateRegistry } from './update';
import { syncFromConfig } from './sync';

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
    '在 init 最後執行 `ariadne sync` 建立 registry（不經 TTY 詢問，可與 -y 併用）'
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
  .description('依 .ariadne/config.json 掃描專案，批次註冊符合的檔案')
  .action(async () => {
    await syncFromConfig();
  });

program.parse(process.argv);