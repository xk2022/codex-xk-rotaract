# R4 安全風險盤點與獨立個體派工包

日期：2026-11-13（Asia/Taipei）。盤點基準：`b3b34539edc3ddf18a813b6cd950ec4d5caa4604`。工作指示：使用者已取消本輪實作，改為分派其他個體執行任務；本文件只交付派工與已完成的有限查核，**不代表安全主任務結案**。

**主任務：受阻。** 後端新掃描受來源存取限制；正式 DB／TLS 缺少具名擁有人及非敏感有效配置。前端新發現的核實與維護方案、原 44 項 Medium／Low、例外流程與未覆蓋掃描仍為待辦。先前完成的 pgJDBC 42.7.14 修補保留結案，不重新實作、不再升版。

逐項清單：[R4_RISK_REGISTER.csv](R4_RISK_REGISTER.csv)；可隨 Git 交接的非敏感掃描摘要：[R4_SCAN_EVIDENCE.json](R4_SCAN_EVIDENCE.json)。全部期限均是建議；尚無任何風險例外獲得本輪核准。AI 職能不是具名人員，也不是已在執行中的個體。

## 1. 最新可取得證據與限制

| 證據 | 日期、版本與結果 | 本輪可據以判定的範圍 |
| --- | --- | --- |
| 前端 registry 稽核 | 2026-11-13 09:04:22～09:05:04 台北；checkout `b3b34539…`；Node 24.19.0／npm 11.9.0；283 個 lock package entries | 成功、10 個 Moderate 套件項目，0 High／Critical；全部追溯 **1 個根公告** `GHSA-g3hv-75wg-m249`，不能寫成 10 個不同漏洞。原始 npm exit 1；既有 report-only wrapper exit 0，明示 `vulnerabilities-found`，不是零告警。 |
| NVD 來源小量檢查 | 2026-11-13 09:04:21 台北；一次 GET 官方 modified META | curl exit 56，代理 CONNECT 403，`httpStatus=000`；沒有取得 NVD 的直接 HTTP 回應。未再嘗試、未繞代理、未關閉 TLS 驗證、未開始大型冷更新，**沒有本輪後端新掃描**。 |
| 原後端掃描來源 | 2026-10-18T14:48:46.466221215Z；source head `632b090fe1576a0a29e14177a2d0d47bf0f6dcde` | 原 99 項匹配：21 Critical、34 High、40 Medium、4 Low。這是舊快照；原完整下載報告路徑已不在此 executor，不能冒稱已取得最新全量 JSON。 |
| 原首次逐項核實 | 2026-10-20；同固定 source head；[JSON](../BACKEND_SECURITY_TRIAGE.json)／[CSV](../BACKEND_SECURITY_TRIAGE.csv) | 原 55 項中 54 不適用、1 證據不足是**當時**結果。套用後續 pgJDBC 已修補事實後，本表保留 53 項「不適用有固定證據」，原兩筆 pgJDBC 轉列「已修補」；不改寫歷史快照。 |
| 已完成安全修補與回歸 | [修補紀錄](../BACKEND_SECURITY_REMEDIATION.md)，安全分支 `afbe3be`；[10/21 整合紀錄](../BRANCH_INTEGRATION_2026_10_21.md)，程式整合 `a581bf2d43cf97c2ca7a7d9f4001da2d5efd29e4` | 當時 `clean verify` 114 項通過，0 失敗／錯誤／跳過，含 3 項 SCRAM 回歸及舊版負向對照。本輪未重跑測試，不將其寫成本日 CI 結果。 |
| 本日既存成品／來源查核 | 現存 JAR、POM、Surefire 摘要；目前 `backend/` 相對 `a581bf2…` 無差異，`backend/src/main` 相對 `632b090…` 無差異 | 現存成品只含 pgJDBC 42.7.14，嵌入 driver SHA-256 與原修補證據一致。既存 12 suite 摘要合計 114／0／0／0；並非本日重新建置。固定證據樣本 7 個檔案中 6 個 hash 相同，POM 因 pgJDBC 版本覆寫而不同。 |
| 舊前端零告警結果 | 2026-10-20T16:21:09Z，程式整合 `a581bf2…`，相同 lock hash | 僅保留作歷史對照。registry 公告更新後，同 lock 在 11/13 有 10 個 Moderate，不能繼續引用「0」為現況。 |
| GitHub Actions | 本輪主代理回報 GitHub API 403；R4 未重複請求，也沒有取得新的 run metadata／artifact | 沒有本輪可查驗的遠端 CI 新結果；本地歷史測試不替代同提交遠端檢查。 |

