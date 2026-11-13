# R6 會員／社團／權限實際串接派工包

日期：2026-11-13（Asia/Taipei）。狀態：**待辦；本輪只交付派工與交接，未執行 R6 程式實作或測試。**

使用者最新指示為「取消實作，以分派其他個體執行任務」，排程先使用全天里程碑。本對話停止產品實作，由執行總管將本包交給未來獨立對話／Agent；本文件不是目前正在開發、已啟動背景工作或已排入行事曆的證明。日期與工作日由總管統一安排，不在本文件虛構預定完成時間。

中斷點：本次 R6 僅讀取共用規則、產品規則、前後端與契約並協調範圍，**沒有修改任何前端 source、測試、腳本、package 或 lockfile，也未執行 npm、Maven、瀏覽器、Docker 或資料庫操作**。本文件為此次 R6 唯一文件交付；其他任務在同一工作區的變更不屬於本包作者的程式修改，不得據此刪除或回復。

## 1. 目標與執行前重查

目標：在既有 live 模式完成一條可用真實 API 驗收的「會員／社團／有效權限」閉環，優先社團資料維護、授權社團切換與名冊狀態刷新；保留展示模式與既有成功流程。

未來執行者必須先讀最新檔案、Git 狀態、目前 Issue／派工與驗證證據，再核對本包。交接時主代理所述工作分支為 `feat/executive-rotaract-workstreams-20261113`，不保證未來仍為目前分支。不得依本包舊快照重新寫已完成功能；主代理統一協調 Git、共享檔案與驗證資源。

必讀：

- `/workspace/codex/AGENTS.md`、`USER.md`、`roles.md`、`HANDOFF.md`（讀取共用協作規則，不修改該 repository）。
- [產品 AGENTS](../../AGENTS.md)、[產品 README](../../README.md)、[團隊規則](../TEAM.md)。
- [需求基準](../2027/13-requirements-baseline.md)、[角色矩陣](../2027/14-role-matrix.md)、[第一階段規格入口](../2027/README.md)。
- [前端說明](../../frontend/README.md)、[後端說明](../../backend/README.md)、[正式 OpenAPI](../api/openapi.json)、[契約說明](../api/README.md)。
- [R1 交付前提](R1_DELIVERY_PREREQUISITES.md)、[R2 資料與年度](R2_DATA_YEAR_RECONCILIATION.md)、[R5 工程相容性](R5_ENGINEERING_COMPATIBILITY.md)；其建議不得自動轉為安全政策、架構或正式設定修改。

## 2. 已存在的流程與真正缺口

以下為 2026-11-13 讀取程式所得，**本次未重新執行，不能稱為本輪驗收通過**。

| 現有位置 | 已有內容 | 本任務處理方式 |
| --- | --- | --- |
| [Portal.tsx](../../frontend/src/Portal.tsx) | `VITE_API_MODE=live` 載入獨立 LiveWorkspace；預設仍展示模式 | 保留分離入口；沒有必要不修改 |
| [live/api.ts](../../frontend/src/live/api.ts) | Cookie Session、CSRF、`/me`、登入登出、POST 冪等鍵、本人資料／隱私與聯絡變更 | 延伸型別與組織 client；不重寫登入或保存秘密到 localStorage |
| [LiveWorkspace.tsx](../../frontend/src/live/LiveWorkspace.tsx) | 註冊、登入、入社申請、有效社團職務的入社審核、會員名冊／詳情、分頁與帳號入口 | 保留既有閉環；補授權刷新、組織入口及名冊刷新 |
| [AccountSettings.tsx](../../frontend/src/live/AccountSettings.tsx) | 本人基本資料、隱私、聯絡與一次性代號變更、草稿／衝突提示 | 不另造一份本人帳號流程；維持隱私行為 |
| [browser-live.mjs](../../frontend/scripts/browser-live.mjs)、[browser-live-account.mjs](../../frontend/scripts/browser-live-account.mjs) | 既有真實 HTTPS/API 瀏覽器流程 | 由總管重跑回歸，不以檔案存在當作目前通過 |
| 後端 `/organization-overview`、`/clubs/{id}`、`/role-grants` | 已有管理投影、社團 PATCH、角色列表與授權／撤銷端點 | 依最新契約與實際服務核對後重用，不新增另一套 API |

真正待補的最小範圍：

