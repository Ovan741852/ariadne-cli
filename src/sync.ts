import fg from 'fast-glob';
import * as path from 'path';
import { loadAriadneConfig } from './config';
import { ARIADNE_DEFAULT_CLI_PURPOSE, runUpdateFile } from './update';

/**
 * 依 .ariadne/config.json 的 include / exclude 掃描專案並註冊可解析的匯出函式。
 * 不會「替 Agent 寫」自然語言 Purpose，只會用 JSDoc 或 CLI 預設佔位；與產品主線「讀源碼 → 寫 desc → update」分開。
 */
export async function syncFromConfig(cwd: string = process.cwd()) {
  console.log(
    [
      '┌ Ariadne sync (batch / mechanical) ─────────────────────────────',
      '│ This only extracts signatures + JSDoc (or a placeholder).',
      '│ It does NOT write agent-quality descriptions for every symbol.',
      '│ For good Purpose text: have the agent read the code, then use',
      '│   ariadne update <file> "<purpose>"   or   add JSDoc and re-run.',
      '│ Use sync for cold start / CI skeleton, not as the main "semantic sync".',
      '└──────────────────────────────────────────────────────────────',
      '',
    ].join('\n')
  );

  const config = await loadAriadneConfig(cwd);
  const relPaths = await fg(config.update.include, {
    cwd,
    absolute: true,
    onlyFiles: true,
    unique: true,
    ignore: config.update.exclude,
  });

  if (relPaths.length === 0) {
    console.log('ℹ️ No files matched .ariadne/config.json (include / exclude).');
    return;
  }

  for (const abs of relPaths) {
    const rel = path.relative(cwd, abs).split(path.sep).join('/');
    await runUpdateFile(cwd, rel, ARIADNE_DEFAULT_CLI_PURPOSE, {
      checkConfig: false,
    });
  }

  console.log(
    `\n✅ Sync: processed ${relPaths.length} file(s) (skeleton only — review purposes or re-run with JSDoc / per-file update).`
  );
}
