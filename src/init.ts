import * as fs from 'fs-extra';
import * as path from 'path';

export async function initProject() {
  const cwd = process.cwd();
  const registryDir = path.join(cwd, '.ariadne', 'registry');
  const cursorRulesDir = path.join(cwd, '.cursor', 'rules');

  try {
    // 建立目錄
    await fs.ensureDir(registryDir);
    await fs.ensureDir(cursorRulesDir);

    // 複製 mdc 範本 (從打包後的目錄抓取)
    const templatePath = path.join(__dirname, 'ariadne.mdc');
    const targetRulePath = path.join(cursorRulesDir, 'ariadne.mdc');

    if (await fs.pathExists(templatePath)) {
      await fs.copyFile(templatePath, targetRulePath);
      console.log('✅ 成功建立 .ariadne/registry 目錄');
      console.log('✅ 成功寫入 Cursor 規範: .cursor/rules/ariadne.mdc');
    } else {
      console.error('❌ 找不到範本檔:', templatePath);
    }
  } catch (err) {
    console.error('❌ 初始化失敗:', err);
  }
}