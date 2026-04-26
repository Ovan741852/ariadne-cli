# Ariadne CLI

在專案裡建立**可機讀的語意註冊與 Schema 索引**，讓 Cursor 等工具能照著既有邏輯與 API 約束開發，減少憑空杜撰的實作路徑。

- 以 **TypeScript AST**（[ts-morph](https://github.com/dsherret/ts-morph)）擷取已匯出函式的簽名與 JSDoc  
- 將 `update` 時可選的**用途說明**寫入註冊內容  
- 產出 **RAG 友善**的 Markdown 置於 `.ariadne/registry/`，搭配 `.cursor/rules/ariadne.mdc` 讓代理能檢索本機脈絡  

**套件名稱**：[npm 上的 `@koncrate/ariadne-cli`](https://www.npmjs.com/package/@koncrate/ariadne-cli)（指令仍為 `ariadne`）。

## 需求

- Node.js **18+**（建議使用目前 LTS）

## 安裝

```bash
# 全域安裝（建議）
npm install -g @koncrate/ariadne-cli

# 或僅作為開發依賴
npm install -D @koncrate/ariadne-cli
```

不全域安裝、單次執行：

```bash
npx @koncrate/ariadne-cli --help
npx @koncrate/ariadne-cli init
```

## 快速上手

### 1. 初始化 `ariadne init`

在專案根目錄執行：

```bash
ariadne init
```

會建立：

| 路徑 | 說明 |
|------|------|
| `.ariadne/registry/` | 語意索引（`update` 產出檔案所在目錄） |
| `.cursor/rules/ariadne.mdc` | Cursor 規則樣板，引導代理讀寫註冊表 |

### 2. 註冊與更新 `ariadne update`

將指定 **TypeScript 檔**中**已匯出（`export`）的函式**寫入註冊表。路徑為相對目前工作目錄。

```bash
ariadne update <檔案路徑> "[可選：用途說明]"
```

若未提供用途，會盡量採用函式第一則 JSDoc；沒有 JSDoc 則顯示佔位說明。

**範例：**

```bash
ariadne update src/core/combat.ts
ariadne update src/core/combat.ts "實體傷害結算與死亡判定"
```

### 3. 在 Cursor 裡用

在對話中可請代理參考註冊目錄，例如：

> 請參考 `@.ariadne/registry` 的既有條目實作……

實際提示詞可依團隊習慣調整；重點是讓工具能指向**倉庫內已固化的介面與說明**。

## 技術要點

1. **靜態萃取**：讀入 TS 檔，掃描 `export` 的函式宣告。  
2. **語意合併**：CLI 的 `[用途說明]` 與 JSDoc 說明一併反映在產出 Markdown 的 *Purpose* 一節。  
3. **產出格式**：每支函式一檔，路徑為  
   `.ariadne/registry/<檔名>_<函式名>.md`  
   內文為帶 front matter 的 Markdown，利於人讀與 RAG/檢索。

## 產出範例

產出為 Markdown 檔；*Purpose* 會併入你傳入的用途、JSDoc 或預設佔位；*Code Signature* 則與專案內實際宣告一致（以 ts-morph 產生）。

~~~text
---
id: "combat.takeDamage"
type: "Function"
---

# takeDamage

## Purpose (用途)
實體傷害結算與死亡判定

## Code Signature
export function takeDamage(targetId: string, amount: number): void
~~~

## 本機開發

```bash
git clone <你的-repo>
cd Ariadne
npm install
npm run build
node dist/index.js --help
# 或 watch：npm run dev
```

## 作者與授權

- **發佈範圍**：npm scope `@koncrate`  
- **授權**：**ISC**（與本儲庫 `package.json` 一致）
