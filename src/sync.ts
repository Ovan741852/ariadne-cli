import fg from 'fast-glob';
import * as path from 'path';
import { loadAriadneConfig } from './config';
import { ARIADNE_DEFAULT_CLI_PURPOSE, runUpdateFile } from './update';

/**
 * 依 .ariadne/config.json 的 include / exclude 掃描專案並註冊可解析的匯出函式。
 * 不強制在 sync 內重複做路徑規範檢查（已先由 glob 篩選）。
 */
export async function syncFromConfig(cwd: string = process.cwd()) {
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

  console.log(`\n✅ Sync: processed ${relPaths.length} file(s).`);
}