前端 lock SHA-256：`77e068856eb4877d237e29e5e45c58b2434722cb9dbcfe5baf538c4985c6b0a4`。本輪未變更 `package.json`／`package-lock.json`、產品程式、認證／TLS 配置、gate 或 suppression。

本日原始產物位於 `/workspace/shared/executive-20261113/security/`，不隨 Git 搬移；後續需由執行總管安排歸檔或受控 artifact 保存。`R4_SCAN_EVIDENCE.json` 保存來源、時間、commit、POM／lock hash、實際退出碼、10 個套件的版本／範圍、唯一根公告、來源阻礙與原始產物雜湊，供新個體直接交接；這份摘要不能替代完整原始報告或新的掃描。

## 2. 四類風險與下一步

CSV 共 76 列，列數是追蹤單位，**不是目前漏洞總數**：

`workflow_status` 僅使用「待辦／執行中／受阻／完成」四種純值；原有條件與限制完整保留於 `status_note`，歷史核實完成不表示安全主任務完成。

| 分類 | 列數 | 判定與下一步 |
| --- | ---: | --- |
| 實際待修 | 16 | 10 列是同一 minimatch 根公告的受影響套件路徑；另 6 列是後端重掃、44 項未核實、遠端 CI 證據、框架維護方案、gate／例外流程、未覆蓋掃描等工程缺口。後 6 列不表示另有 6 個已證實可利用 CVE。 |
| 待正式配置核實 | 3 | DB 端點／認證／TLS、正式 API／代理 TLS、可選功能與固定不適用前提。缺少具名擁有人及有效配置，維持受阻。 |
| 已修補 | 4 | pgJDBC `CVE-2026-42198`、`CVE-2026-54291`、`CVE-2026-107314`、`CVE-2026-107315` 已納入 42.7.14 修補線；其中後兩筆不是原 99 項掃描清單。本輪保留補證，不重做修補。 |
| 不適用有固定證據 | 53 | 2 Jackson、5 Boot、18 Framework、5 Security、23 Tomcat。只承接固定版本／程式及已提交預設缺少必要前提的證據；套件版本仍可能在公告範圍內，不是永久豁免。正式配置或功能改變須立即重核。 |

### 前端實際新發現

根公告：[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)，`minimatch has potential denial of service via globparts amplification`；registry 列影響範圍 `>=7.0.0 <11.0.1`，目前鎖定 `minimatch 10.2.6`。

| 告警套件 | lock 版本 |
| --- | --- |
| minimatch | 10.2.6 |
| eslint | 10.13.0 |
| @eslint/js | 10.0.1 |
| @eslint/config-array | 0.23.5 |
| typescript-eslint | 8.71.2 |
| @typescript-eslint/eslint-plugin | 8.71.2 |
| @typescript-eslint/parser | 8.71.2 |
| @typescript-eslint/type-utils | 8.71.2 |
| @typescript-eslint/typescript-estree | 8.71.2 |
| @typescript-eslint/utils | 8.71.2 |

這些 lock entries 都是 `dev=true`；風險主要須核實工具鏈是否處理不可信 glob／路徑等輸入，未證明產品遠端使用者可觸發。不能只因開發依賴而自動關閉。`npm fixAvailable` 含跨主版或降版建議，不能直接當相容修補方案；本輪不執行 `audit fix`、`--force` 或版本變更。

### 後端保留事項

- 原 44 項 Medium／Low 尚無可讀的完整原始報告可逐筆還原，本輪不編造 ID。先取得對應 hash 的舊報告，再與未來新掃描分開核實。
- 現存成品為 Boot 3.5.13、Framework 6.2.17、Security 6.5.9、Tomcat 10.1.53、Jackson Databind 2.21.2、pgJDBC 42.7.14。這是成品觀察，並非當日最新可取得版本清單。維護／授權資訊仍須依當期官方資料另核；不得複製 10/20 的版本建議充作 11/13 新結論。
- 既有本專案 report-only 基線已核准；來源、工具及無效報告仍須失敗。本輪不改 `failBuildOnCVSS=11`、`failOnError=true`，不新增 suppression。report-only 不構成任何一筆風險的具名接受。

## 3. 正式 DB／TLS 所需證據

以下只列交付要求；本輪不讀秘密、不存取正式資料、不連正式服務、不修改配置。

