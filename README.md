# Ariadne CLI

在專案裡建立**可機讀的語意註冊與 Schema 索引**，讓 Cursor 等工具能照著既有邏輯與 API 約束開發，減少憑空杜撰的實作路徑。

- 以 **TypeScript AST**（[ts-morph](https://github.com/dsherret/ts-morph)）依 `getExportedDeclarations` 盡量涵蓋**本檔內有主體的匯出**（函式、類別、`const`／`let`、型別、介面、列舉、`namespace`、default 等）；**不**為純 `export { x } from '…'` / `export * as` / `export * from '…'` 建條目；**不**涵蓋 `export =` 等 CommonJS 風格。每筆 registry 的 YAML 含 **`source_fingerprint`**（單一 export 節點全文之 SHA-256），**僅由 `ariadne update` 寫入**；**`audit` 只讀、比對、列清單，不產生或改 `.md`**。`fingerprint stale` 時應在**讀完源碼、寫好新 Purpose 後**對該檔執行 **`ariadne update`**。  
- 將 `update` 時可選的**用途說明**寫入註冊內容  
- 產出 **RAG 友善**的 Markdown 置於 `.ariadne/registry/`，搭配 **`.cursor/rules/ariadne.mdc`**（內容契約）與 **`.cursor/skills/ariadne-registry/SKILL.md`**（Agent 技能：何時/如何 `update`）讓代理能檢索並維護脈絡  

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
# 明確指定目前唯一支援的 IDE（可省；預設即 cursor）
ariadne init --ide cursor
# 不要任何關於 config 的詢問，直接寫入內建 include/exclude
ariadne init -y
```

- **`--ide`** 預設為 `cursor`。**目前僅實作 Cursor**（寫入 `.cursor/rules/ariadne.mdc`）。日後若支援其他 IDE，會擴充同一參數；傳不支援的名稱會出錯並列印目前可選清單。
- **`.ariadne/config.json` 還沒有時**，在**有鍵盤的互動式終端**裡會**先詢問**是否採用內建建議；若答否，可再依提示輸入自訂的 **include / exclude**（glob、逗號分隔）。若偵測到 **非互動**（如管線、或沒有 TTY），則**不詢問**，直接寫入內建預設。CI 常見的 `CI=true` 也會**不詢問**。
- **`-y` / `--yes`**：略過上述詢問，永遠寫入內建 `config`（腳本／CI 可與之搭配）。  
- **內容契約**（用英文寫在 `.cursor/rules/ariadne.mdc`）：**Purpose 長度、一符號一檔、Code Signature 只含簽名不含整段實作、`error_codes` / `dependencies` 的語意**等，以規則檔與產生器行為一致為準，見下節與 ariadne.mdc。

會建立：

| 路徑 | 說明 |
|------|------|
| `.ariadne/config.json` | 專案註冊**規範**（可更新哪些路徑／要排除什麼），見下方 |
| `.ariadne/registry/` | 語意索引（`update` 產出檔案所在目錄） |
| `.cursor/rules/ariadne.mdc` | Cursor 規則樣板，引導代理讀寫註冊表（僅 `--ide cursor`） |
| `.cursor/skills/ariadne-registry/SKILL.md` | [Cursor Agent Skill](https://cursor.com/docs)（專案內），描述何時/如何執行 `ariadne update`／`audit` 維護 registry；**若已存在則不覆寫** |
| `.cursor/hooks.json` 與 `.cursor/hooks/ariadne-post-tool-use.cjs` | 選用。由 **init** 部署：在 [Cursor Hooks](https://cursor.com/docs/hooks) 的 **`postToolUse`** 向 **Agent 對話** 注入 `additional_context`，提醒閱讀剛寫入的檔並產生 Purpose 再跑 `update`（見下節） |

`init` 已存在 `config.json` 時不會覆寫，避免洗掉你的調整。已存在的 **`hooks.json` / `hooks/ariadne-*.cjs` / `skills/.../SKILL.md`** 亦**不覆寫**（可手動合併新行為）。

#### Registry 內容方針（英文、單一真相）

`.cursor/rules/ariadne.mdc` 內含 **Ariadne registry content contract**（**English**）：

- 條目為 **導向＋邊界**，不當第二份源碼庫。  
- CLI 產生的 front matter 含 `source`、預設 `error_codes: "n/a"`、`dependencies: "n/a"`，與規則內敘事對齊；團隊可之後手動改成具體值。  
- **Code Signature** 以「簽名（不含函式內實作區塊）」為主，降低 refactor 時與長篇條目脫節的機率。  

中文說明仍可在 commit／PR 裡補，但**規則本體**建議以英文，方便多數模型與成員以同一份契約解讀。

### 2. 專案規範 `.ariadne/config.json`

- **`update.include` / `update.exclude`**：[minimatch](https://github.com/isaacs/minimatch) 樣式、**相對專案根**。
- 預設只涵蓋 `**/*.ts` 與 `**/*.tsx`，並排除 `node_modules`、`dist`、測試檔（`*.test.ts` / `*.spec.*` 等）與 `.d.ts` 等。可依專案修改。
- **`ariadne update` 單檔**時，路徑**必須**符合這套規則，否則 CLI 會拒絕（請改設定或只註冊在允許路徑下的檔案）。

**有必要一次掃全專案嗎？** 不必。**品質上**的「同步」是：**Agent 讀你改的檔、寫好 1–3 句 desc（或加 JSDoc）→ 再 `ariadne update`**；Cursor **postToolUse** hook 就是在推這條主線。需要專案級**清單**時用 `ariadne audit`；敘事與 **`source_fingerprint` 的落地**一律靠 **`update`**，沒有批次「代寫 Purpose」的指令。

### 3. 全專案檢查 `ariadne audit`

CLI **不會幫你叫 LLM**。`ariadne audit` 先**全掃** config 內每個可註冊 export，**Summary** 給總量與幾類問題數；預設表格列出**全部**列，並多一欄 **`fingerprint stale`**（`source_fingerprint` 與目前 AST 節點全文 digest **不一致**或缺欄＝源碼變過或尚未寫入指紋，應 review 並 `update`）。

**篩選與 agent 友善輸出：**

| 旗標 | 作用 |
|------|------|
| `--issues` | 只列：缺 registry 檔，或 Purpose 仍為佔位（不含「僅無 JSDoc」） |
| `--stale` | 只列：`fingerprint stale` 為真 |
| `--issues` 與 `--stale` 同時開 | **聯集**（任一成立即列） |
| `--files` | 依**目前篩選後**的列，印**去重**的來源檔相對路徑，**一行一檔**（無 markdown） |
| `--json` | 每 symbol 一筆 JSON；可與上列併用 |

```bash
ariadne audit
ariadne audit --issues
ariadne audit --stale
ariadne audit --issues --stale
ariadne audit --files --stale
ariadne audit --json --issues
```

**建議流程**：用 **`--stale` / `--issues` / `--files`** 得到要動的檔清單（`audit` **不寫入** registry）→ 讀源碼與既有 `.md` → 寫好新 Purpose 或 JSDoc → **`ariadne update "<路徑>"`** 一併寫入該檔的 **Purpose 與 `source_fingerprint`**。

### 4. 單檔註冊 `ariadne update`

將指定 **TypeScript 檔**中**可註冊的匯出**（僅本檔內有主體的宣告；見上方）寫入註冊表，並寫入 **`source_fingerprint`**（與你給的 Purpose / JSDoc 一起落地）。**這才是**源碼變動或補敘事後、要讓 registry 與真實程式對齊時**應跑的唯一寫入指令**。路徑為相對目前工作目錄，**且**須在 `config` 的允許範圍內。

```bash
ariadne update <檔案路徑> "[可選：用途說明]"
```

若未提供用途，會盡量採用**該匯出**上第一則 JSDoc；沒有 JSDoc 則顯示佔位說明。

**範例：**

```bash
ariadne update src/core/combat.ts
ariadne update src/core/combat.ts "實體傷害結算與死亡判定"
```

### 5. Cursor hooks：每次寫入後**通知 Agent** 補述、再 `update`（`postToolUse`）

`ariadne init` 若專案裡**沒有**自訂的 `hooks.json`，會寫入一組以 **`postToolUse`** 為主、附 **matcher** 的 hook（只對如 `Write` / `search_replace` 等「寫檔成功」的工具有效，依實際 Cursor 版本為準）：

**與 hook 有無無關**：專案內 **`.cursor/rules/ariadne.mdc`** 已寫明——只要修改了在 `include` 範圍內、可註冊的匯出，**不論** Cursor 是否**支援** hooks、是否**關閉** `postToolUse`、是否在 **Tab / Chat / CI**，Agent 都**必須**撰寫 **Purpose**（或 **JSDoc**）並執行 `ariadne update`；**不能**因沒有 hook 提醒就略過註冊。

- Hook **不會**在背景幫你跑 `ariadne`；它會在對話中注入一段 **`additional_context`（英文）**，要求 **Agent 在同一或下一回應**：（1）**重新讀**剛寫入的 `.ts`/`.tsx`；（2）依專案內 **`.cursor/rules/ariadne.mdc`** 的內容契約寫出 **1～3 句 English Purpose**；（3）再執行 `ariadne update "<相對路徑>" "…"` 或只跑 `update` 讓 JSDoc 生效。  
- 預設腳本只需 **`node`（**hook 內不呼叫 `npx`/`ariadne`）；**實際執行 `update`** 仍由 Agent 用專案內 CLI 或全域/ `npx`。  
- 你**本來**就有 `.cursor/hooks.json` 時 init 不會覆寫；要手動把 `postToolUse` 的一筆掛上：  
  `node .cursor/hooks/ariadne-post-tool-use.cjs`  
  並一併複製該 `.cjs`。可調整 `matcher` 讓寫入工具觸發節奏符合你的 Cursor 建置。  
- **Inline Tab** 往往**不會**走與 Chat Agent 相同的 `postToolUse`；Tab 變更後可手動讓 Agent 對**變更的檔**執行 `update`（或 `audit` 出清單後再逐檔 `update`）。
- 同檔**多次**寫入會**多次**注入，若太吵，可刪小 matcher 範圍、或關掉該筆 `postToolUse`、改在 CI 跑 `ariadne audit` 檢查是否有 stale／缺檔，必要時在 pipeline 內**按需** `update`。

需 **Cursor 支援 hooks** 的桌面版，系統上需能執行 **`node`** 以跑此腳本。

### 6. 在 Cursor 裡用

在對話中可請代理參考註冊目錄，例如：

> 請參考 `@.ariadne/registry` 的既有條目實作……

實際提示詞可依團隊習慣調整；重點是讓工具能指向**倉庫內已固化的介面與說明**。

## 技術要點

1. **靜態萃取**：讀入 TS 檔，掃描可註冊的 `export` 符號（實作見 `exportRegistry`）。  
2. **語意合併**：CLI 的 `[用途說明]` 與 JSDoc 說明一併反映在產出 Markdown 的 *Purpose* 一節。  
3. **產出格式**：**一個匯出符號一檔**（`fileKey_${safeName}.md`）；front matter 含 `source_fingerprint`（`sha256:…`）；`type` 為 `Function` / `Class` / `Variable` / `TypeAlias` / `Interface` / `Enum` / `Namespace` / `DefaultExport` / `Expression` 等；本體除 **Purpose** 與 **Code Signature** 外，還有 **Contract** 與 **error codes & reasons** 骨架；仍以源碼為單一真相。

## 產出範例

*Purpose* 併入你傳入的用途、JSDoc 或預設佔位；*Code Signature* 為**不含內實作區塊**的宣告／可讀之簽名片段（依符號類型裁切，見 `getHeadSignatureForExport`）。

~~~text
---
id: "combat.takeDamage"
type: "Function"
source: "src/combat/take.ts"
source_fingerprint: "sha256:…"
error_codes: "n/a"
dependencies: "n/a"
---

# takeDamage

**Source:** `src/combat/take.ts`

## Purpose
Resolves physical damage and death on an entity (example).

## Code Signature (contract, not full body)
    export function takeDamage(targetId: string, amount: number): void

## Contract (import / name / value domain)
(… 以下為產生器帶出之佔位；讀型別/實作後把 n/a 改成你們要的 import/值域/輸出域。)

- **How to import or call (pattern):** n/a
- **Exported symbol:** `takeDamage`
- **Input value domain (…):** n/a
- **Output / return value domain:** n/a

## error codes & reasons
- n/a
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