1. 真實組織總覽 → 選擇伺服器允許的管理社團 → 讀取 managed 投影 → 編輯／儲存介紹與聯絡及公開設定；名稱僅目前有權角色可改。初版不擴大到新增社團、社徽上傳、轉區、停復用或全部角色授予表單。
2. 顯示目前有效職務與任期，切換管理社團不混用範圍。權限只來真實 Session／`/me` 與伺服器結果；示範 actor、URL、下拉選單及本機狀態都不構成授權。
3. 合理時機重新讀取 `/me`（例如視窗返回、明確刷新、操作前與權限拒絕後），同步目前可管理的社團。撤權後拒絕操作並移除過期管理介面／資料，避免仍顯示能操作的舊狀態。
4. 名冊支援契約允許的社團篩選與明確重新整理；資料刷新、切換範圍或詳情失效時清除舊詳情，重新套用省略私人欄位的投影。
5. 409 保留未儲存草稿，明確呈現衝突與讀取最新資料的選擇。若提供保留草稿後繼續，採最新版本並只保留使用者真正修改的欄位，不能靜默覆寫他人變更。

注意：登入會員依契約可查詢其他社團的合格公開會員名冊；「跨社隔離」驗證的是**管理投影、私人待辦與寫入權**，不是擅自禁止既有合法會員搜尋。社團篩選不取代後端授權。會員 `clubs[]` 與社籍子表允許扶青／扶輪同時存在，不能簡化為單一 `clubId`。

## 3. 所有權、路徑與協作依賴

未來執行時由總管指定一位 R6 實作者與另一位獨立審查者，同一檔案不可同時由多人修改。

允許修改：

- `frontend/src/live/**`：優先延伸 `api.ts`／測試，新增組織設定元件及純資料轉換／權限呈現測試，少量調整 `LiveWorkspace.tsx`、`live.css`。
- `frontend/src/Portal.tsx`：僅確有入口需求時修改。
- `frontend/scripts/browser-live*.mjs`，或新增 `frontend/scripts/browser-live-organization.mjs`。
- 本文件 `docs/executive/R6_LIVE_INTEGRATION.md`：由待辦派工包更新為實際交接；保留哪些驗證真正執行。

不得自行修改：後端、共享 `package.json`／lockfile、根 README、OpenAPI、安全政策、正式設定、新增依賴或其他任務文件。發現必要缺口，先向總管回報具體端點／欄位／重現方式與最小修正建議，由總管指定所有者後才動工。不得用前端假資料補不存在的正式 API。

依賴分工：

| 依賴 | 負責者／界線 |
| --- | --- |
| 最新程式、工作分支與實作授權 | 總管在獨立派工時確認；本對話只交付文件 |
| Node／Java／PostgreSQL、HTTPS、共享輸出與測試 DB | 總管集中啟動與驗證；實作者不得並行寫入相同 `node_modules`、`dist`、`target` 或測試資料庫 |
| 契約／後端不足 | 回報總管指派後端所有者；不自行改契約或減少驗收 |
| R4 依賴稽核 | 依總管最新派工確認所有者；R6 不修改 package／lockfile，也不執行 `npm audit fix` |
| R5 規範相容性 | 保持現有 v1 相容；不混入 Interface／JPA／API envelope 等重構 |
| 獨立審查與最終 Git 交付 | 總管安排、核對證據，依當次授權處理；R6 實作者不自行 commit／push／merge |

## 4. API／DTO 核對清單

執行前以最新 OpenAPI 的封閉 schema、權限與實際回應為準，這張表不建立新契約。

| 使用情境 | 既有契約 | 必要保護 |
| --- | --- | --- |
| 工作階段及有效角色 | `GET /api/v1/me` → `Me`／`RoleGrant`／`Scope` | 期限按現在時間判定；未來／過期職務不顯示為可用；不信任示範資料 |
| 可管理社團 | `GET /api/v1/organization-overview` → `ManagedClubsPage` | 遵從伺服器範圍與 `page/pageSize/total`，不得只讀第一頁就假定全部 |
| 管理資料來源 | `GET /api/v1/clubs/{id}?view=managed` → `ClubProjection`／`ManagedClub` | 檢查 managed 投影；公開投影省略聯絡欄位時不得補成可編輯資料或沿用舊值 |
| 儲存社團資料 | `PATCH /api/v1/clubs/{id}` → `ClubPatch`／`ManagedClub` | `version` 與實際變更欄位；普通管理者不送名稱／社徽；不傳入 status、roles 或未授權欄位 |
| 角色／任期呈現 | `GET /api/v1/role-grants` → `RolesPage` | 區分本人可見授權與完整角色管理權；不因知道 UUID 取得其他社團授權 |
| 名冊及詳情 | `GET /api/v1/members`、`GET /api/v1/members/{id}` | 列表無電話／Email；詳情被省略的欄位保持省略，不從帳號、快取或前次詳情回填 |
| 合法測試授權與撤權 | `POST /api/v1/role-grants`、`POST /api/v1/role-grants/{id}/revoke` | 只由合法管理者操作，受 CSRF、任期、version、冪等鍵與適用 MFA 規則約束 |