| 追蹤 | 需由誰提供（實際人員待指派） | 非敏感證據與驗收 |
| --- | --- | --- |
| `R4-CFG-DB`／ENG-B001 | 具名 DBA、平台維運、DB 設定擁有人、安全覆核人 | 經遮罩的有效 JDBC 參數及 driver／DB 版本；端點與備援解析／網路路徑；SCRAM 與 HBA 規則摘要、最小權限；實際 TLS 模式、信任根、證書鏈、期限及 SAN／hostname；經另行授權，在不讀正式資料的方式下驗證成功及錯 hostname／不可信 CA／錯密碼拒絕。不得提供密碼、完整私有連線字串、私鑰或客戶資料。 |
| `R4-CFG-TLS` | 具名域名／反向代理擁有人、平台維運、安全覆核人 | 正式公開 hostname、TLS 終止點、代理信任邊界與版本化設定摘要；鏈／名稱／期限、HTTP 導向、精確 Origin、Secure／HttpOnly／SameSite Cookie、CSRF 拒絕及撤權行為。local 受信憑證及 HTTPS smoke 不替代正式證據。 |
| `R4-CFG-FEATURES` | 具名部署配置擁有人、安全覆核人 | 正式有效模組與功能摘要，逐筆對照 53 列前提：HTTP/2、Realm／Valve、WebDAV、WebSocket、多型反序列化、SpEL、外部 proxy／容器客製等。有前提成立即重開核實，不能用 suppression 維持不適用。 |

建議 11/16 指定具名擁有人，11/20 交付證據取得與驗收方案；最遲正式上線前完成實際核實。這是建議安排，不是本輪批准任何配置或部署。

## 4. 可直接貼給其他獨立個體的派工指令

下列指令供執行總管後續指派。**目前均未宣稱個體已接案或開始執行**；首輪只做核實／方案，不實作。每個個體先讀 `/workspace/codex/{AGENTS,USER,roles,HANDOFF}.md` 與產品 `AGENTS.md`，回報來源日期、commit／版本、完成證據、阻礙與下一步。主 AI 統一 Git；不可 commit／push／merge，也不可改其他個體檔案。

### R4-A：前端依賴風險核實與維護方案（待辦）

```text
目標：對 GHSA-g3hv-75wg-m249 的 10 個套件項目提出可審閱的處理方案，不進行實作。
輸入：docs/executive/R4_SCAN_EVIDENCE.json 與 R4_RISK_REGISTER.csv 的 R4-FE-*；若原工作區仍可讀，再比對 /workspace/shared/executive-20261113/security/frontend-audit-20261113/{audit,scan-metadata}.json；目前 frontend/package-lock.json、eslint 配置與 CI。原始產物不存在時不得宣稱已重驗原檔。
範圍：唯讀產品程式/package/lock。僅可新建 docs/executive/R4_FE_DEPENDENCY_PLAN.md（需執行總管正式派發後才寫）。與 R6 約定 package/lock 的唯一修改者，本任務不修改。
工作：確認 1 個根公告與 10 個傳遞項目，不放大為 10 個獨立CVE；核實 dev 工具鏈的觸發條件、受信任輸入邊界、相容更新/緩解方案、回歸與回滾；registry fixAvailable 只作線索，禁止 audit fix/--force、升降版或改gate/suppression。
DoD：每個項目對應根公告、鎖定版本與來源hash；版本方案有相容性/可取得性證據及lint/test/build/重掃計畫。未核實項如實受阻，不以dev依賴自動豁免。
AI職能：前端依賴工程/安全研究。具名前端技術負責人及安全覆核人待使用者指定。
建議期限：11/20完成方案；若另案需例外，建議最遲11/27重新審查。尚未核准、未生效；不得當作接受風險。
```

### R4-B：後端來源解鎖與原告警對帳（受阻）

