import { Project } from 'ts-morph';
import * as fs from 'fs-extra';
import * as path from 'path';

export async function updateRegistry(filepath: string, purpose: string = "未提供具體用途") {
  const cwd = process.cwd();
  const targetFile = path.resolve(cwd, filepath);
  const registryDir = path.join(cwd, '.ariadne', 'registry');

  if (!fs.existsSync(targetFile)) {
    console.error(`❌ 找不到檔案: ${targetFile}`);
    return;
  }

  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(targetFile);
  const functions = sourceFile.getFunctions().filter(f => f.isExported());
  
  if (functions.length === 0) {
    console.log(`⚠️ 在 ${filepath} 中沒有找到 Export 的 Function。`);
    return;
  }

  await fs.ensureDir(registryDir);

  for (const func of functions) {
    const name = func.getName();
    if (!name) continue;

    const jsDoc = func.getJsDocs()[0]?.getDescription().trim() || "尚無說明";
    const signature = func.getSignature().getDeclaration().getText();
    const fileNameKey = path.parse(filepath).name;

    const mdContent = `---
id: "${fileNameKey}.${name}"
type: "Function"
---

# ${name}

## Purpose (用途)
${purpose !== "未提供具體用途" ? purpose : jsDoc}

## Code Signature
\`\`\`typescript
${signature}
\`\`\`
`;

    const outPath = path.join(registryDir, `${fileNameKey}_${name}.md`);
    await fs.writeFile(outPath, mdContent);
    console.log(`✅ 已註冊: ${name} -> ${outPath}`);
  }
}