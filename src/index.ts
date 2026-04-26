#!/usr/bin/env node
import { Command } from 'commander';
import { initProject } from './init';
import { updateRegistry } from './update';

const program = new Command();

program
  .name('ariadne')
  .description('Ariadne - The AI Context Registry for Daedalus')
  .version('1.0.0');

program
  .command('init')
  .description('初始化 Ariadne 環境 (建立 .ariadne 與 .cursor/rules)')
  .action(initProject);

program
  .command('update <filepath> [purpose]')
  .description('解析指定檔案並更新至註冊表')
  .action(updateRegistry);

program.parse(process.argv);