```text
目標：取得可信且對應版本的後端掃描證據，完成原44項未核實的逐項工作交接；不修改產品/依賴。
輸入：R4_SCAN_EVIDENCE.json、BACKEND_SECURITY_TRIAGE.{json,csv,md}、BACKEND_SECURITY_REMEDIATION.md、ENGINEERING_BACKLOG.md；R4-AUDIT-BACKEND/R4-BACKEND-44/R4-CI-EVIDENCE；若原工作區仍可讀再比對 security/nvd-source-probe.json。
已知阻礙：2026-11-13單次官方META請求curl56/CONNECT403；原完整報告路徑缺失；主代理回報GitHub API亦403。不要不斷重試，不繞代理、換假來源、降低TLS驗證或用舊資料冒充新掃描。
範圍：僅可新建 docs/executive/R4_BACKEND_EVIDENCE_PLAN.md；後續獲來源解鎖且總管派發後，才在 /workspace/shared/executive-20261113/security 下保存掃描/取回產物。不可改pom、程式、認證、gate或suppression。
工作：列明環境設定擁有人需解鎖的官方來源與必要artifact讀取；取得原SHA e8686811be01d61ee36b3714ce66ac5d31b59d050a155284ff08cbe51c33b967對應報告，勿編造44個ID。未來新掃描須記commit、POM hash、冷更新時間、工具版本、JSON/HTML/metadata；新舊項目分開對帳。
DoD：來源解鎖前交付精準阻礙與資料需求；解鎖後另行派發重掃及44項逐筆核實。不以目前無法取得報告推定沒有弱點。保留pgJDBC42.7.14與114測試補證，不再升版或重做修補。
AI職能：後端依賴研究/安全研究。具名環境設定擁有人、Repo維護者及安全覆核人待指定。
建議期限：11/16確認來源處理人，11/20交付可驗證方案；如另案核准暫緩，建議例外不晚於11/27，核准前不得視為接受。
```

### R4-C：正式 DB／TLS 證據交付方案（受阻）

```text
目標：為 R4-CFG-DB/TLS/FEATURES 建立具名擁有人與非敏感證據交付/驗收方案，不連正式服務、不改配置。
輸入：本文件第3節、ENGINEERING_BACKLOG的ENG-B001/B002、已提交application.yml/compose及固定53項不適用前提。
範圍：僅可新建 docs/executive/R4_PRODUCTION_EVIDENCE_PLAN.md。禁止讀Secrets、完整JDBC秘密值、私鑰或正式個資；禁止修改認證/TLS/網路權限或部署。
工作：分辨本地合成SCRAM/TLS測試與正式證據。列出DB端點/路由/最小權限/HBA、TLS信任鏈/hostname/有效期、API代理/Origin/Cookie/CSRF、可選模組觸發條件所需的遮罩資料、由誰提供及如何驗收。缺實際環境時只交方案與阻礙。
DoD：每項有設定擁有人、版本化非敏感證據、預期正反例及另行授權的驗收安排；未提供證據維持受阻。不能把pgJDBC已修補退回未修，也不能因此將正式DB/TLS宣告通過。
AI職能：平台/後端配置研究及安全驗收。具名DBA、維運、域名/代理擁有人、安全覆核人待使用者指定。
建議期限：11/16指派人、11/20完成方案；最遲正式上線前實際核實。沒有預設正式上線風險例外；如需暫緩須另案具名核准、明確到期。
```

### R4-D：維護、安全流程與獨立覆核（待辦；不實作）

```text
目標：處理 R4-FRAMEWORK-PLAN/POLICY/COVERAGE，並獨立覆核其他個體產物。
輸入：本文件/CSV、BACKEND_SECURITY_*、ENGINEERING_BACKLOG、ENGINEERING_STANDARDS_CHECKLIST與已提交CI/pom/前端audit腳本。
範圍：僅可新建 docs/executive/R4_SECURITY_POLICY_PROPOSAL.md。不可覆寫R4關閉文件/共享看板、改gate/suppression、升版、購買服務或變更安全政策。
工作：以當期官方可取得性/授權資料提出Boot/BOM維護選項及必要回歸/回滾；列SAST、Secrets、Maven plugins、映像掃描未覆蓋範圍。提出具名例外格式與到期/補償/再評估機制，保留現有已核准report-only政策，供使用者另行決定。
DoD：每個選項有來源日期與限制；沒有最新資料即標受阻，不推薦未驗版本。覆核10 package entries/1根公告、53固定不適用、4已修補、114歷史測試及新掃描受阻的界線；未核准例外不能寫成接受風險。實作者與最後驗收者分開。
AI職能：安全流程/架構研究；獨立驗收另派不同個體。具名技術負責人、安全核准人、Repo/部署維護者待指定。
建議期限：11/20交維護與流程方案；11/27交未覆蓋範圍方案。任何風險例外建議到期日均未核准，不自動生效。
```

## 5. 全天里程碑與具名責任

以下只列全天工作的依賴里程碑；**工時與具體開始／結束時刻由使用者稍後排定**，本節不預填時間或背景排程，也不表示個體已開始。已完成的有限查核保留於第 1、6 節，不把事實時間改成派工承諾。

