# R5 工程規範相容性與最小修整方案

日期：2026-11-13（Asia/Taipei）。狀態：**可供決策的設計交付；未執行程式修整，未宣告全量符合中央規範。**

建議保留現有 141 個 `/api/v1` API、Session／CSRF、公開 DTO 白名單、`pageSize` 20～100、HTTP Status／錯誤形狀與 pgJDBC 42.7.14。先完成版本化規範追溯與現有品質檢查的證據對齊，再以單一領域的內部整理驗證成本；中央 API 形狀另走版本化決策。不得為形式一致而整庫改為 Interface＋Impl／JPA，也不能自行把中央明確要求改為可選。

本文件不修改 AGENTS、中央規範、產品程式、工作流程、契約或索引；主代理統一 Git 與後續派工。以下「最小修整」均是建議方案，尚未因寫入本文件而取得重大重構、安全政策或正式部署的授權。

## 1. 證據範圍與分類

| 來源 | 固定版本／本次核實 | 可支持與不可支持的結論 |
| --- | --- | --- |
| [中央 ENGINEERING_STANDARDS v1.0.0](https://github.com/xk2022/xk-engineering-standards/blob/22ef3694eb085c9b39032e2c33d2db755852a72a/ENGINEERING_STANDARDS.md) | 本機唯讀 `/workspace/xk-engineering-standards` HEAD `22ef3694eb085c9b39032e2c33d2db755852a72a`，2026-10-16 | 已核准共同規範；第 10 節仍待定的細節不因工具已有設定就變成中央決策。已由該 checkout 的 `origin` 核對此 GitHub 來源；未修改中央工作目錄。 |
| [產品 AGENTS](../../AGENTS.md) | 產品檢查起始 HEAD `b3b34539edc3ddf18a813b6cd950ec4d5caa4604`，提交日 2026-10-20 | 有中央 v1.0.0 副本與產品補充；既有契約不得自行改寫。 |
| [工程規範清單](../ENGINEERING_STANDARDS_CHECKLIST.md)、[工程待辦](../ENGINEERING_BACKLOG.md) | 同上產品 HEAD；清單盤點 2026-10-18、收尾 2026-10-20 | 已記載 Service、JDBC、API envelope／分頁差異；部分「仍在分支、未合併」為歷史描述，不能用作 2026-11-13 即時狀態。 |
| [整併紀錄](../BRANCH_INTEGRATION_2026_10_21.md) | 同上 HEAD；紀錄標題為 2026-10-21，內含 `a581bf2` 整合結果與歷史驗證 | 證明文件曾記錄 184 項前端、114 項後端與兩條 live HTTPS 流程；本輪未重跑，不能代替目前遠端 CI、正式配置或部署證據。檔名日期與 Git 提交日期分別保留。 |
| [打包契約](../api/openapi.json)、[契約組裝器](../api/build_contract.py)、[驗證器](../api/validate_contract.py) | 本輪實際執行兩項靜態檢查 | 141 operations、158 closed DTO schemas、1484 JSON examples；只確認靜態契約，不代表資料庫授權或執行結果。 |
| [pgJDBC 修補紀錄](../BACKEND_SECURITY_REMEDIATION.md)、[POM](../../backend/pom.xml) | 本輪讀檔確認 `postgresql.version=42.7.14` | 修補不得隨規範整理撤銷；歷史負向對照／SCRAM 回歸及成品證據可追溯，本輪未重驗正式 DB/TLS。 |
| `/workspace/codex/{AGENTS,USER,roles,HANDOFF}.md` | 2026-11-13 合作與派工規則 | 本次工作由總管整合、使用繁體中文與指定檔案交付；不代替產品規範或擴大外部操作授權。 |

分類：**C**＝已確認中央要求；**T**＝中央待定細節；**P**＝已存在的產品特定契約／安全行為；**V**＝若改對外行為需版本化或遷移安排。差異被記錄不等於已取得永久豁免。

## 2. 相容性決策矩陣

| 編號／分類 | 現況證據 | 中央要求 | 相容性差異 | 最小修整建議 | 驗收條件 | 需人決策／阻礙 |
| --- | --- | --- | --- | --- | --- | --- |
| R5-01 C/P/V API 回應 | `openapi.json` Error 為封閉 `code/message/fieldErrors/requestId`；[Errors](../../backend/src/main/java/org/xkrotaract/api/Errors.java)、[live api client](../../frontend/src/live/api.ts) 使用既有形狀，成功 DTO 多為直接物件，另有二進位／無內容 operation | 中央 §5：`code/message/data/traceId`，正確 HTTP Status，Breaking Change 有版本／遷移 | 不可直接包裝 v1；封閉 schema 不允許任意加 `traceId`，且既有 client 讀 `requestId`／直接 DTO | 凍結 v1。提出 v2 adapter 與獨立 schema 的 ADR 草案；先選一讀取列表作相容性試驗設計，列出所有 JSON、204、binary 的適用規則 | v1 schema／範例／既有 client 與錯誤狀態保持；若核准 v2，需新 client contract test、錯誤關聯、204 無 body、binary 不被 JSON 包裝，並列出退場時程 | 決定 v1 有期限的相容性保留與 v2 啟用範圍；成功 `code`、`traceId` 規則等仍屬 T，不能自行預填 |
| R5-02 C/T/P/V 分頁 | `MembersPage`、[ApiSupport.page](../../backend/src/main/java/org/xkrotaract/api/ApiSupport.java)、`live/api.ts`：`items/page/pageSize/total`；page 起點 1、預設20、最小20、最大100 | 中央 §5：`page/size/sort`、`totalElements/totalPages`；§10 page 起點待專案化 | 任意接受 `size`／`sort` 會違反未知 query 拒絕；小頁數會放寬既有會員查詢限制；新增 response 欄位違反封閉 DTO | v1 不增別名、不改20～100。v2 明列 `size` 同一限制與 page 起點；sort 僅允許各資源受控欄位並加穩定 ID 次序，禁止直接 SQL 插值 | 空頁、超範圍／未知參數、極大 page、同值排序、跨版本總筆數一致；`totalPages=ceil(totalElements/size)` 及 total=0 行為先定義；所有現有分頁測試保留 | 決定中央適用的 page 起點及 v2 sort 白名單；不得把中央未定當成產品 v1 未定 |
| R5-03 C/P Session／CSRF／授權 | [SecurityConfig](../../backend/src/main/java/org/xkrotaract/api/SecurityConfig.java)、[SessionService](../../backend/src/main/java/org/xkrotaract/api/SessionService.java)、[ApiSupport](../../backend/src/main/java/org/xkrotaract/api/ApiSupport.java)：Session、Origin／CSRF、目前 grant、MFA、回放重驗 | 中央 §3 共用 Identity 候選，實作前審查安全模型；§7 安全政策變更需核准 | 中央沒有要求立即把 Cookie Session 換 JWT；重構不可丟掉目前授權／回放與私有輸出規則 | 認證保持現狀；列入所有內部整理的不可退化清單。Identity/SSO 只有需求及安全設計核准後另案 | CSRF／Origin 拒絕、匿名投影、跨社／跨區404、撤權回放、Session rotation、MFA、密碼與聯絡資訊不進log；既有安全測試不刪減 | 沒有已核准 SSO 設計或第二產品接入證據；不提取認證平台 |
| R5-04 C/P Service 邊界 | [AccountService](../../backend/src/main/java/org/xkrotaract/api/AccountService.java)、[MembershipService](../../backend/src/main/java/org/xkrotaract/api/MembershipService.java) 為具體 Service；Controller 仍含組合與授權檢查 | 中央 §4：Service Interface＋Impl，Controller 不放業務邏輯 | 目前不全符合；全面加同名 Interface 會造成大量搬檔，仍不改善 CoreService 依賴及交易界線 | 先作單領域試點設計：將單一讀取用途的應用介面與實作拆開；Controller 保留 HTTP 轉換，業務授權移到應用服務；不可移走交易內再授權。依差異證明價值後再排其他模組 | 試點前後 API／資料庫結果相同；Spring bean 唯一注入、交易代理有效、授權在交易內、回放仍重驗；既有全量回歸通過 | 核准分階段達標或有期限的既有碼差異處理；「新程式遵守」不等於舊程式已符合。大規模架構重整需另案 |
| R5-05 C/P 資料存取與交易 | [POM](../../backend/pom.xml) 有 JDBC／Flyway，無 JPA／MyBatis；`CoreService.tx` 與 PostgreSQL row/advisory locks 處理原子 version／回放；membership 轉社保留雙側 grant 重驗 | 中央 §5 JPA 優先、複雜 SQL 可 MyBatis，Service 管理 Transaction；§10 Migration 工具待定 | JPA 是優先評估方向，非要求現在重寫已驗證 SQL；JDBC 差異仍應有正式採用理由 | ADR 比較維持 JDBC、局部 Repository adapter、局部 JPA；推薦本階段維持 JDBC＋Flyway，依模組逐步隔離資料存取，保留鎖與單交易 | 真 PostgreSQL17測雙向轉社、撤權競爭、version衝突、idempotency併發、失敗回滾與Migration新庫／既有庫升級；不以H2代替 | 正式確認既有 JDBC／Flyway 採用理由及期限；任何持久層替換先有比較與成本，不整庫換依賴 |
| R5-06 C/P Request／Response／Validation | `openapi.json` 封閉且分開的 request／response schema；[Input](../../backend/src/main/java/org/xkrotaract/api/Input.java) 檢查未知欄位，Java 多用 JsonNode／Map；ApiException＋全域 Errors | 中央 §4：Request／Response 分離、Bean Validation、BusinessException／handler、明確 null | 契約有 DTO 白名單不等於 Java 已有型別化 DTO／Bean Validation；ApiException 有等效責任但命名不同 | 先選試點的單一 request/response record；保留 Input 未知欄位拒絕及 null／缺欄位差別，再加入已核准依賴的 validation；例外先盤點責任，不為改名而更動error code | 驗證 mass assignment、缺欄位／null、字數、UUID、日期、回應不含Entity／私有欄位；現有錯誤payload完全相容 | 型別化及validation導入範圍／依賴需排程；例外命名採用方式需明示，不能稱現況已全部符合 |
| R5-07 C/T/P Schema 稽核欄位 | [V1 schema](../../backend/src/main/resources/db/migration/V1__core.sql)：snake_case／UUID，多表缺通用四欄；[V11](../../backend/src/main/resources/db/migration/V11__support_and_recovery.sql) 等已有部分時間與actor資訊 | 中央 §5 一般表預設四稽核欄位、特殊例外說明；§10 填入機制待定 | 不可替歷史未知 actor／日期捏造值，也不能改已套用Migration checksum | 按一般業務／技術性／歷史snapshot分類，逐表列必填與例外；獲准後新增forward Migration，先nullable、回填有來源者，再約束；技術清理表另說明 | 空庫及既有資料升級、未知來源保留未知、UTC存瞬間、操作者取登入principal而非body；不改V1～既有檔，不刪資料 | 稽核寫入機制、系統actor及保留期例外待定；破壞性回填／NOT NULL強制不得默認核准 |
| R5-08 C/T 規範同步 | 產品AGENTS有中央副本；`ENGINEERING_STANDARDS_CHECKLIST` 引用 `8088b65`，本次中央checkout HEAD為 `22ef3694`；版本號同v1不代表內容／出處同一快照 | 中央 §8 要求可讀副本及版本化同步；§10 同步方式待定 | 有來源追溯差異，尚未證明實際內容全部漂移；既有文件混有已過時分支狀態 | 先記來源Repo、commit、規範檔SHA256、取得日期與專案補充界線；建議獨立同步PR人工diff，中央正文與產品補充分段。不自動覆寫、不自動merge | 離線可讀；固定版本可重建；來源變更有diff、獨立審查與授權；同步不刪產品安全／契約限制；歷史紀錄加日期註記而不改歷史事實 | 選擇同步頻率及負責人；更新AGENTS／跨repo需另核對授權，本案只設計 |
| R5-09 C/P CI 與必要檢查 | [frontend workflow](../../.github/workflows/verify-frontend.yml) 有lint／V8 coverage／audit／build；[core workflow](../../.github/workflows/core-api.yml) 有Postgres17 verify、Checkstyle／JaCoCo、契約、live HTTPS及獨立audit job | 中央 §7：Build、Unit、Integration、Lint、Security Scan、Coverage；不設固定百分比 | 定義存在不等於成功／required；BE有paths filter，純文件PR可能無此check；未讀遠端ruleset，不能推定branch protection已開 | 保留既有job；核對實際check名稱與required matrix，再設path-aware總閘門：不適用項要明確N/A，不能以缺少check當成功；有行為變更時跑相關必要檢查 | 新PR有穩定結論、失敗／取消／工具錯誤不可被遮蔽；保留141 API靜態、全部有效測試與live安全路徑；coverage報告存在且關鍵斷言充分 | required checks／規則集屬治理設定，需具體核准；本輪沒有查遠端，也不新增coverage百分比 |
| R5-10 C/P 依賴掃描及修補 | `core-api.yml` 冷啟動Dependency-Check；POM `failOnCVSS=11` 表示report-only、`failOnError=true`；FE audit分類exit0/1與執行錯誤；pgJDBC42.7.14 | 中央 §7 要求掃描、不得隱藏失敗；沒有已定弱點嚴重度阻擋門檻 | 歷史整合紀錄NVD CONNECT403為未完成掃描，不可用舊報告補成功；report-only不代表零風險，也不是擅自設high阻擋的授權 | 原政策保留；可用官方來源恢復掃描並核對原始報告、時間、commit、DB冷啟動。維持pgJDBC鎖版與安全回歸，不加虛假suppression | 有效弱點報告與scan-error清楚區分；scan-error job非零、無TLS bypass／舊庫假成功；確認最終JAR driver及security regression未退化 | 若要漏洞等級gate或豁免需另決策；NVD網路可達及本輪最新遠端run尚待證據 |
| R5-11 C/T 排版與檔名 | [Checkstyle](../../backend/config/checkstyle/CHECKSTYLE.xml) 只查unused/redundant imports、型別檔名／單top class；TaskService等有緊密單行格式，FE已有ESLint recommended；舊文件多lowercase | 中央 §4 排版統一但縮排／行寬／工具待定；§8 新一般文件UPPER_SNAKE_CASE | 現有lint成功不能宣稱格式、JavaDoc、架構全符合；全庫rename會破連結且難審查 | 新文件遵現行命名（本檔）；提出Formatter候選與對比樣本，選定後只對觸及檔或單模組獨立format commit，先不混行為變更 | 工具鎖版、同輸入可重現、無語意差異、連結全檢；不移除現有lint規則、不大規模改舊檔名 | 決定indent/行寬/import與工具；未決前不將個人偏好宣告中央標準 |
| R5-12 C/P 共用模組 | 同產品至少三份分頁實作：`Queries.page`、`MembershipService.page`、`ApiSupport.page`，同樣預設20／範圍20～100與`items/page/pageSize/total`；已有ApiSupport／Input可重用 | 中央 §2/§3：同產品三次或跨產品兩需求時評估，非強制抽離；Library/Service採SemVer | 有同產品候選，沒有核實第二產品程式／需求；分頁一致也不表示授權或領域查詢可共用 | 先比較page溢位、空頁、filter次序與error語意；若等價，統一到既有ApiSupport內部helper。產品內共享，不新建外部repo/service；認證／稽核不與page混抽 | 等價案例涵蓋20／100邊界、未知query仍由各資源拒絕、極大page不overflow、授權及filter先於page；不改外部契約 | 技術小步整理由總管排程；跨產品共用等真實第二需求再評估，現階段不提平台包 |
| R5-13 C/P 文件／交付 | 根目錄尚無CHANGELOG與`docs/adr/`（本輪檢查）；有產品需求、API、工程差異與整合紀錄 | 中央 §5/§8：API改動更新CHANGELOG、重大架構ADR、文件版本追溯 | 需求與交付文件不能替代版本變更紀錄或架構決策；既有規範清單部分狀態過期 | 後續具體變更時建立Keep a Changelog及相應ADR；本文件只提供決策入口，不追認舊版所有API已符合 | CHANGELOG只寫實際納入變更、ADR含背景／替代／決策者／日期／後果；文件、執行驗證、部署分欄 | 決策者／版本發布節奏及v1支援期限需確定；不可因文件交付勾選全量完成 |

## 3. 最小方案與先後依賴

1. **先完成追溯與非退化清單（不改行為）**：固定中央／產品來源、更新過時現況說明的提案；將本矩陣的差異與既有工程待辦一一對照，由總管維護唯一追蹤入口。保留所有目前有效測試與安全修補。這一步可評審，不等待v2選型。
2. **核實品質執行與治理差異**：檢查本次commit的前後端必要job、原始reports與真正required checks；掃描網路受限則標阻礙，照常完成不依賴NVD的build／test／lint／contract。不將缺少check當成功，不弱化現有gate。
3. **單一模組內部試點**：只有在相應架構／依賴範圍核准後，選單一讀取用途實作Interface＋Impl與型別化DTO；若有需要再整理資料存取，保持同一JDBC／Flyway與transaction manager。不得一次處理認證、全庫格式與API外形。
4. **獨立處理產品內重複**：三份page helper用等價測試收斂到既有helper；與試點分開commit／回歸，避免把簡單重複變成外部平台。
5. **最後才決定外部契約遷移**：若要求v2 envelope／分頁，先固定JSON／binary／204的映射、錯誤碼／trace、client版本與退場條件，再實作adapter及雙版本測試。v1持續可用，不能靠全域filter偷偷改payload。

回滾：文件／純內部整理可回退獨立commit並跑原回歸；v2未廣泛採用時可關閉其新路由，保留v1。資料表修整一律另做向前修正Migration，不回寫已執行Migration或刪除正式資料。pgJDBC不得隨回退回到已修補前版本；安全修補維持獨立可追溯。

## 4. 決策包（集中供總管安排，不在本文件發問）

| 決策 | 建議預設 | 必要確認內容 | 未決時能繼續的工作 |
| --- | --- | --- | --- |
| D1 既有規範差異如何達標 | 分階段修整並記錄有期限差異；v1保相容 | Service Interface＋Impl試點範圍；JDBC／Flyway理由與後續審查；不因保留而默認永久例外 | 靜態盤點、既有測試、差異文件與小步提案 |
| D2 API外形及相容期 | 有需要時新增v2，不重寫v1 | trace/error/success code、page起點、sort白名單、binary／204、client遷移及退場期限 | v1契約保護、DTO洩漏測試、現有client驗證 |
| D3 同步與格式 | 固定來源＋人工diff；格式單獨變更 | 規範同步負責人／頻率；Java Formatter與具體格式；是否依ADR記工具採用 | 新文件命名合規、現有lint／checkstyle保留 |
| D4 品質與安全gate | 保留目前report-only漏洞政策及所有有效檢查 | 真正required checks與path總閘門、NVD可達方式；新增嚴重度gate另提案 | 區分scan-error與有效告警、檢查修補版本、執行不受阻的checks |
| D5 共用與稽核 | 只先做產品內page helper評估；稽核按表分期 | 稽核欄位填入機制／系統actor；未來第二產品真需求與安全審查另案 | 比對三份實作、整理例外與Migration草案，不建立共用平台 |

## 5. 本輪驗證、限制與交付狀態

- 已讀取中央唯讀規範、產品AGENTS、現行OpenAPI、POM、前後端workflow、代表性Service／controller／client、既有規範與安全修補紀錄。
- 實際執行 `python3 docs/api/build_contract.py --check`：通過，fragment與打包契約一致。
- 實際執行 `python3 docs/api/validate_contract.py`：通過，141 operations／158 closed schemas／1484 JSON examples。這是靜態檢查，未驗證執行中的API、資料庫或授權。
- 未執行本輪Maven、前端build／test、遠端CI／ruleset查詢或NVD重掃；歷史驗證只按固定紀錄引用。
- 本輪完成的是**R5設計文件**。Interface＋Impl、JPA評估／JDBC採用理由、DTO／validation、中央API外形、欄位及格式等差異尚未因本文件而完成；正式部署、SSO或整體安全驗收亦未完成。
- 阻礙：對外v2形狀／支援期限、內部架構差異處理與規範同步工具仍需決策；最新遠端checks與NVD來源可達缺本輪證據。這些不阻礙交付本設計，也不需先修改任何可用v1行為。
- 下一步：由總管將D1～D5與其他規則確認案整合成最小決策批次，選定一個可量測的內部試點，另派實作者與獨立審查者；本文件作者不自行擴大到程式或中央規範變更。

## 6. 改為獨立個體派工的交接包

使用者於2026-11-13取消本輪實作，改以分派其他獨立個體執行。**R5主任務狀態：待辦。** 本輪僅完成研究草案及交接文件，沒有開始正式規則修整或產品程式改動。前述矩陣與最小方案是後續個體的研究輸入，不是已核准設計或已開始的工程階段；已執行的兩項靜態契約檢查亦不改變此狀態。文件交接完成與主任務完成分開記錄。

### 可直接貼給未來獨立個體的啟動指令

> 你負責 `codex-xk-rotaract` 的R5工程規範相容性研究與決策包。先讀管理中心AGENTS／USER／roles／HANDOFF、產品AGENTS與本文件，核對目前Git HEAD及既有改動。中央 `/workspace/xk-engineering-standards` 僅唯讀。你的輸出範圍只有 `docs/executive/R5_ENGINEERING_COMPATIBILITY.md`（如需機器可讀副本，可另建 `R5_COMPATIBILITY_MATRIX.csv`），不得修改程式、AGENTS、契約、workflow、中央規範、共享索引；不Commit／Push／Merge。更新13項矩陣的現況證據，明確區分已確認中央要求、中央待定細節、產品既有契約及需版本化的改動；保留141API基準但以實際checkout核實是否已變動，不刪除新增端點。保留Session／CSRF／DTO／pageSize 20～100／錯誤語意／pgJDBC安全修補與有效測試，不進行整庫Interface＋Impl／JPA改寫。重複程式只在有來源證據時建議抽離，不推定其他產品需求。不設Coverage百分比。提出最小可逆試點、驗收、回滾及需人決策，不把提案寫成已確認。只執行適當的唯讀／靜態檢查，不啟動產品實作或部署。完成交接文件後停止，將決策包交總管整合。

### Scope、DoD與停止條件

| 項目 | 交辦內容 |
| --- | --- |
| 輸入 | 本文件第1～5節、目前產品checkout與已存在工程待辦、固定版本中央規範；其他Agent回報只能當查核線索 |
| Scope | 現況核實、差異矩陣、最小方案及決策整理；只改上述R5文件，不動共享索引或其他人的交付 |
| DoD | 每列具可定位的來源與日期／commit；保留v1安全／相容性限制；區分C/T/P/V；列可驗收試點與回滾、真實共享證據、未決點；文件連結／衝突／格式檢查有結果；獨立審查者非實作者 |
| 決策點 | D1～D5由總管集中；獨立個體不自行核准v2、架構更換、認證政策、required checks或中央規範例外 |
| 回報格式 | 主任務狀態、文件交付狀態、實際HEAD／來源、修改檔案、實跑檢查與結果、未跑項目、重大差異、阻礙與解鎖條件、下一位個體可直接執行的下一步 |
| 停止條件 | 文件達DoD即停；若要擴大寫入範圍、改產品程式／契約／安全設定、跨Repo或需敏感資訊，先停止相依工作並回報總管；未決事項不阻止完成獨立研究，不直接詢問使用者 |

### 全天里程碑（未排具體日期或工時）

| 里程碑 | 完成條件 | 日期／日曆狀態 |
| --- | --- | --- |
| M0 交接準備 | 本輪研究草案、啟動指令及DoD已交總管；不表示已指派下一個體 | 未排日期；未寫入Google日曆 |
| M1 獨立研究交付 | 未來個體核實最新來源、提交決策包，另由獨立審查者查核後交總管 | 待總管安排全天日期；未寫入Google日曆 |

不細排工時，不將M0／M1當成已建立的日曆事件。日曆規則依管理中心的最新有效規則；缺少可用工具、目標calendar ID或建立結果時，僅能回報待安排／未寫入。主任務四種狀態與日曆建立／更新狀態分欄，不用日曆事件存在推定任務開始或完成。
