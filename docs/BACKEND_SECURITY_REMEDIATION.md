# 後端 pgJDBC 補證與最小安全修補

更新：2026-10-20。來源：ENG-B001／ENG-B002、TASK-003。交付位置：[現有 PR #4](https://github.com/xk2022/codex-xk-rotaract/pull/4)，保留草稿、未合併及未部署；同Head的CI與重掃結果以該PR紀錄為準。

2026-10-21 整併補充：使用者已授權所有相關分支合回 main，PR #4 對應分支已納入本次整合；上列未合併狀態為原交付快照。合併後檢查與尚未完成的來源掃描見[分支整併紀錄](BRANCH_INTEGRATION_2026_10_21.md)，正式環境部署與配置核實仍待完成。

本輪將既有pgJDBC **42.7.10升至42.7.14**，保留Java21、Spring Boot3.5.13、既有API與生產設定。已以舊版負向對照、新版SCRAM安全回歸及完整測試驗證修補，打包成品亦確認移除42.7.10。正式DB／TLS設定仍未驗收；本次修補處理套件缺陷，沒有把尚未提供的正式環境當作已核實。

## 修補範圍與版本依據

`backend/pom.xml`透過Spring Boot既有`postgresql.version`設定42.7.14，無新增應用依賴。既有傳遞依賴checker-qual由3.52.0更新至3.55.1；其餘版本管理維持Boot3.5.13，沒有逐項覆寫Spring或更動安全政策／弱點門檻／suppression。

[官方下載頁](https://jdbc.postgresql.org/download/)與Maven Central於本輪核對的42.7線最新可取得版本皆為42.7.14（2026-10-07），支援Java8以上與Java21，採BSD-2-Clause。未停在只修單項CVE的中間版本。

| 公告 | 受影響範圍 | 最低修復版本 | 本輪界線 |
| --- | --- | --- | --- |
| [CVE-2026-42198](https://github.com/pgjdbc/pgjdbc/security/advisories/GHSA-98qh-xjc8-98pq) | 42.2.0起、42.7.11前 | 42.7.11 | SCRAM迭代數上限缺失；本輪直接驗證預設上限在client proof前拒絕 |
| [CVE-2026-54291](https://github.com/pgjdbc/pgjdbc/security/advisories/GHSA-j92g-9f8w-j867) | 42.7.4至42.7.11 | 42.7.12 | 原配置未啟用require，版本修復已納入；本輪未重現完整TLS／憑證降級情境 |
| [CVE-2026-107314](https://github.com/pgjdbc/pgjdbc/security/advisories/GHSA-rhp9-mr79-r74h) | 42.7.11至42.7.13 | 42.7.14 | requireAuth特殊排除值問題；避免升到中間版本引入已知缺陷，不變更本案認證設定 |
| [CVE-2026-107315](https://github.com/pgjdbc/pgjdbc/security/advisories/GHSA-f64h-wr5q-3qf3) | 42.7.4至42.7.13 | 42.7.14 | 宣告寫入長度大於實際資料的padding缺陷已納版本修復；未聲稱稽核正式既存資料 |

## 補證與安全回歸

新增`PostgresqlSecurityRegressionTest`，只用既有JUnit與JDK在loopback模擬PostgreSQL SCRAM peer。沒有新增測試依賴，也未使用真實端點或個資；僅在該模擬器停用TLS/GSS，不改應用資料來源設定。

| 案例 | 42.7.10負向對照 | 42.7.14 |
| --- | --- | --- |
| 預設上限100000，server送100001 | 預期拒絕斷言失敗；實際仍送proof，最後收到合成28P01 | 08004，錯誤明列scramMaxIterations／client-side limit；server未收到proof |
| 明確上限4096，server送4097 | 預期拒絕斷言失敗；實際仍送proof，最後收到合成28P01 | 08004，明確上限有效，server未收到proof |
| 正常4096 challenge | proof路徑通過 | proof路徑通過，隨後由模擬server以合成28P01結束連線 |

負向對照共3項、2項預期失敗、0errors／skips；新版3項全通過。測試只使用有限100001次挑戰，不發送巨量CPU耗盡參數；frame長度、socket／driver／Future／測試逾時及資源清理均有限制。正常case能送proof，避免把完全停用SCRAM當成修補。

官方42.7.14 `ScramAuthenticator`來源在建立client-final／執行PBKDF2前檢查上限，與本輪協定觀察一致；未使用執行時間快慢代替拒絕行為。

## 本地整合與成品驗證

- Maven3.9.11、Temurin21.0.9、PostgreSQL17.11，獨立合成`*_test`資料庫及明確重設許可，沒有local profile參與重設測試。
- 原11個整合測試檔、111項測試逐檔保留；新增3項後，`clean verify`共**114項通過，0失敗、0錯誤、0跳過**。
- Checkstyle檢查47個main／test來源檔，0error；JaCoCo HTML／XML均產生，沒有新增或降低比例門檻。
- 靜態契約驗證141個操作、158個封閉DTO及1484個JSON範例通過，這不是正式環境UAT。
- 打包JAR只含`postgresql-42.7.14.jar`，沒有42.7.10；嵌入driver的SHA256與官方取得檔一致：`73914527305a40cce504b0d3d90b23caf565136912d607ae8ae7c5895512332c`。
- 測試網路實際連線命中SCRAM HBA規則，正確合成密碼成功、錯誤密碼回28P01；loopback trust規則未命中。這只驗證隔離runtime，測試DB未啟用TLS，不代表正式TLS已完成。

## 同版本 CI 與依賴重掃

PR #4保留原Checkstyle／Coverage、既有整合與兩條HTTPS流程，以及獨立Dependency-Check13.0.0冷啟動job。最新有效結果以**修補Head相同**的Actions執行與artifact為準；metadata記錄實際checkout與PR head，不能把舊10月18日報告算作修補後重掃。

原99項匹配及55項首次核實保留為歷史快照。重掃使用當時最新來源，應逐項看套件／CVE變化，不將數量變動等同可利用性，也不以版本更新推定全部告警清零。正式環境、build plugins、SAST與映像仍非本profile覆蓋範圍。

## 後續工程與階段銜接

本輪不批次升級Spring Boot／Framework／Security／Tomcat。Boot3.5.16是官方最後一版3.5 OSS發布，其BOM仍不足覆蓋較新PG與Tomcat問題；Framework6.2.20與Security6.5.12涉及商業支援，Boot4則為主版本遷移。這些維護選項、授權與回歸成本留待具體方案，不將它們視為已完成或默認可直接採用。

工程待辦保留正式端點／TLS供應、其他框架維護、44項Medium／Low與未覆蓋掃描範圍。01需求基線與原174筆條款不變，02規則需求確認仍可進行。本報告補充ENG-B001／ENG-B002的分支驗證狀態；需求總表與工程待辦的交付進度在實際合併時同步，避免將草稿修補當作develop已交付。本輪更新既有PR #4，不建立新PR、不合併、不部署。