`ManagedClub.contactVisibility.socialLinks` 與原本社群連結須成對保留；初版沒有編輯社群連結時不要清掉未顯示的資料。私人會員 Email／電話與社團營業聯絡不是同一資料來源。

## 5. 真實驗收 fixture 與 MFA 合法性

所有資料使用合成姓名、`example.test` 信箱與獨立本地驗證 DB；不得以真實會員或正式 DB 進行建立、撤權或競爭測試。總管先確認最新腳本接受的資料庫命名與安全防護；不能為了使用 `_smoke` 或 `_test` 字尾而移除既有檢查。

未來新瀏覽器腳本預期由總管準備：

- `BASE_URL`：已啟動的本地 HTTPS live 入口；沿用現有腳本預設及受信任本地測試配置。
- `LIVE_REVIEWER_EMAIL`、`LIVE_REVIEWER_PASSWORD`：由環境注入合法合成社長帳號；不可寫入文件、終端輸出、截圖或提交內容。
- `LIVE_CLUB_ID`：第一個可管理社團。
- `LIVE_ORG_SECOND_CLUB_ID`：第二個有效授權社團，供同帳號切換驗收。
- `LIVE_ORG_FOREIGN_CLUB_ID`：存在但該帳號無管理權的第三社團，驗證真正的跨社拒絕，而非只測不存在 ID。

上述兩個 `LIVE_ORG_*` 為**待新腳本實作的 fixture 輸入約定**，不是目前已有支援或已建立資料的聲明。總管可在已授權的專用合成 DB 安排資料所有者準備第二／第三社團與有效任期；瀏覽器腳本保持純真實 API，不自行執行 SQL、Docker seed 或任意授權。

已讀後端目前允許有效 `club_president` 對自己社團授予／撤銷 `club_manager` 且 `permissions=[]`，此一般社團操作不要求 MFA；測試可由合法社長先核准新合成會員入社，再授一般管理者，於該會員編輯期間由社長撤權。未來仍須重查此規則，不能為測試新增特例。

額外 permissions、平台／地區高權操作或現行契約要求的其他步驟，需真正 MFA step-up；如無合法憑證／角色則標示受阻並回報，不偽造 `mfa_verified_at`、不拿示範 actor 當 Session、不跳過安全規則。只供獨立後端測試的測試鉤子不能代替瀏覽器使用者的真實驗證。

## 6. 完成條件與全天里程碑

| 全天里程碑 | 狀態 | 輸出／通過條件 |
| --- | --- | --- |
| M0 最新基線與所有權確認 | 待辦 | 確認最新版本、真正缺口、端點及 DTO；沒有與其他個體重複修改；總管保留其他既有變更 |
| M1 最小實作可審閱 | 待辦 | 真實組織設定／scope／有效角色與名冊刷新；展示入口、既有帳號流程及多社籍模型未退化 |
| M2 獨立合成 fixture 就緒 | 待辦 | 合法管理者、第二有效社團、第三無權社團、合成會員及有效任期；不依賴正式資料或繞過 MFA |
| M3 真實 API 與瀏覽器驗收 | 待辦 | 以下驗收矩陣及既有 live 回歸通過，有執行證據；失敗不標成功 |
| M4 獨立審查與交接 | 待辦 | 修正重大問題，凍結檔案、交付來源／驗證／限制，由總管決定 Git 交付與下一階段 |

具體必驗案例：

