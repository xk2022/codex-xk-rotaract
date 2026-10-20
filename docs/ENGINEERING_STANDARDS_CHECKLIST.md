# XK SYSTEM 與 codex-xk-rotaract 工程規範清單

規範盤點：2026-10-18；交付收尾：2026-10-20。適用於 XK SYSTEM 多 Repository 開發流程，以及 `codex-xk-rotaract` 示範專案的需求、實作、審查與交付。

中央規範已核准版本為 **AGENTS v1.0.0**。本清單整理既有決策；各節分別標明共同規範、專案實作及待確認事項。文件由 `feat/ISSUE-2-requirements-baseline` 分支以 `develop` 為合併目標，狀態見[PR #6](https://github.com/xk2022/codex-xk-rotaract/pull/6)；`main` 與部署不在本次範圍，後續以[需求總表](REQUIREMENTS_MASTER.md)及[工程待辦](ENGINEERING_BACKLOG.md)追蹤。

## 規範來源與狀態

| 來源 | 用途與狀態 |
| --- | --- |
| [中央 AGENTS v1.0.0][中央規範] | 已核准共同基線，固定引用 `8088b65` 版本；包含本專案補充規則 |
| [代理分工與交接][團隊] | 任務所有權、並行協作、獨立審查與完成條件 |
| [產品需求基準][產品基準]、[API 契約說明][API說明]、[OpenAPI][OpenAPI] | 本專案已採用的業務及 API 契約；與中央規範的差異列於下表 |
| [前端 PR #3][前端PR]、[後端 PR #4][後端PR] | 已核准且完成分支 CI 驗證，仍為草稿、未合併至 `develop`／`main` |
| [工作範本 PR #5][範本PR] | Issue／PR 範本已準備，仍為草稿、未合併 |

「已核准」表示規則或本次實作範圍已獲同意；「分支已驗證」表示指定 Commit 的檢查成功；「待確認」表示尚無統一決策。這些狀態分別追蹤，不能由某次 CI 成功推定全部程式已符合共同基線。

## 已核准的共同工程規範

本節依中央 AGENTS 與專案補充規則整理，既有已核准決策繼續有效。

### Agent 與 Codex 協作

| 編號 | 規範 |
| --- | --- |
| ENG-001 | 使用繁體中文，保留英文技術名詞；先讀所用分支的 AGENTS、README、任務相關文件及更具體的子目錄規則。 |
| ENG-002 | 先確認 Repository、分支、版本及 Git 狀態，保留使用者和其他代理的修改；依實際檔案辨認技術與命令。 |
| ENG-003 | 每項任務列出目標、驗收條件、唯一負責人、可修改範圍、依賴、必要驗證、獨立審查者及交付物。 |
| ENG-004 | 主代理統籌介面、整合與 GitHub 操作；互不衝突的工作可並行，同一檔案同時只有一位修改者。團隊上限為七位代理，包含主代理。 |
| ENG-005 | 實作者與獨立審查者分開；以實際證據更新狀態，測試或部署未執行時明確標示。 |
| ENG-006 | 各 Repository 保存可直接讀取的規範副本；Codex Cloud 任務依所用 Repository 與分支讀取，不假設能自動取得其他 Repository 的最新規範。 |

### 授權與變更界線

| 編號 | 規範 |
| --- | --- |
| ENG-007 | 任務範圍內可自主修改程式、測試、一般文件與非敏感設定，建立分支、Commit、Push，執行非破壞性 Migration 測試。 |
| ENG-008 | 建立 PR、任何 Merge、正式部署、破壞性資料庫變更、重大重構、跨 Repository 修改、認證／授權／安全政策／Secrets／敏感設定修改及新增付費資源，須先取得明確核准。 |
| ENG-009 | 一般安全缺陷可修復並測試；既有依賴安全修補可升級並測試。新增依賴與高風險升級須先確認，且仍受 ENG-008 限制。 |
| ENG-010 | 明確需求直接處理；低風險可逆假設記錄後繼續，高風險假設先詢問；規範衝突提出具體差異與替代方案後等待確認。產品規則與 OpenAPI 不自行改寫。 |

本次工作持續沿用使用者的「不合併、不部署」界線；已獲核准的工具及 PR 更新範圍不因整理文件而重新開放其他操作。

### 架構與多 Repository 共用

| 編號 | 規範 |
| --- | --- |
| ENG-011 | Modular Monolith 優先；DDD 依領域複雜度選用，必要時才拆微服務。 |
| ENG-012 | 共用平台與產品採獨立 Repository、獨立部署；共用模組可選用，依需求選 Library 或 Service，使用 SemVer。 |
| ENG-013 | 同產品重複三次以上評估抽離；跨產品出現兩個相同需求時評估共用。這些是評估時機，實際抽離範圍另依需求決定。 |
| ENG-014 | 重大架構決策建立 ADR，記錄背景、選項、決策、影響、決策者、日期與歷史。 |

### Java 與後端

| 編號 | 規範 |
| --- | --- |
| ENG-015 | 類別使用 PascalCase，方法與變數使用 camelCase；Service 採 Interface＋Impl，Controller 不承載業務邏輯。 |
| ENG-016 | Request／Response 分離，不直接回傳 Entity；偏好 Lombok `@Data`／`@Builder`，JPA Entity 不得未經審查套用 `@Data`。 |
| ENG-017 | 明確 Null 檢查、Bean Validation、BusinessException 及全域 ExceptionHandler；公開 API／Interface 使用 JavaDoc，複雜業務原因使用繁體中文註解。 |
| ENG-018 | 簡單操作可用 Stream，複雜邏輯用迴圈；以單一職責與可讀性判斷方法範圍，不限定固定行數；TODO／FIXME 附原因或追蹤資訊。 |
| ENG-019 | 資料庫採 snake_case、UUID；一般業務表預設 `created_at/updated_at/created_by/updated_by`。Code First 與 JPA 優先，複雜動態 SQL 可用 MyBatis XML；關聯偏好外鍵 ID，Service 管理 Transaction。 |

### API 與前端

| 編號 | 規範 |
| --- | --- |
| ENG-020 | RESTful 與 `/api/v1` 等版本路徑；中央回覆基線為 `code/message/data/traceId`，使用正確 HTTP Status。 |
| ENG-021 | 中央分頁基線為 `page/size/sort` 與 `totalElements/totalPages`；OpenAPI 同步，API 變更更新 CHANGELOG，Breaking Change 提供版本或遷移計畫。 |
| ENG-022 | 新前端採 TypeScript，框架依產品需求選擇；共用元件與業務模組混合組織，統一 API Client 與業務 Service。 |
| ENG-023 | 可採 Tailwind CSS 或 Bootstrap；Vue 專案偏好 Pinia。元件與元件檔使用 PascalCase，變數使用 camelCase。 |
| ENG-024 | 正式頁面支援手機、平板與桌面，遵循 Design System、無障礙與前後端雙重驗證；重大 UI 改版先確認。 |

### Git 與交付流程

| 編號 | 規範 |
| --- | --- |
| ENG-025 | 使用 Git Flow：`main`、`develop`、feature、release、hotfix；功能分支如 `feat/ISSUE-123-description`。 |
| ENG-026 | Commit 採 Conventional Commits 並關聯 Issue；Issue 使用 Epic／Feature／Task／Bug，需求、測試、風險及 Codex 任務摘要集中於 Issue／PR。 |
| ENG-027 | PR CI 包含 Build、Unit、Integration、Lint、Security／Dependency Scan、Coverage；依風險補 Contract／E2E／Performance。不設定固定覆蓋率百分比。 |
| ENG-028 | 依需求風險加入有意義的測試；分析失敗根因並合理修復，不刪除有效測試、不隱藏錯誤、不降低既定檢查強度；無進展或需高風險變更時，停止相關處理並回報。 |
| ENG-029 | 環境流向為 `develop → Dev`、`release → Staging`、`main → Production`；Production 必須人工核准，Tag 使用 SemVer。此為已核准方向，實際部署流程另依各專案落實。 |
| ENG-030 | 不提交 Secrets、憑證或真實個人資料；範例設定使用占位值。整合測試只用明確允許重設的獨立合成 `*_test` PostgreSQL，禁止 `local` profile 與正式資料庫。 |

### 文件與驗收紀錄

| 編號 | 規範 |
| --- | --- |
| ENG-031 | 文件使用繁體中文，README 包含架構、環境、啟動、設定、API、測試、部署及版本；一般文件使用 UPPER_SNAKE_CASE，README、AGENTS、CHANGELOG、ADR-0001 等依規範例外命名。 |
| ENG-032 | CHANGELOG 採 Keep a Changelog；ADR 位於 `docs/adr/`，保留歷史與決策依據。 |
| ENG-033 | 交付說明列摘要、修改檔案、實際驗證命令與結果、失敗／未解原因、Commit、PR、相容性、風險、回滾、文件及後續待辦。 |
| ENG-034 | 工程測試、使用者驗收、正式配置與部署狀態分開記錄；合成展示、API 靜態契約或文件勾選不能代替真實執行及使用者確認。 |

## 本專案採用方式與差異

| 項目 | 已採用或現有行為 | 處理狀態 |
| --- | --- | --- |
| 技術方向 | Java 21、Spring Boot、Maven、Modular Monolith 優先、GitHub Actions、Codex Cloud。現行 Spring Boot 3.5.13／PostgreSQL 17；前端 React／TypeScript／Vite／Tailwind。 | 技術方向已確認；既有版本以 POM／lockfile 為準。 |
| 單體與模組界線 | 後端目前以單一 Spring Boot 應用及領域 Service 組織。 | 模組界線與依賴約束尚需盤點，未以此次 CI 工作宣稱架構驗收完成。 |
| 資料存取／Migration | 已有 JDBC／SQL 與 Flyway；中央偏好 JPA，中央尚未統一 Migration 工具。 | 明列專案差異。保留現行行為；是否改用 JPA 屬架構變更，需提出方案，不能直接批次重構。 |
| Service 結構 | 現有多個具體 Service 類別，尚未全面採 Interface＋Impl。 | 與 ENG-015 的差距待排程處理；本清單不宣稱已符合。 |
| 錯誤回應 | 現有契約為 `code/message/fieldErrors/requestId`，與中央 `code/message/data/traceId` 不同。 | 差異待對齊；保留已確認 OpenAPI，任何調整須有前端相容與契約變更安排。 |
| 列表與分頁 | 現有契約使用 `page/pageSize/items/total`，page 預設 1，pageSize 預設 20、範圍 20～100。 | 與中央欄位有差異；專案現行起點已定，中央通用起點與對齊方式尚待決定。 |
| 既有 API 與畫面 | 已有 141 項 API；核心會員與本人帳號有 live 流程，其他新增畫面依既有範圍分階段整合。 | 端點交付與全站畫面串接／正式驗收分開追蹤。 |
| 其餘程式規範 | Null／Bean Validation、交易邊界、JavaDoc、資料表稽核欄位等依共同基線要求。 | 需逐模組審查；目前基本 Lint 不足以證明全部規範已落實。 |

## 已核准並完成分支驗證的 CI 實作

以下為本專案選型及 **2026-10-18 驗證快照**；工具版本、timeout、artifact 保留期與測試數量不自動成為其他 Repository 的統一規範。

| 範圍 | 實作與判定方式 | 目前狀態 |
| --- | --- | --- |
| 前端品質 | Node 24；ESLint 10.13.0、`@eslint/js` 10.0.1、typescript-eslint 8.71.2；Vitest／coverage-v8 4.1.12。Lint、測試、Coverage、TypeScript／Vite build。 | [PR #3][前端PR] 的 `570a0d0` 已驗證，尚未合併。 |
| 前端依賴掃描 | 使用既有 npm audit，完整 lockfile 含 dev／optional／peer；有效告警產生報告，執行／來源／JSON 錯誤使工作失敗。 | 同一分支已驗證；283 項依賴、0 項告警是當次查詢結果。 |
| 後端品質 | Java 21；Checkstyle Plugin 3.6.0＋引擎14.3.0，main／test 採 UnusedImports、RedundantImport、OuterTypeFilename、OneTopLevelClass；JaCoCo 0.8.15，`clean verify`。 | [PR #4][後端PR] 的 `632b090` 已驗證，尚未合併。 |
| 後端依賴掃描 | OWASP Dependency-Check 13.0.0；獨立 profile／job，含 app／test 直接與傳遞依賴；官方 NVD 2.0 feed／META、CISA KEV；冷資料更新成功後掃描，`autoUpdate=true`、`failOnError=true`。 | 同一分支已驗證；不含 Maven build plugins／OSS Index，未進行原始碼或 Secrets 掃描。 |
| 覆蓋率範圍 | 前端納入全部46個非測試TS／TSX來源；後端納入35個主來源／43個編譯類別。JaCoCo僅計Surefire JVM，另行啟動的HTTPS JVM不計入。 | 快照行覆蓋率前端28.10%、後端86.12%；沒有固定百分比門檻。 |
| 回歸證據 | 前端184項測試、兩個分支各111項後端測試、141項API契約及兩條真實HTTPS流程通過。 | 數字為指定Commit的快照；後續功能變更須維持有效測試並依需求增加。 |
| 執行控制 | Action 固定完整 SHA、`contents: read`、同組 concurrency；前端15分鐘、後端verify30分鐘、後端audit45分鐘上限。 | 已在對應PR驗證，無部署步驟新增；多Repo共用實作仍待規劃。 |
| 報告 | 成功報告逐份確認非空；JSON／metadata與來源Commit可追溯，audit artifact已實際下載核對SHA256／ZIP與內容。 | 各artifact保留7天；CI與Commit紀錄保留作追溯，artifact可用期以執行頁為準。 |
| 工作範本 | Issue／PR範本。 | [PR #5][範本PR] 為草稿，未合併，尚未成為預設分支的工作入口。 |

### 安全告警處理現況

後端報告列53個主依賴條目及34個related條目，7個條目有告警；按 `(source,name)` 去重為 **99項：Critical 21、High 34、Medium 40、Low 4**。這些是工具匹配，尚待逐項確認版本、模組、配置與實際適用性；本輪未修補、未建立專案suppressions。

本專案本階段已核准先產生依賴安全基線，不設定弱點等級阻擋；掃描器或來源失敗仍使CI失敗。CI成功表示檢查按設定完成，安全修補與告警核實仍另列待辦。此處的report-only設定不構成多Repository通用的風險接受或弱點豁免政策。

## 待確認與後續追蹤

下列事項保持未決或待處理狀態；「本專案已採用」不會退回未決。處理順序欄為整理建議，並非新增的安全阻擋政策。

| 編號 | 範圍 | 待確認或交付內容 | 建議處理順序 |
| --- | --- | --- | --- |
| ENG-Q001 | 告警核實 | 優先核對後端Critical／High的vendor advisory、套件／版本及使用條件，形成適用／不適用／證據不足判定，再提出最小修補與回歸。 | P0 |
| ENG-Q002 | API相容 | 中央回應與分頁欄位對齊方式、既有客戶端相容計畫；中央通用分頁起點與錯誤碼字典。專案目前page=1及既有OpenAPI仍有效。 | P1 |
| ENG-Q003 | 既有程式差距 | Service Interface＋Impl、JPA偏好與現行JDBC、其他中央程式規範的逐模組差距及處理範圍。 | P1 |
| ENG-Q004 | 中央同步 | 每個Repo的規範版本標記、來源、更新／相容方式與負責人；不能假設Codex跨Repo自動同步。 | P1 |
| ENG-Q005 | 安全流程 | 弱點阻擋等級、例外證據／期限／核准角色、原始碼安全分析與Maven build plugin等未覆蓋範圍的選型。 | P1 |
| ENG-Q006 | Git治理 | 多Repo具體Required Checks、分支保護／rulesets、Merge方式及release／hotfix操作細節；Git Flow與Conventional Commits基線已核准。 | P1 |
| ENG-Q007 | 共用模組 | 首批共用能力、Library／Service界線、介面、依賴相容及發布位置；獨立Repo、可選採用與SemVer方向已核准。 | P2 |
| ENG-Q008 | 通用技術細節 | 縮排、UUID版本、中央Migration工具及共用CI實作。專案Flyway與本次選定工具維持其已核准範圍。 | P2 |
| ENG-Q009 | 部署落實 | Dev／Staging／Production實際環境、Secrets管理、審核閘門、還原／監控及維運責任；環境流向已核准，正式部署另按授權執行。 | P2 |

## 驗證與追溯入口

| 項目 | 固定版本或實際證據 |
| --- | --- |
| 中央規範來源 | [AGENTS at 8088b65][中央規範] |
| 前端實作版本 | [570a0d0](https://github.com/xk2022/codex-xk-rotaract/commit/570a0d091d491fe69637156365c88bcfab26036a)；[前端README][前端說明] |
| 後端實作版本 | [632b090](https://github.com/xk2022/codex-xk-rotaract/commit/632b090fe1576a0a29e14177a2d0d47bf0f6dcde)；[後端README][後端說明] |
| 前端CI | [39137538653](https://github.com/xk2022/codex-xk-rotaract/actions/runs/39137538653) |
| 前端分支core API CI | [39137538657](https://github.com/xk2022/codex-xk-rotaract/actions/runs/39137538657) |
| 後端core API與audit CI | [39137504365](https://github.com/xk2022/codex-xk-rotaract/actions/runs/39137504365) |
| 前端audit報告 | [artifact 12140815099](https://github.com/xk2022/codex-xk-rotaract/actions/runs/39137538653/artifacts/12140815099)，到期2026-10-25 14:47:19 UTC |
| 後端audit報告 | [artifact 12140815232](https://github.com/xk2022/codex-xk-rotaract/actions/runs/39137504365/artifacts/12140815232)，到期2026-10-25 14:48:47 UTC |
| 產品需求盤點草稿 | [需求彙整](2027/44-requirements-consolidation.md)，產品需求與本清單工程編號可在後續總表交叉引用 |

此清單的完成範圍為規範、專案差異及既有驗證證據整理。待確認項目取得決策後，應附日期、來源與影響；相應程式變更與驗收繼續分開追蹤。

[中央規範]: https://github.com/xk2022/codex-xk-rotaract/blob/8088b65d0507114bfb37a2f16b227f7784684797/AGENTS.md
[團隊]: TEAM.md
[產品基準]: https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/docs/2027/13-requirements-baseline.md
[API說明]: https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/docs/api/README.md
[OpenAPI]: https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/docs/api/openapi.json
[前端PR]: https://github.com/xk2022/codex-xk-rotaract/pull/3
[後端PR]: https://github.com/xk2022/codex-xk-rotaract/pull/4
[範本PR]: https://github.com/xk2022/codex-xk-rotaract/pull/5
[前端說明]: https://github.com/xk2022/codex-xk-rotaract/blob/570a0d091d491fe69637156365c88bcfab26036a/frontend/README.md
[後端說明]: https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/README.md
