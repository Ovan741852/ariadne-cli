import { minimatch } from 'minimatch';
import * as fs from 'fs-extra';
import * as path from 'path';

export const CONFIG_RELATIVE = path.join('.ariadne', 'config.json');

export type AriadneConfig = {
  /** 設定檔版本，未來變更可據此遷移 */
  schema: string;
  update: {
    /** minimatch 樣式，相對專案根。符合任一即視為可 update */
    include: string[];
    /** 從掃描／單檔 update 排除，優先於 include */
    exclude: string[];
  };
};

export const DEFAULT_ARIADNE_CONFIG: AriadneConfig = {
  schema: '1',
  update: {
    include: ['**/*.ts', '**/*.tsx'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.ariadne/**',
      '**/.git/**',
      '**/*.d.ts',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/__tests__/**',
    ],
  },
};

/**
 * 讀取專案內 Ariadne 設定；沒有檔案則回傳內建預設（不作磁碟寫入）。
 */
export async function loadAriadneConfig(
  cwd: string
): Promise<AriadneConfig> {
  const p = path.join(cwd, CONFIG_RELATIVE);
  if (await fs.pathExists(p)) {
    const raw = (await fs.readJson(p)) as Partial<AriadneConfig>;
    return {
      schema: raw.schema ?? DEFAULT_ARIADNE_CONFIG.schema,
      update: {
        include:
          raw.update?.include && raw.update.include.length > 0
            ? raw.update.include
            : DEFAULT_ARIADNE_CONFIG.update.include,
        exclude:
          raw.update?.exclude && raw.update.exclude.length > 0
            ? raw.update.exclude
            : DEFAULT_ARIADNE_CONFIG.update.exclude,
      },
    };
  }
  return { ...DEFAULT_ARIADNE_CONFIG, update: { ...DEFAULT_ARIADNE_CONFIG.update } };
}

export function toProjectRelative(
  cwd: string,
  absolute: string
): string | null {
  const rel = path.relative(cwd, path.resolve(absolute));
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    return null;
  }
  return rel.split(path.sep).join('/');
}

const minimatchFlags = { dot: true, nocase: false } as const;

/**
 * 先套用 exclude，再比對 include；皆為 minimatch。
 */
export function isPathAllowedByConfig(
  projectRelativePosix: string,
  config: AriadneConfig
): boolean {
  const p = projectRelativePosix;
  for (const ex of config.update.exclude) {
    if (minimatch(p, ex, minimatchFlags)) {
      return false;
    }
  }
  for (const inc of config.update.include) {
    if (minimatch(p, inc, minimatchFlags)) {
      return true;
    }
  }
  return false;
}

/**
 * 供 init 寫入專案預設規範
 */
export function getDefaultConfigJsonString(): string {
  return configToJsonString(DEFAULT_ARIADNE_CONFIG);
}

export function configToJsonString(config: AriadneConfig): string {
  return JSON.stringify(config, null, 2) + '\n';
}
