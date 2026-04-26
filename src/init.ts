import * as fs from 'fs-extra';
import * as path from 'path';
import { createInterface } from 'node:readline/promises';
import {
  getDefaultConfigJsonString,
  CONFIG_RELATIVE,
  configToJsonString,
  DEFAULT_ARIADNE_CONFIG,
  type AriadneConfig,
} from './config';

const SUPPORTED_IDE = new Set<string>(['cursor']);

/**
 * Options for `initProject`: target IDE and non-interactive `-y` mode.
 */
export type InitOptions = {
  ide: string;
  /** 不詢問 config，直接寫入內建 include/exclude */
  yes: boolean;
};

function normalizeIde(raw: string | undefined): string {
  return (raw ?? 'cursor').trim().toLowerCase() || 'cursor';
}

function splitGlobs(input: string): string[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 在互動式終端中詢問使用者，產生要寫入的 config JSON。
 */
async function promptForNewConfigInteractive(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const line1 = await rl.question(
      '\n將建立 .ariadne/config.json（定義 `ariadne update` 能處理哪些檔案）。\n' +
        '使用內建建議（**/*.ts、**/*.tsx，並排除測試、node_modules、dist 等）？ [Y/n] '
    );
    const a1 = line1.trim();
    if (a1 === '' || /^y(es)?$/i.test(a1) || a1 === 'Y') {
      return getDefaultConfigJsonString();
    }

    const line2 = await rl.question(
      '請輸入 **include** glob，多個以**英文逗號**分隔 [預設與內建相同]:\n' +
        '  例：**/*.ts,**/*.tsx\n' +
        '> '
    );
    const include = splitGlobs(line2);
    if (include.length === 0) {
      console.log('ℹ️ 未填寫，採用內建 include。');
      return getDefaultConfigJsonString();
    }

    const line3 = await rl.question(
      '請輸入 **exclude** glob，多個以逗號分隔 [直接按 Enter ＝內建整組排除]:\n' +
        '  例：**/node_modules/**,**/*.test.ts\n' +
        '> '
    );
    const exclude = splitGlobs(line3);
    const cfg: AriadneConfig = {
      schema: '1',
      update: {
        include,
        exclude:
          exclude.length > 0
            ? exclude
            : [...DEFAULT_ARIADNE_CONFIG.update.exclude],
      },
    };
    return configToJsonString(cfg);
  } finally {
    await rl.close();
  }
}

/**
 * Scaffolds `.ariadne`, registry dir, `.cursor` rules, hooks, and the ariadne-registry skill.
 */
export async function initProject(options: InitOptions) {
  const ide = normalizeIde(options.ide);
  if (!SUPPORTED_IDE.has(ide)) {
    const allowed = [...SUPPORTED_IDE].join(', ');
    console.error(`❌ 不支援的 IDE: "${options.ide}"。目前僅提供: ${allowed}。`);
    process.exit(1);
  }

  const cwd = process.cwd();
  const ariadneDir = path.join(cwd, '.ariadne');
  const registryDir = path.join(ariadneDir, 'registry');
  const configPath = path.join(cwd, CONFIG_RELATIVE);
  const cursorDir = path.join(cwd, '.cursor');
  const cursorRulesDir = path.join(cursorDir, 'rules');
  const cursorHooksDir = path.join(cursorDir, 'hooks');
  const cursorSkillDir = path.join(
    cursorDir,
    'skills',
    'ariadne-registry'
  );
  const skipPrompt = options.yes || process.env.CI === 'true' || process.env.CI === '1';

  try {
    await fs.ensureDir(ariadneDir);
    await fs.ensureDir(registryDir);
    await fs.ensureDir(cursorRulesDir);
    await fs.ensureDir(cursorHooksDir);
    await fs.ensureDir(cursorSkillDir);

    if (!(await fs.pathExists(configPath))) {
      let body: string;
      if (skipPrompt) {
        body = getDefaultConfigJsonString();
      } else if (process.stdin.isTTY) {
        body = await promptForNewConfigInteractive();
      } else {
        body = getDefaultConfigJsonString();
        console.log('ℹ️ 非互動式終端，已以內建預設建立 .ariadne/config.json。');
      }
      await fs.writeFile(configPath, body, 'utf8');
      console.log('✅ 已建立 .ariadne/config.json（可之後手動再改 include / exclude）');
    } else {
      console.log('ℹ️ 已存在 .ariadne/config.json，已略過覆寫。');
    }

    const mdcFrom = path.join(__dirname, 'ariadne.mdc');
    const mdcTo = path.join(cursorRulesDir, 'ariadne.mdc');
    if (await fs.pathExists(mdcFrom)) {
      await fs.copyFile(mdcFrom, mdcTo);
      console.log('✅ 成功建立 .ariadne/registry 目錄');
      console.log('✅ 成功寫入 Cursor 規範: .cursor/rules/ariadne.mdc');
    } else {
      console.error('❌ 找不到範本檔:', mdcFrom);
    }

    const hookScriptFrom = path.join(
      __dirname,
      'cursor',
      'hooks',
      'ariadne-post-tool-use.cjs'
    );
    const hookScriptTo = path.join(
      cursorHooksDir,
      'ariadne-post-tool-use.cjs'
    );
    if (await fs.pathExists(hookScriptFrom)) {
      if (!(await fs.pathExists(hookScriptTo))) {
        await fs.copyFile(hookScriptFrom, hookScriptTo);
        console.log(
          '✅ 已安裝 Cursor hook: .cursor/hooks/ariadne-post-tool-use.cjs（postToolUse → 提示 Agent 補述）'
        );
      } else {
        console.log('ℹ️ 已存在 .cursor/hooks/ariadne-post-tool-use.cjs，已略過覆寫。');
      }
    } else {
      console.error('❌ 找不到 hook 腳本:', hookScriptFrom);
    }

    const hooksJsonFrom = path.join(__dirname, 'cursor', 'hooks.json');
    const hooksJsonTo = path.join(cwd, '.cursor', 'hooks.json');
    if (await fs.pathExists(hooksJsonFrom)) {
      if (!(await fs.pathExists(hooksJsonTo))) {
        await fs.copyFile(hooksJsonFrom, hooksJsonTo);
        console.log(
          '✅ 已寫入 .cursor/hooks.json（postToolUse 向 Agent 注入 Ariadne 補述提示）'
        );
      } else {
        console.log(
          'ℹ️ 已存在 .cursor/hooks.json，已略過。若你已有自訂 hooks，請手動在該檔的 postToolUse 加入 ariadne 腳本。'
        );
      }
    } else {
      console.error('❌ 找不到範本:', hooksJsonFrom);
    }

    const skillFrom = path.join(
      __dirname,
      'cursor',
      'skills',
      'ariadne-registry',
      'SKILL.md'
    );
    const skillTo = path.join(cursorSkillDir, 'SKILL.md');
    if (await fs.pathExists(skillFrom)) {
      if (!(await fs.pathExists(skillTo))) {
        await fs.copyFile(skillFrom, skillTo);
        console.log(
          '✅ 已安裝 Cursor Agent skill: .cursor/skills/ariadne-registry/SKILL.md（觸發時知道要跑 ariadne update 維護 registry）'
        );
      } else {
        console.log(
          'ℹ️ 已存在 .cursor/skills/ariadne-registry/SKILL.md，已略過覆寫。'
        );
      }
    } else {
      console.error('❌ 找不到 skill 範本:', skillFrom);
    }
  } catch (err) {
    console.error('❌ 初始化失敗:', err);
  }
}