- **跨社隔離**：授權帳號可切第一／第二社團；取得第三社團 managed 投影與嘗試 PATCH 均被後端拒絕，畫面不可顯示該社私人管理資料；UI 選項或手改 URL 不擴權。
- **撤權立即生效**：一般管理者登入並開啟編輯；另一位合法社長撤銷其角色後，前者下一次 PATCH 與重試均拒絕；重新讀取 `/me` 後移除失效範圍與操作，不能靠舊草稿重新取得權限。
- **持久化**：真實 PATCH 成功後重新整理頁面、重新進入並重新讀取 API，資料及版本仍一致；不能用 React 記憶體、route mock 或 localStorage 假裝資料庫保存。
- **409 草稿**：兩個有權 Session 先讀同版本，另一 Session 先儲存；原 Session 儲存得到真實 409、草稿保留，須明確讀取最新版本後才能繼續，不能自動重送覆寫。
- **隱私刷新**：會員隱藏聯絡欄位後，重新讀取詳情不能保留之前顯示的值；其他會員的欄位不得從本人帳號資料或過去選擇回填。列表仍不顯示私人聯絡資料。
- **多社籍與舊流程**：同人扶青／扶輪可呈現多個社團；註冊、入社審核、名冊刷新與本人帳號既有流程維持可用。地區職務不自動取得雙社入社核准權。
- **前端品質**：相關有意義單元測試、型別／Lint／build 與桌機／窄螢幕操作通過；必要回歸由總管集中執行，不與其他 Agent 競爭輸出或資料庫。

## 7. 可直接貼給獨立對話／Agent 的啟動指令

以下是未來派工提示，**本對話不執行這些步驟**：

```text
任務：R6 會員／社團／有效權限的最小真實串接。
請先讀 /workspace/codex/{AGENTS,USER,roles,HANDOFF}.md、
/workspace/codex-xk-rotaract/AGENTS.md，與
/workspace/codex-xk-rotaract/docs/executive/R6_LIVE_INTEGRATION.md。

先確認總管最新派工、版本與Git狀態，核對live程式、OpenAPI與已有證據，
避免重寫已完成的註冊、登入、入社審核與本人帳號流程。
回報你接受的最小範圍、唯一修改檔案與待協調依賴後，
按本包實作組織設定、授權scope切換、有效權限刷新與名冊刷新。
保留展示模式、多社籍、Session/CSRF、隱私省略與409草稿。

唯一可改 frontend/src/live/**、必要的frontend/src/Portal.tsx、
frontend/scripts/browser-live*.mjs（或新增browser-live-organization.mjs），
及本R6文件。不得自行改後端、契約、package/lockfile、README、
安全政策或正式設定，不新增依賴；跨範圍需求先報總管指定所有者。
Git由總管統一操作，不自行commit/push/merge。

用本包矩陣設計真實API/HTTPS瀏覽器驗收；需要的合成fixture由總管協調，
合法社長API授權/撤權，不跳過MFA。不拿mock當真實API通過證據。
共享npm/Maven/browser/Docker及DB檢查由總管統一執行；
未獲資源排程不要動node_modules/dist/target/共享測試DB。

交付時回報：實際修改檔案、route/DTO對照、驗證命令/日期/結果/證據、
未跑項目、阻礙與下一步、相容性/風險/回退方式，並明確通知檔案凍結。
正式部署、真實郵件、新模組全量串接及收藏持久化不在本次閉環，
不能宣告R6或整個產品已全數完成。
```

未來驗證命令由總管依最新 README／環境選定；已有 `npm run test:browser:live`、`npm run test:browser:live:account`。新組織腳本尚未建立，不得預先宣告新 npm script 存在。若不改 package，可在新檔完成後由總管直接執行 `node scripts/browser-live-organization.mjs`；此處僅交接命令形式，並未執行。

## 8. 暫停條件與回報格式

遇到下列情形，停止受影響的實作或驗證並回報總管；其他不依賴該阻礙的工作可繼續，不自行擴張授權：

- 使用者取消／改派、相同檔案已有其他所有者、最新版本已完成相同功能。
- 必須改後端、契約、共享依賴、安全政策或正式設定才能成立；先交具體差異。
- 缺少合法角色／MFA／獨立 fixture，或目標可能指向正式／真實個資資料庫。
- 準備執行與其他個體共用的 build／browser／DB，尚未排定互斥資源。
- 真實 API 不符合既有契約、跨社資料外洩、撤權仍可寫入、409 覆寫或隱私殘留等重大問題。

交接採下列欄位，不以勾選或計畫代替執行證據：

```text
任務狀態：待辦／執行中／受阻／完成
實際版本與範圍：
唯一修改檔案與原因：
route／DTO與授權來源：
驗證日期、命令、結果與證據位置：
未執行項目與原因：
重大問題、阻礙、解鎖條件：
相容性、回退方式與後續待辦：
檔案是否凍結、總管下一步：
```

後續明確待辦：正式 API 部署與供應商配置、真實郵件交付、新模組全部前後端串接、收藏後端持久化，以及本最小閉環以外的角色授予／交接、歷史同意、完整社籍異動介面。本包不宣稱上述工作已開發、已測試、已排程或已發布。