| 里程碑 | 前置依賴 | 交付 | 狀態／解鎖 |
| --- | --- | --- | --- |
| M0｜派工界線確認 | 使用者需求與本派工包可讀 | 總管指派 R4-A/B/C/D，確認唯一可寫文件、與 R6 邊界、具名人員待指派清單 | 待辦；不啟動程式實作。 |
| M1｜證據與阻礙對帳 | M0 完成；各個體取得來源摘要 | 來源／版本／狀態矩陣與精確阻礙，缺來源／正式資料不得填假結果 | 待辦；R4-B/C 外部資料核實受阻，取得依原權限。 |
| M2｜可審閱方案 | M1 的可用證據與缺口已列清 | 前端依賴／後端來源方案、DB/TLS證據交付清單、維護／例外選項；無法完成部分附解鎖條件 | 待辦；只交方案，不先套用；外部缺證部分維持受阻。 |
| M3｜獨立覆核與總管交接 | M2 產物完成且另有不同個體覆核 | 彙整可交付成果、受阻項及需具名決定事項；工時與下一輪執行順序交使用者安排 | 待辦；未通過者保留待辦／受阻，不以日終為由結案。 |

待具名人員：前端技術負責人、後端技術負責人、安全覆核/核准人、Repo維護者、環境設定擁有人、DBA、平台維運、域名與代理擁有人。使用者指定實際人員後由總管記錄，不從 GitHub 帳號或 AI 職能猜測人名。

## 6. 例外、解鎖與本輪驗收

- 已修補與固定證據不適用不需要「接受漏洞」例外；前者保留版本/補證，後者以必要前提不成立為有效邊界，變更立即重核。
- 實際待修列的 `proposed_exception_expires_at` 只供討論；建議若另案批准暫緩，最遲 11/27 再覆核。`exception_expires_at` 全部維持「尚無已核准例外」。具名核准、原因、補償措施、明確起迄與重核條件未完成前，不視為接受風險；本輪不改安全 gate。
- 主任務解鎖條件：官方掃描來源或同提交 artifact 經授權可讀；原完整44項資料可取得；正式DB/TLS具名擁有人及非敏感配置方案可提供；獨立個體有明確派工與寫入範圍。
- 本輪完成的是兩份派工文件、一份可追溯非敏感掃描摘要與有限查核證據；其餘核實、方案、實作、正式驗收與遠端CI結果仍按CSV狀態追蹤。產品功能開發、正式部署與資料移轉沒有執行。

### 已實際執行的有限檢查

1. 讀取中心/產品規則、目前 Git HEAD 與既有安全/工程文件；未讀Secrets或正式資料。
2. 使用既有 `NPM_CONFIG_CACHE=/workspace/shared/api-task-runtime/npm-cache node scripts/audit-dependencies.mjs`（cwd `frontend`），成功取得 11/13 registry 報告；檢查lock hash未變，產物備份到 shared security。
3. 單次官方 NVD META GET，保存 CONNECT403 阻礙；未啟動後端重掃、未重複碰撞來源限制。
4. 僅讀既有JAR、Surefire摘要與歷史驗證log；核對pgJDBC雜湊、114項摘要與固定來源差異。未執行Maven/Docker/產品測試。
5. 文件交付前檢查CSV分類、唯一ID、四種狀態純值與原註記完整保留、JSON摘要與原始報告/雜湊一致、引用及Git diff；本輪不commit/push/merge，由總管處理。

### 主要證據雜湊

| 檔案 | SHA-256 |
| --- | --- |
| 原10/18完整後端報告（本機缺原檔，hash沿用既存核實來源） | `e8686811be01d61ee36b3714ce66ac5d31b59d050a155284ff08cbe51c33b967` |
| 本日保存前端 `audit.json` | `19bb1819f94700f4a88b8ecdcd69d3a525de7b52981e2703c3fa54cf430f2e5d` |
| 本日前端 `scan-metadata.json` | `006409daf7e85205b59b9d0d0420fabc51dcec898debb5fa9a016fa439bb91a8` |
| `nvd-source-probe.json` | `1d7a0432bdcb4e9d1e5f999dc3869269fc038fb187c88bd96c9d7d0264a3391e` |
| `existing-artifact-inspection.json` | `88989ab5eacd72ae6ad47f873ebd119a3374efd2df310a338ee19290c2f74e8f` |
| `fixed-evidence-recheck.json` | `0dc1fc0b1870fae33aaea349a2f4bd16cca5e367ff3bcea4d3ec84ee439f94a1` |
| 現存JAR內 `postgresql-42.7.14.jar` | `73914527305a40cce504b0d3d90b23caf565136912d607ae8ae7c5895512332c` |

上述日期、commit與版本是證據適用範圍；不將保存的舊快照稱為新的掃描或正式環境驗收。
