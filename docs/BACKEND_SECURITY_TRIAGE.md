# 後端 Critical 與 High 告警核實報告

日期：2026-10-20。任務：TASK-002。版本：1.0。

55項告警已完成首次逐項核實：**適用0項、不適用54項、證據不足1項**。尚待補證的是pgJDBC的CVE-2026-42198，列優先修補方案候選，維持未結案。

「不適用」限定目前程式、依賴與已提交預設配置未符合觸發條件；受影響的套件版本仍存在。正式環境、外部配置或功能變更須重新核實，本結果不建立風險豁免或suppression。

需求階段銜接：01已完成，下一主線為02｜規則需求確認。後端補證與修補保留在[工程待辦](ENGINEERING_BACKLOG.md)，P0及未結案狀態不變，不阻擋進入02；本輪不執行修補。

[可篩選逐項CSV](BACKEND_SECURITY_TRIAGE.csv)｜[完整判定及補充證據JSON](BACKEND_SECURITY_TRIAGE.json)｜[需求總表](REQUIREMENTS_MASTER.md#task-002)

## 核實範圍與判定方式

- 程式版本：[`632b090fe1576a0a29e14177a2d0d47bf0f6dcde`](https://github.com/xk2022/codex-xk-rotaract/commit/632b090fe1576a0a29e14177a2d0d47bf0f6dcde)，PR #4於2026-10-20查證仍為open draft、未合併。
- 掃描來源：2026-10-18 Dependency-Check 13.0.0 CI報告；原始99項匹配為21 Critical、34 High、40 Medium、4 Low。本輪僅核實前55項，其餘44項尚未逐項核實。
- 原報告SHA256：`e8686811be01d61ee36b3714ce66ac5d31b59d050a155284ff08cbe51c33b967`。來源CI：[39137504365](https://github.com/xk2022/codex-xk-rotaract/actions/runs/39137504365)。
- 每筆比對官方公告、Maven元件與版本、觸發功能／配置及專案來源。相關依賴一併檢查；spring-core或spring-security-core的產品級CPE命中不直接代表相關可選模組已啟用。
- 適用：必要元件、受影響版本與目前啟用的觸發路徑成立；不表示已發生利用。不適用：有具體證據顯示必要模組或配置條件未成立。證據不足：仍缺少足以判定前提的證據。
- 本輪為靜態適用性核實，未執行PoC、重掃、建置或程式測試。掃描等級與官方等級分欄保留，不因官方評級較低而刪除原告警。

## 各套件結果

| 掃描套件 | Critical | High | 適用 | 目前配置不適用 | 證據不足 |
| --- | --- | --- | --- | --- | --- |
| jackson-databind-2.21.2.jar | 0 | 2 | 0 | 2 | 0 |
| postgresql-42.7.10.jar | 0 | 2 | 0 | 1 | 1 |
| spring-boot-3.5.13.jar | 2 | 3 | 0 | 5 | 0 |
| spring-core-6.2.17.jar | 7 | 11 | 0 | 18 | 0 |
| spring-security-core-6.5.9.jar | 1 | 4 | 0 | 5 | 0 |
| tomcat-embed-core-10.1.53.jar | 11 | 12 | 0 | 23 | 0 |

## 工程待辦優先級與驗收

| 順序 | 處理項目 | 完成條件 |
| --- | --- | --- |
| P0 | 保留CVE-2026-42198未結案，先核對實際DB端點與認證保護，準備driver修補候選 | 記錄設定擁有人、SCRAM與端點身分驗證／TLS的有效配置及證據，不收集密碼。不能只以未觀察到攻擊或loginTimeout當結案。 |
| P0 | TASK-003：提出相容的Boot/BOM、pgJDBC及Jackson維護升級方案 | 比對候選完整依賴、最新公告、Java21相容、修復覆蓋、可取得性／授權、必要回歸與回滾；提交可審閱方案後才按授權實作。 |
| P1 | 補齊尚未逐項核實的44項Medium/Low與未覆蓋掃描範圍 | 分開安排後續核實與原始碼、build plugin、映像等掃描方案；不將本輪55項結論擴大為完整安全驗收。 |
| P2 | 將配置前提納入部署前與功能變更檢查 | HTTP/2、TLS／proxy、Realm、WebDAV、WebSocket、SpEL、多型反序列化或其他可選功能啟用前重核相關項目，保留版本與證據。 |

工作優先級是後續安排，不是新的弱點阻擋政策。供應者分級、CI severity gate及例外核准機制仍依ENG-Q005另行決策。

修復版欄僅列各CVE的最低修復資訊。Tomcat 10.1.58候選發佈投票失敗，該批實際可取得版本至少10.1.59；Spring部分6.2.20與Security 6.5.12公告標為Enterprise Support Only，不能預設免費可用。這些資訊均須由TASK-003再確認，不直接推薦跨主版本升級。

本次查閱的官方頁面已有原55項以外的後續公告，例如Tomcat修補回歸及較新pgJDBC問題。因此10.1.55／10.1.59或42.7.11／42.7.12等單項修復版不能視為當前完整安全目標。

## 逐項判定與證據

### CVE-2026-54512

**不適用**｜jackson-databind-2.21.2.jar｜掃描HIGH；供應者本次核實資料未另錄；不推定與掃描相同

- 必要條件：啟用多型反序列化，容許輸入控制Java類別type ID，並依賴PTV允許清單；泛型型別參數驗證繞過。
- 元件與版本：是；com.fasterxml.jackson.core:jackson-databind；是；2.21.2在官方2.19.0至2.21.3受影響範圍。
- 判定理由：目前接收與回放路徑使用JsonNode/tree model，35個主程式Java來源及已提交Jackson設定未啟用類別名稱多型typing/PTV或相關註解。因此本案目前配置缺少公告必要觸發前提；元件/版本匹配本身仍有效，不能寫成NVD誤判或已修復。
- 本CVE最低修復資訊：2.21.4（本案2.21線最低修復；非最新安全版本保證）。
- 專案證據：[backend/src/main/resources/application.yml:10-12](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L10) 唯一已提交Jackson設定為fail-on-unknown-properties；未設定多型typing/PTV。；[backend/src/main/java/org/xkrotaract/api/EventController.java:26-35](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/EventController.java#L26) 代表性寫入入口以@RequestBody JsonNode接收JSON，非根據輸入中的Java類別名稱建立任意bean。；[backend/src/main/java/org/xkrotaract/api/CoreService.java:25,37-43,119-124](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/CoreService.java#L25) 使用Spring注入ObjectMapper；冪等回放以readTree讀為JsonNode。；[backend/src/main/java/:all 35 main Java source files](https://github.com/xk2022/codex-xk-rotaract/tree/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/) 靜態搜尋JsonTypeInfo、JsonSubTypes、PolymorphicTypeValidator、activateDefaultTyping、enableDefaultTyping、setDefaultTyping、new ObjectMapper/JsonMapper、Jackson2ObjectMapperBuilder及addMixIn皆無命中；readValue/treeToValue/convertValue及自訂Jackson module註冊也無命中。
- 官方來源：[CVE-2026-54512 官方資料1](https://github.com/FasterXML/jackson-databind/security/advisories/GHSA-j3rv-43j4-c7qm)；[CVE-2026-54512 官方資料2](https://github.com/FasterXML/jackson-docs/wiki/JacksonPolymorphicDeserialization)
- 後續：記錄為目前配置不適用；未來增加多型typing、PTV、JsonTypeInfo、mix-in或自訂mapper時重核。後續BOM/依賴升級方案仍評估Jackson修補線並重掃最新公告，不以不適用判定建立永久豁免。

### CVE-2026-54513

**不適用**｜jackson-databind-2.21.2.jar｜掃描HIGH；供應者本次核實資料未另錄；不推定與掃描相同

- 必要條件：使用BasicPolymorphicTypeValidator.Builder.allowIfSubTypeIsArray()允許陣列並接受攻擊者控制的多型JSON；陣列元素型別未經相同允許清單檢查。
- 元件與版本：是；com.fasterxml.jackson.core:jackson-databind；是；2.21.2在官方>=2.19.0,<2.21.4受影響範圍。
- 判定理由：本案沒有BasicPolymorphicTypeValidator/allowIfSubTypeIsArray或類別名稱多型反序列化配置；API以JsonNode接收。公告必要的陣列型別允許策略不存在，故目前配置不適用；依賴版本仍受影響。
- 本CVE最低修復資訊：2.21.4（本案2.21線最低修復；非最新安全版本保證）。
- 專案證據：[backend/src/main/resources/application.yml:10-12](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L10) 唯一已提交Jackson設定為fail-on-unknown-properties；未設定多型typing/PTV。；[backend/src/main/java/org/xkrotaract/api/EventController.java:26-35](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/EventController.java#L26) 代表性寫入入口以@RequestBody JsonNode接收JSON，非根據輸入中的Java類別名稱建立任意bean。；[backend/src/main/java/org/xkrotaract/api/CoreService.java:25,37-43,119-124](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/CoreService.java#L25) 使用Spring注入ObjectMapper；冪等回放以readTree讀為JsonNode。；[backend/src/main/java/:all 35 main Java source files](https://github.com/xk2022/codex-xk-rotaract/tree/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/) 靜態搜尋JsonTypeInfo、JsonSubTypes、PolymorphicTypeValidator、activateDefaultTyping、enableDefaultTyping、setDefaultTyping、new ObjectMapper/JsonMapper、Jackson2ObjectMapperBuilder及addMixIn皆無命中；readValue/treeToValue/convertValue及自訂Jackson module註冊也無命中。
- 官方來源：[CVE-2026-54513 官方資料1](https://github.com/FasterXML/jackson-databind/security/advisories/GHSA-rmj7-2vxq-3g9f)；[CVE-2026-54513 官方資料2](https://github.com/FasterXML/jackson-docs/wiki/JacksonPolymorphicDeserialization)
- 後續：保持目前不使用未受信任類別名稱多型typing的設計；若新增PTV/allowIfSubTypeIsArray或相關註解重核。後續升級方案需依Boot/BOM相容性及最新重掃選版本，不能把2.21.4當全部告警的最終安全終點。

### CVE-2026-54291

**不適用**｜postgresql-42.7.10.jar｜掃描HIGH；供應者本次核實資料未另錄；不推定與掃描相同

- 必要條件：TLS/SCRAM連線明確設定channelBinding=require，且網路中間人可提供無法產生channel-binding hash的server certificate，造成PLUS保護降級；官方明確說default prefer不屬此漏洞。
- 元件與版本：是；org.postgresql:postgresql驅動程式本身，不是PostgreSQL server CPE誤判；是；42.7.10在官方>=42.7.4,<42.7.12受影響範圍。
- 判定理由：已提交預設與CI URL未設定channelBinding=require，且沒有datasource properties或自訂連線建立程式補入require。官方default prefer不承諾必須channel binding，故這筆require保護降級不適用於目前配置。低信心CPE沒有推翻官方套件/版本吻合；DATABASE_URL可由環境覆寫，故此判定不涵蓋未提交的部署設定。
- 本CVE最低修復資訊：42.7.12（本CVE最低修復版；非最新安全版本或升級終點保證）。
- 專案證據：[backend/pom.xml:8-11](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/pom.xml#L8) 使用spring-boot-starter-jdbc及org.postgresql:postgresql runtime driver；原掃描package座標確認driver42.7.10。；[backend/src/main/resources/application.yml:1-5](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 資料來源URL由DATABASE_URL覆寫，提交預設為localhost PostgreSQL URL；未固定sslmode、channelBinding或SCRAM迭代上限。；[.github/workflows/core-api.yml:70-86](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/.github/workflows/core-api.yml#L70) CI PostgreSQL17 service；已提交JDBC URL為127.0.0.1且沒有channelBinding=require。；[compose.yaml:4-13](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/compose.yaml#L4) 本地PostgreSQL17容器只把port綁定127.0.0.1；image只固定主版本，非實際serverminor或映像安全證據。；[backend/README.md:120](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/README.md#L120) 正式API尚未部署；正式DB連線路徑、TLS與身份驗證設定須另外核實。
- 官方來源：[CVE-2026-54291 官方資料1](https://github.com/pgjdbc/pgjdbc/security/advisories/GHSA-j92g-9f8w-j867)；[CVE-2026-54291 官方資料2](https://jdbc.postgresql.org/changelogs/2026-06-29-42.7.12-release/)；[CVE-2026-54291 官方資料3](https://jdbc.postgresql.org/documentation/use/)
- 後續：記錄目前配置不適用；若DATABASE_URL、TLS或channelBinding=require設定改變立即重核。後續driver修補方案至少評估本修復線並重掃當時最新公告；正式DB/TLS政策另案確認，不在本輪改設定。

### CVE-2026-42198

**證據不足**｜postgresql-42.7.10.jar｜掃描HIGH；供應者本次核實資料未另錄；不推定與掃描相同

- 必要條件：driver以SCRAM-SHA-256對惡意、受侵或可被冒充的PostgreSQL端點認證；該端點可指定過高PBKDF2迭代數。loginTimeout不會完整停止舊版背景運算。
- 元件與版本：是；org.postgresql:postgresql驅動程式本身，不是PostgreSQL server弱點；是；42.7.10在官方>=42.2.0,<42.7.11受影響範圍。
- 判定理由：應用確實使用受影響driver連線PostgreSQL且未有客戶端迭代上限；已提交連線沒有顯式verify-full身份驗證設定。本地/CI為loopback與臨時DB，沒有已證實不受信任DB URL由產品使用者供應的路徑，但也未提供足以將SCRAM端點可信性及網路身份保護確實排除風險的證據。不能因未觀察到DB已遭攻擊就判不適用；目前保留條件待核實，並列優先driver修補候選。
- 本CVE最低修復資訊：42.7.11（本CVE最低修復；42.7.12為同批另一CVE最低修復，兩者均不代表最新安全終點）。
- 專案證據：[backend/pom.xml:8-11](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/pom.xml#L8) 使用spring-boot-starter-jdbc及org.postgresql:postgresql runtime driver；原掃描package座標確認driver42.7.10。；[backend/src/main/resources/application.yml:1-5](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 資料來源URL由DATABASE_URL覆寫，提交預設為localhost PostgreSQL URL；未固定sslmode、channelBinding或SCRAM迭代上限。；[.github/workflows/core-api.yml:70-86](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/.github/workflows/core-api.yml#L70) CI PostgreSQL17 service；已提交JDBC URL為127.0.0.1且沒有channelBinding=require。；[compose.yaml:4-13](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/compose.yaml#L4) 本地PostgreSQL17容器只把port綁定127.0.0.1；image只固定主版本，非實際serverminor或映像安全證據。；[backend/README.md:120](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/README.md#L120) 正式API尚未部署；正式DB連線路徑、TLS與身份驗證設定須另外核實。
- 官方來源：[CVE-2026-42198 官方資料1](https://github.com/pgjdbc/pgjdbc/security/advisories/GHSA-98qh-xjc8-98pq)；[CVE-2026-42198 官方資料2](https://jdbc.postgresql.org/changelogs/2026-04-28-42/)
- 後續：列優先driver修補方案候選；先核實實際認證機制、資料來源設定擁有人、端點/TLS身份驗證與連線池重試設定，不收集秘密值。TASK003另提出Boot/BOM相容升級與回歸/最新重掃計畫；不以單加loginTimeout或未觀察攻擊當結案證據。

### CVE-2026-40974

**不適用**｜spring-boot-3.5.13.jar｜掃描CRITICAL；供應者MEDIUM

- 必要條件：需實際啟用Cassandra SSL自動設定並向Cassandra建立TLS連線。
- 元件與版本：spring-boot與autoconfigure存在；必要Cassandra driver/CqlSession與Cassandra功能依賴不在掃描classpath。；是；3.5.13落於官方3.5.0–3.5.13範圍。
- 判定理由：固定版本確實落於Boot受影響版本；本案資料來源是PostgreSQL，未引入Cassandra driver且沒有Cassandra設定，故此固定程式/依賴範圍不適用。
- 本CVE最低修復資訊：3.5.14。
- 專案證據：[backend/pom.xml:3-16](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/pom.xml#L3) 父版本3.5.13；web/security/jdbc等依賴明列，沒有本列特定可選功能starter。；[補充證據 BOOT_SECURITY_CLASSPATH_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) 原10/18 Dependency-Check報告主條目53+related34共87條目，保留Maven purl名單與缺少模組檢查；不代表本輪重新resolve。；[backend/src/main/resources/application.yml:1-5](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 資料來源是PostgreSQL JDBC，未設定Cassandra。
- 官方來源：[CVE-2026-40974 官方資料1](https://spring.io/security/cve-2026-40974/)
- 後續：保留此版本與配置的逐項證據，不新增suppression；若導入相關功能或變更環境設定須重核。後續評估Boot/BOM修補時同時確認Java21相容、整體修復覆蓋及必要回歸，本輪不升級。

### CVE-2026-40971

**不適用**｜spring-boot-3.5.13.jar｜掃描CRITICAL；供應者MEDIUM

- 必要條件：需使用RabbitMQ自動設定並以SSL bundle連接broker。
- 元件與版本：Boot自動設定存在；RabbitMQ/AMQP client與spring-rabbit不在掃描classpath。；是；3.5.13落於官方3.5.0–3.5.13範圍。
- 判定理由：Boot版本吻合，但本案無RabbitMQ依賴、broker或SSL-bundle設定，不能由Boot核心CPE推定存在該連線。
- 本CVE最低修復資訊：3.5.14。
- 專案證據：[backend/pom.xml:3-16](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/pom.xml#L3) 父版本3.5.13；web/security/jdbc等依賴明列，沒有本列特定可選功能starter。；[補充證據 BOOT_SECURITY_CLASSPATH_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) 原10/18 Dependency-Check報告主條目53+related34共87條目，保留Maven purl名單與缺少模組檢查；不代表本輪重新resolve。；[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 僅PostgreSQL、multipart、Jackson、server與自有app設定；無RabbitMQ或SSL bundle。
- 官方來源：[CVE-2026-40971 官方資料1](https://spring.io/security/cve-2026-40971/)
- 後續：保留此版本與配置的逐項證據，不新增suppression；若導入相關功能或變更環境設定須重核。後續評估Boot/BOM修補時同時確認Java21相容、整體修復覆蓋及必要回歸，本輪不升級。

### CVE-2026-40972

**不適用**｜spring-boot-3.5.13.jar｜掃描HIGH；供應者HIGH

- 必要條件：需打包/使用DevTools remote功能並配置remote secret，攻擊者能接觸該遠端入口。
- 元件與版本：受影響功能位於spring-boot-devtools，該模組不在固定POM或掃描classpath。；是；3.5.13落於官方3.5.0–3.5.13範圍。
- 判定理由：本案沒有DevTools依賴或remote secret配置，故remote secret比較路徑不存在於受審查應用；Boot共同CPE命中不足以表示此功能存在。
- 本CVE最低修復資訊：3.5.14。
- 專案證據：[backend/pom.xml:3-16](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/pom.xml#L3) 父版本3.5.13；web/security/jdbc等依賴明列，沒有本列特定可選功能starter。；[補充證據 BOOT_SECURITY_CLASSPATH_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) 原10/18 Dependency-Check報告主條目53+related34共87條目，保留Maven purl名單與缺少模組檢查；不代表本輪重新resolve。；[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 無spring.devtools.remote.secret設定。
- 官方來源：[CVE-2026-40972 官方資料1](https://spring.io/security/cve-2026-40972/)
- 後續：保留此版本與配置的逐項證據，不新增suppression；若導入相關功能或變更環境設定須重核。後續評估Boot/BOM修補時同時確認Java21相容、整體修復覆蓋及必要回歸，本輪不升級。

### CVE-2026-40975

**不適用**｜spring-boot-3.5.13.jar｜掃描HIGH；供應者MEDIUM

- 必要條件：將Spring屬性${random.value}輸出當作secret；random.uuid不受本告警影響。
- 元件與版本：Boot RandomValuePropertySource在classpath；本案沒有把其random.value用作秘密。；是；3.5.13落於官方3.5.0–3.5.13範圍。
- 判定理由：現行設定由IDEMPOTENCY_SECRET明確注入；Session/CSRF及GCM nonce使用SecureRandom，追蹤來源沒有${random.value}引用。因此當前程式/已提交設定的使用前提不成立；無法由本審查背書未來外部注入的秘密生成方式。
- 本CVE最低修復資訊：3.5.14。
- 專案證據：[backend/src/main/resources/application.yml:19-21](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L19) 冪等秘密由外部IDEMPOTENCY_SECRET提供，無random.value預設。；[backend/src/main/java/org/xkrotaract/api/SessionService.java:25-28,87-98](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SessionService.java#L25) Session/CSRF使用SecureRandom產生32 bytes，存DB自有Session。；[backend/src/main/java/org/xkrotaract/api/ReplayCipher.java:19-23,38-43](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/ReplayCipher.java#L19) 秘密檢查長度，AES-GCM nonce由SecureRandom產生。；[補充證據 BOOT_SECURITY_SOURCE_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) 固定來源與追蹤配置未見random.value引用；未查看秘密值。
- 官方來源：[CVE-2026-40975 官方資料1](https://spring.io/security/cve-2026-40975/)
- 後續：保留此版本與配置的逐項證據，不新增suppression；若導入相關功能或變更環境設定須重核。後續評估Boot/BOM修補時同時確認Java21相容、整體修復覆蓋及必要回歸，本輪不升級。

### CVE-2026-40973

**不適用**｜spring-boot-3.5.13.jar｜掃描HIGH；供應者HIGH

- 必要條件：本機攻擊者控制可預測暫存目錄；server.servlet.session.persistent=true且攻擊跨應用重啟持續，才可讀Session/可能執行gadget。
- 元件與版本：Boot ApplicationTemp及Servlet Session設定類存在，但容器持久化Session未啟用。；是；3.5.13落於官方3.5.0–3.5.13範圍。
- 判定理由：固定設定未覆寫persistent，v3.5.13 Session原始碼boolean預設false；自有帳號Session存PostgreSQL api_sessions，SecurityFilterChain採STATELESS。本判定針對已提交設定與其預設，不涵蓋尚未提供的正式環境覆寫。
- 本CVE最低修復資訊：3.5.14。
- 專案證據：[backend/src/main/resources/application.yml:13-21](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L13) 沒有設定server.servlet.session.persistent或store-dir。；[backend/src/main/java/org/xkrotaract/api/SecurityConfig.java:17-79](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SecurityConfig.java#L17) 唯一SecurityFilterChain採自訂DB SessionService、STATELESS，不配置X509、SAML、OAuth2/DPoP或WebAuthn。；[backend/src/main/java/org/xkrotaract/api/SessionService.java:43-78,87-98](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SessionService.java#L43) 帳號Session以api_sessions SQL查詢及建立，未用HttpSession序列化。
- 官方來源：[CVE-2026-40973 官方資料1](https://spring.io/security/cve-2026-40973/)；[CVE-2026-40973 官方資料2](https://github.com/spring-projects/spring-boot/blob/v3.5.13/spring-boot-project/spring-boot/src/main/java/org/springframework/boot/web/servlet/server/Session.java)
- 後續：保留此版本與配置的逐項證據，不新增suppression；若導入相關功能或變更環境設定須重核。後續評估Boot/BOM修補時同時確認Java21相容、整體修復覆蓋及必要回歸，本輪不升級。

### CVE-2026-41855

**不適用**｜spring-core-6.2.17.jar｜掃描CRITICAL；供應者HIGH

- 必要條件：untrusted JMS 接收端使用 Jackson JMS converter，且未限制可反序列化型別
- 元件與版本：部分Framework相關module在classpath，但公告必要功能未使用；spring-jms 不在87個已解析條目內；程式無JMS或converter使用；產品系列版本6.2.17落在官方受影響範圍；不以此單獨判定專案可觸發。
- 判定理由：未包含spring-jms；spring-core的Framework產品級CPE匹配不能證明JMS元件存在
- 本CVE最低修復資訊：6.2.19。
- 專案證據：[backend/pom.xml:3-16](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/pom.xml#L3) Boot3.5.13 starter-web/security/jdbc，未新增JMS/WebFlux/WebSocket/RSocket/Jetty/Aalto等依賴；[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 已查完整設定；Servlet multipart、Jackson及DB設定，未配置reactive/SpEL/resource版本策略；[補充證據 FRAMEWORK_RESOLVED_DEPENDENCIES.json](BACKEND_SECURITY_TRIAGE.json) 2026-10-18報告完整展開53主條目+34related；Framework core/beans/expression/web/webmvc皆6.2.17；沒有上述可選模組；[補充證據 FRAMEWORK_CODE_SEARCH_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) jms：35個main Java與1個application.yml的對應搜尋零匹配；另已查controllers與依賴，不只依賴單次搜尋
- 官方來源：[CVE-2026-41855 官方資料1](https://spring.io/security/cve-2026-41855/)
- 後續：保留條件式不適用證據；若新增相關功能、依賴或外部配置須重新核實。後續統一由Boot/BOM相容方案評估維護更新，不在本輪建立suppression或直接升級。

### CVE-2026-47884

**不適用**｜spring-core-6.2.17.jar｜掃描CRITICAL；供應者MEDIUM

- 必要條件：使用XsltView、/**可觸發view rendering且未明確指定view name
- 元件與版本：部分Framework相關module在classpath，但公告必要功能未使用；本案為@RestController JSON/bytes API，無XsltView、ViewResolver或ModelAndView；產品系列版本6.2.17落在官方受影響範圍；不以此單獨判定專案可觸發。
- 判定理由：spring-webmvc存在且版本落範圍，但缺少公告要求的Xslt view與隱式view名稱流程
- 本CVE最低修復資訊：6.2.20。
- 專案證據：[backend/pom.xml:3-16](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/pom.xml#L3) Boot3.5.13 starter-web/security/jdbc，未新增JMS/WebFlux/WebSocket/RSocket/Jetty/Aalto等依賴；[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 已查完整設定；Servlet multipart、Jackson及DB設定，未配置reactive/SpEL/resource版本策略；[補充證據 FRAMEWORK_RESOLVED_DEPENDENCIES.json](BACKEND_SECURITY_TRIAGE.json) 2026-10-18報告完整展開53主條目+34related；Framework core/beans/expression/web/webmvc皆6.2.17；沒有上述可選模組；[補充證據 FRAMEWORK_CODE_SEARCH_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) views_sse_functional：35個main Java與1個application.yml的對應搜尋零匹配；另已查controllers與依賴，不只依賴單次搜尋；[backend/src/main/java/org/xkrotaract/api/ApiController.java:9-10,32-39,55-62,81-84](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/ApiController.java#L9) 註解@RestController、JsonNode request bodies與Map查詢；[backend/src/main/java/org/xkrotaract/api/Input.java:7-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/Input.java#L7) 以明確JsonNode欄位白名單和型別處理輸入
- 官方來源：[CVE-2026-47884 官方資料1](https://spring.io/security/cve-2026-47884/)
- 後續：保留條件式不適用證據；若新增相關功能、依賴或外部配置須重新核實。後續統一由Boot/BOM相容方案評估維護更新，不在本輪建立suppression或直接升級。

### CVE-2026-47890

**不適用**｜spring-core-6.2.17.jar｜掃描CRITICAL；供應者LOW

- 必要條件：以SSE向其他使用者送出包含攻擊者控制資料的view fragments
- 元件與版本：部分Framework相關module在classpath，但公告必要功能未使用；無SseEmitter、ServerSentEvent、view fragment或template/view配置；產品系列版本6.2.17落在官方受影響範圍；不以此單獨判定專案可觸發。
- 判定理由：MVC元件存在，但未使用SSE與view fragments，與一般JSON API回覆不同
- 本CVE最低修復資訊：6.2.20。
- 專案證據：[backend/pom.xml:3-16](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/pom.xml#L3) Boot3.5.13 starter-web/security/jdbc，未新增JMS/WebFlux/WebSocket/RSocket/Jetty/Aalto等依賴；[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 已查完整設定；Servlet multipart、Jackson及DB設定，未配置reactive/SpEL/resource版本策略；[補充證據 FRAMEWORK_RESOLVED_DEPENDENCIES.json](BACKEND_SECURITY_TRIAGE.json) 2026-10-18報告完整展開53主條目+34related；Framework core/beans/expression/web/webmvc皆6.2.17；沒有上述可選模組；[補充證據 FRAMEWORK_CODE_SEARCH_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) views_sse_functional：35個main Java與1個application.yml的對應搜尋零匹配；另已查controllers與依賴，不只依賴單次搜尋；[backend/src/main/java/org/xkrotaract/api/ApiController.java:9-10,32-39,55-62,81-84](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/ApiController.java#L9) 註解@RestController、JsonNode request bodies與Map查詢；[backend/src/main/java/org/xkrotaract/api/Input.java:7-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/Input.java#L7) 以明確JsonNode欄位白名單和型別處理輸入
- 官方來源：[CVE-2026-47890 官方資料1](https://spring.io/security/cve-2026-47890/)
- 後續：保留條件式不適用證據；若新增相關功能、依賴或外部配置須重新核實。後續統一由Boot/BOM相容方案評估維護更新，不在本輪建立suppression或直接升級。

### CVE-2026-47891

**不適用**｜spring-core-6.2.17.jar｜掃描CRITICAL；供應者MEDIUM

- 必要條件：WebFlux使用Aalto XML processor，依賴maxInMemorySize限制XML解碼
- 元件與版本：部分Framework相關module在classpath，但公告必要功能未使用；無spring-webflux或Aalto依賴；採Servlet MVC、JsonNode請求體；產品系列版本6.2.17落在官方受影響範圍；不以此單獨判定專案可觸發。
- 判定理由：spring-web可能包含codec類別，但WebFlux/Aalto使用條件不成立
- 本CVE最低修復資訊：6.2.20。
- 專案證據：[backend/pom.xml:3-16](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/pom.xml#L3) Boot3.5.13 starter-web/security/jdbc，未新增JMS/WebFlux/WebSocket/RSocket/Jetty/Aalto等依賴；[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 已查完整設定；Servlet multipart、Jackson及DB設定，未配置reactive/SpEL/resource版本策略；[補充證據 FRAMEWORK_RESOLVED_DEPENDENCIES.json](BACKEND_SECURITY_TRIAGE.json) 2026-10-18報告完整展開53主條目+34related；Framework core/beans/expression/web/webmvc皆6.2.17；沒有上述可選模組；[補充證據 FRAMEWORK_CODE_SEARCH_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) reactive_websocket_rsocket：35個main Java與1個application.yml的對應搜尋零匹配；另已查controllers與依賴，不只依賴單次搜尋
- 官方來源：[CVE-2026-47891 官方資料1](https://spring.io/security/cve-2026-47891/)
- 後續：保留條件式不適用證據；若新增相關功能、依賴或外部配置須重新核實。後續統一由Boot/BOM相容方案評估維護更新，不在本輪建立suppression或直接升級。

### CVE-2026-47892

**不適用**｜spring-core-6.2.17.jar｜掃描CRITICAL；供應者MEDIUM

- 必要條件：WebFlux functional endpoints 經DispatcherServlet處理並依賴header predicates
- 元件與版本：部分Framework相關module在classpath，但公告必要功能未使用；無spring-webflux、RouterFunction或functional endpoint；端點以註解宣告；產品系列版本6.2.17落在官方受影響範圍；不以此單獨判定專案可觸發。
- 判定理由：具有MVC DispatcherServlet不等於使用公告指定WebFlux functional endpoints
- 本CVE最低修復資訊：6.2.20。
- 專案證據：[backend/pom.xml:3-16](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/pom.xml#L3) Boot3.5.13 starter-web/security/jdbc，未新增JMS/WebFlux/WebSocket/RSocket/Jetty/Aalto等依賴；[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 已查完整設定；Servlet multipart、Jackson及DB設定，未配置reactive/SpEL/resource版本策略；[補充證據 FRAMEWORK_RESOLVED_DEPENDENCIES.json](BACKEND_SECURITY_TRIAGE.json) 2026-10-18報告完整展開53主條目+34related；Framework core/beans/expression/web/webmvc皆6.2.17；沒有上述可選模組；[補充證據 FRAMEWORK_CODE_SEARCH_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) views_sse_functional：35個main Java與1個application.yml的對應搜尋零匹配；另已查controllers與依賴，不只依賴單次搜尋；[backend/src/main/java/org/xkrotaract/api/ApiController.java:9-10,32-39,55-62,81-84](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/ApiController.java#L9) 註解@RestController、JsonNode request bodies與Map查詢；[backend/src/main/java/org/xkrotaract/api/Input.java:7-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/Input.java#L7) 以明確JsonNode欄位白名單和型別處理輸入
- 官方來源：[CVE-2026-47892 官方資料1](https://spring.io/security/cve-2026-47892/)
- 後續：保留條件式不適用證據；若新增相關功能、依賴或外部配置須重新核實。後續統一由Boot/BOM相容方案評估維護更新，不在本輪建立suppression或直接升級。

### CVE-2026-59313

**不適用**｜spring-core-6.2.17.jar｜掃描CRITICAL；供應者LOW

- 必要條件：MVC functional web framework以SSE串流攻擊者可控純文字，未用JSON等結構化格式
- 元件與版本：部分Framework相關module在classpath，但公告必要功能未使用；無RouterFunction、ServerResponse或SSE端點；產品系列版本6.2.17落在官方受影響範圍；不以此單獨判定專案可觸發。
- 判定理由：本案使用註解MVC與JSON API，未啟用公告所需functional SSE純文字流程
- 本CVE最低修復資訊：6.2.20。
- 專案證據：[backend/pom.xml:3-16](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/pom.xml#L3) Boot3.5.13 starter-web/security/jdbc，未新增JMS/WebFlux/WebSocket/RSocket/Jetty/Aalto等依賴；[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 已查完整設定；Servlet multipart、Jackson及DB設定，未配置reactive/SpEL/resource版本策略；[補充證據 FRAMEWORK_RESOLVED_DEPENDENCIES.json](BACKEND_SECURITY_TRIAGE.json) 2026-10-18報告完整展開53主條目+34related；Framework core/beans/expression/web/webmvc皆6.2.17；沒有上述可選模組；[補充證據 FRAMEWORK_CODE_SEARCH_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) views_sse_functional：35個main Java與1個application.yml的對應搜尋零匹配；另已查controllers與依賴，不只依賴單次搜尋；[backend/src/main/java/org/xkrotaract/api/ApiController.java:9-10,32-39,55-62,81-84](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/ApiController.java#L9) 註解@RestController、JsonNode request bodies與Map查詢；[backend/src/main/java/org/xkrotaract/api/Input.java:7-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/Input.java#L7) 以明確JsonNode欄位白名單和型別處理輸入
- 官方來源：[CVE-2026-59313 官方資料1](https://spring.io/security/cve-2026-59313/)
- 後續：保留條件式不適用證據；若新增相關功能、依賴或外部配置須重新核實。後續統一由Boot/BOM相容方案評估維護更新，不在本輪建立suppression或直接升級。

### CVE-2026-59283

**不適用**｜spring-core-6.2.17.jar｜掃描CRITICAL；供應者MEDIUM

- 必要條件：以SimpleEvaluationContext評估SpEL且compiler為IMMEDIATE或MIXED
- 元件與版本：部分Framework相關module在classpath，但公告必要功能未使用；無SimpleEvaluationContext、SpelExpressionParser或compiler配置；現有@Value為固定${...}設定；產品系列版本6.2.17落在官方受影響範圍；不以此單獨判定專案可觸發。
- 判定理由：spring-expression在classpath，但未使用所需SimpleEvaluationContext/編譯器路徑
- 本CVE最低修復資訊：6.2.20。
- 專案證據：[backend/pom.xml:3-16](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/pom.xml#L3) Boot3.5.13 starter-web/security/jdbc，未新增JMS/WebFlux/WebSocket/RSocket/Jetty/Aalto等依賴；[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 已查完整設定；Servlet multipart、Jackson及DB設定，未配置reactive/SpEL/resource版本策略；[補充證據 FRAMEWORK_RESOLVED_DEPENDENCIES.json](BACKEND_SECURITY_TRIAGE.json) 2026-10-18報告完整展開53主條目+34related；Framework core/beans/expression/web/webmvc皆6.2.17；沒有上述可選模組；[補充證據 FRAMEWORK_CODE_SEARCH_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) spel：35個main Java與1個application.yml的對應搜尋零匹配；另已查controllers與依賴，不只依賴單次搜尋；[backend/src/main/java/org/xkrotaract/api/ApiController.java:9-10,32-39,55-62,81-84](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/ApiController.java#L9) 註解@RestController、JsonNode request bodies與Map查詢；[backend/src/main/java/org/xkrotaract/api/Input.java:7-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/Input.java#L7) 以明確JsonNode欄位白名單和型別處理輸入；[backend/src/main/java/org/xkrotaract/api/SessionService.java:19](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SessionService.java#L19) @Value為固定${app.allowed-origin}設定，未解讀使用者輸入SpEL；[backend/src/main/java/org/xkrotaract/api/ReplayRetention.java:19-23](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/ReplayRetention.java#L19) 排程使用固定數值initialDelay/fixedDelay
- 官方來源：[CVE-2026-59283 官方資料1](https://spring.io/security/cve-2026-59283/)
- 後續：保留條件式不適用證據；若新增相關功能、依賴或外部配置須重新核實。後續統一由Boot/BOM相容方案評估維護更新，不在本輪建立suppression或直接升級。

### CVE-2026-41838

**不適用**｜spring-core-6.2.17.jar｜掃描HIGH；供應者MEDIUM

- 必要條件：使用spring-websocket sessions，且配合不足授權規則可利用可預測session IDs
- 元件與版本：部分Framework相關module在classpath，但公告必要功能未使用；spring-websocket未解析；無WebSocket API或配置；產品系列版本6.2.17落在官方受影響範圍；不以此單獨判定專案可觸發。
- 判定理由：WebSocket模組與會話流程不存在；不可將自有HTTP Session誤認為Spring WebSocket Session
- 本CVE最低修復資訊：6.2.19。
- 專案證據：[backend/pom.xml:3-16](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/pom.xml#L3) Boot3.5.13 starter-web/security/jdbc，未新增JMS/WebFlux/WebSocket/RSocket/Jetty/Aalto等依賴；[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 已查完整設定；Servlet multipart、Jackson及DB設定，未配置reactive/SpEL/resource版本策略；[補充證據 FRAMEWORK_RESOLVED_DEPENDENCIES.json](BACKEND_SECURITY_TRIAGE.json) 2026-10-18報告完整展開53主條目+34related；Framework core/beans/expression/web/webmvc皆6.2.17；沒有上述可選模組；[補充證據 FRAMEWORK_CODE_SEARCH_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) reactive_websocket_rsocket：35個main Java與1個application.yml的對應搜尋零匹配；另已查controllers與依賴，不只依賴單次搜尋
- 官方來源：[CVE-2026-41838 官方資料1](https://spring.io/security/cve-2026-41838/)
- 後續：保留條件式不適用證據；若新增相關功能、依賴或外部配置須重新核實。後續統一由Boot/BOM相容方案評估維護更新，不在本輪建立suppression或直接升級。

### CVE-2026-41842

**不適用**｜spring-core-6.2.17.jar｜掃描HIGH；供應者HIGH

- 必要條件：MVC/WebFlux + 檔案系統靜態資源 + 已設定versioned resources三條件同時成立
- 元件與版本：部分Framework相關module在classpath，但公告必要功能未使用；無resourceChain/VersionResourceResolver或版本策略配置；application.yml未設定外部靜態資源，OpenAPI由固定ClassPathResource讀取；產品系列版本6.2.17落在官方受影響範圍；不以此單獨判定專案可觸發。
- 判定理由：只有starter-web及預設靜態handler不足以構成此漏洞；已查程式/配置缺少versioned filesystem resources條件
- 本CVE最低修復資訊：6.2.19。
- 專案證據：[backend/pom.xml:3-16](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/pom.xml#L3) Boot3.5.13 starter-web/security/jdbc，未新增JMS/WebFlux/WebSocket/RSocket/Jetty/Aalto等依賴；[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 已查完整設定；Servlet multipart、Jackson及DB設定，未配置reactive/SpEL/resource版本策略；[補充證據 FRAMEWORK_RESOLVED_DEPENDENCIES.json](BACKEND_SECURITY_TRIAGE.json) 2026-10-18報告完整展開53主條目+34related；Framework core/beans/expression/web/webmvc皆6.2.17；沒有上述可選模組；[補充證據 FRAMEWORK_CODE_SEARCH_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) versioned_static：35個main Java與1個application.yml的對應搜尋零匹配；另已查controllers與依賴，不只依賴單次搜尋；[backend/src/main/java/org/xkrotaract/api/ApiCatalogController.java:8-16](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/ApiCatalogController.java#L8) OpenAPI固定ClassPathResource讀取，非filesystem version resource resolver
- 官方來源：[CVE-2026-41842 官方資料1](https://spring.io/security/cve-2026-41842/)
- 後續：保留條件式不適用證據；若新增相關功能、依賴或外部配置須重新核實。後續統一由Boot/BOM相容方案評估維護更新，不在本輪建立suppression或直接升級。

### CVE-2026-41848

**不適用**｜spring-core-6.2.17.jar｜掃描HIGH；供應者LOW

- 必要條件：攻擊者控制傳入AntPathMatcher.match/matchStart/extractUriTemplateVariables的pattern
- 元件與版本：部分Framework相關module在classpath，但公告必要功能未使用；程式無AntPathMatcher；端點路徑為固定mapping，SecurityConfig無動態requestMatcher；產品系列版本6.2.17落在官方受影響範圍；不以此單獨判定專案可觸發。
- 判定理由：spring-core與matcher類別存在，但沒有使用者控制pattern傳入matcher的流程
- 本CVE最低修復資訊：6.2.19。
- 專案證據：[backend/pom.xml:3-16](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/pom.xml#L3) Boot3.5.13 starter-web/security/jdbc，未新增JMS/WebFlux/WebSocket/RSocket/Jetty/Aalto等依賴；[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 已查完整設定；Servlet multipart、Jackson及DB設定，未配置reactive/SpEL/resource版本策略；[補充證據 FRAMEWORK_RESOLVED_DEPENDENCIES.json](BACKEND_SECURITY_TRIAGE.json) 2026-10-18報告完整展開53主條目+34related；Framework core/beans/expression/web/webmvc皆6.2.17；沒有上述可選模組；[補充證據 FRAMEWORK_CODE_SEARCH_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) ant：35個main Java與1個application.yml的對應搜尋零匹配；另已查controllers與依賴，不只依賴單次搜尋；[backend/src/main/java/org/xkrotaract/api/ApiController.java:9-10,32-39,55-62,81-84](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/ApiController.java#L9) 註解@RestController、JsonNode request bodies與Map查詢；[backend/src/main/java/org/xkrotaract/api/Input.java:7-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/Input.java#L7) 以明確JsonNode欄位白名單和型別處理輸入；[backend/src/main/java/org/xkrotaract/api/SecurityConfig.java:17-28](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SecurityConfig.java#L17) 固定HttpSecurity chain，無使用者定義path pattern
- 官方來源：[CVE-2026-41848 官方資料1](https://spring.io/security/cve-2026-41848/)
- 後續：保留條件式不適用證據；若新增相關功能、依賴或外部配置須重新核實。後續統一由Boot/BOM相容方案評估維護更新，不在本輪建立suppression或直接升級。

### CVE-2026-41850

**不適用**｜spring-core-6.2.17.jar｜掃描HIGH；供應者HIGH

- 必要條件：接受並評估不可信使用者控制的SpEL表達式
- 元件與版本：部分Framework相關module在classpath，但公告必要功能未使用；未使用SpelExpressionParser或評估使用者SpEL；@Value只有固定property placeholders；產品系列版本6.2.17落在官方受影響範圍；不以此單獨判定專案可觸發。
- 判定理由：SpEL依賴存在不等於接受攻擊者控制的表達式；使用者輸入以JsonNode與明確欄位處理
- 本CVE最低修復資訊：6.2.19。
- 專案證據：[backend/pom.xml:3-16](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/pom.xml#L3) Boot3.5.13 starter-web/security/jdbc，未新增JMS/WebFlux/WebSocket/RSocket/Jetty/Aalto等依賴；[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 已查完整設定；Servlet multipart、Jackson及DB設定，未配置reactive/SpEL/resource版本策略；[補充證據 FRAMEWORK_RESOLVED_DEPENDENCIES.json](BACKEND_SECURITY_TRIAGE.json) 2026-10-18報告完整展開53主條目+34related；Framework core/beans/expression/web/webmvc皆6.2.17；沒有上述可選模組；[補充證據 FRAMEWORK_CODE_SEARCH_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) spel：35個main Java與1個application.yml的對應搜尋零匹配；另已查controllers與依賴，不只依賴單次搜尋；[backend/src/main/java/org/xkrotaract/api/ApiController.java:9-10,32-39,55-62,81-84](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/ApiController.java#L9) 註解@RestController、JsonNode request bodies與Map查詢；[backend/src/main/java/org/xkrotaract/api/Input.java:7-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/Input.java#L7) 以明確JsonNode欄位白名單和型別處理輸入；[backend/src/main/java/org/xkrotaract/api/SessionService.java:19](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SessionService.java#L19) @Value為固定${app.allowed-origin}設定，未解讀使用者輸入SpEL；[backend/src/main/java/org/xkrotaract/api/ReplayRetention.java:19-23](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/ReplayRetention.java#L19) 排程使用固定數值initialDelay/fixedDelay
- 官方來源：[CVE-2026-41850 官方資料1](https://spring.io/security/cve-2026-41850/)
- 後續：保留條件式不適用證據；若新增相關功能、依賴或外部配置須重新核實。後續統一由Boot/BOM相容方案評估維護更新，不在本輪建立suppression或直接升級。

### CVE-2026-41851

**不適用**｜spring-core-6.2.17.jar｜掃描HIGH；供應者MEDIUM

- 必要條件：接受/評估不可信SpEL並快取解析後的表達式
- 元件與版本：部分Framework相關module在classpath，但公告必要功能未使用；無SpEL輸入、parser或expression cache流程；產品系列版本6.2.17落在官方受影響範圍；不以此單獨判定專案可觸發。
- 判定理由：缺少不可信SpEL評估及解析表達式快取兩個前提
- 本CVE最低修復資訊：6.2.19。
- 專案證據：[backend/pom.xml:3-16](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/pom.xml#L3) Boot3.5.13 starter-web/security/jdbc，未新增JMS/WebFlux/WebSocket/RSocket/Jetty/Aalto等依賴；[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 已查完整設定；Servlet multipart、Jackson及DB設定，未配置reactive/SpEL/resource版本策略；[補充證據 FRAMEWORK_RESOLVED_DEPENDENCIES.json](BACKEND_SECURITY_TRIAGE.json) 2026-10-18報告完整展開53主條目+34related；Framework core/beans/expression/web/webmvc皆6.2.17；沒有上述可選模組；[補充證據 FRAMEWORK_CODE_SEARCH_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) spel：35個main Java與1個application.yml的對應搜尋零匹配；另已查controllers與依賴，不只依賴單次搜尋；[backend/src/main/java/org/xkrotaract/api/ApiController.java:9-10,32-39,55-62,81-84](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/ApiController.java#L9) 註解@RestController、JsonNode request bodies與Map查詢；[backend/src/main/java/org/xkrotaract/api/Input.java:7-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/Input.java#L7) 以明確JsonNode欄位白名單和型別處理輸入；[backend/src/main/java/org/xkrotaract/api/SessionService.java:19](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SessionService.java#L19) @Value為固定${app.allowed-origin}設定，未解讀使用者輸入SpEL；[backend/src/main/java/org/xkrotaract/api/ReplayRetention.java:19-23](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/ReplayRetention.java#L19) 排程使用固定數值initialDelay/fixedDelay
- 官方來源：[CVE-2026-41851 官方資料1](https://spring.io/security/cve-2026-41851/)
- 後續：保留條件式不適用證據；若新增相關功能、依賴或外部配置須重新核實。後續統一由Boot/BOM相容方案評估維護更新，不在本輪建立suppression或直接升級。

### CVE-2026-47885

**不適用**｜spring-core-6.2.17.jar｜掃描HIGH；供應者MEDIUM

- 必要條件：WebFlux以@RequestBody Flux<PartEvent>讀取multipart且maxInMemorySize=-1
- 元件與版本：部分Framework相關module在classpath，但公告必要功能未使用；無WebFlux/Flux/PartEvent；上傳為Servlet MultipartFile，2MB file/3MB request設定；產品系列版本6.2.17落在官方受影響範圍；不以此單獨判定專案可觸發。
- 判定理由：一般Servlet MultipartFile不走公告指定的reactive PartEvent reader
- 本CVE最低修復資訊：6.2.20。
- 專案證據：[backend/pom.xml:3-16](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/pom.xml#L3) Boot3.5.13 starter-web/security/jdbc，未新增JMS/WebFlux/WebSocket/RSocket/Jetty/Aalto等依賴；[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 已查完整設定；Servlet multipart、Jackson及DB設定，未配置reactive/SpEL/resource版本策略；[補充證據 FRAMEWORK_RESOLVED_DEPENDENCIES.json](BACKEND_SECURITY_TRIAGE.json) 2026-10-18報告完整展開53主條目+34related；Framework core/beans/expression/web/webmvc皆6.2.17；沒有上述可選模組；[補充證據 FRAMEWORK_CODE_SEARCH_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) reactive_websocket_rsocket：35個main Java與1個application.yml的對應搜尋零匹配；另已查controllers與依賴，不只依賴單次搜尋；[backend/src/main/java/org/xkrotaract/api/SupportController.java:110-126](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SupportController.java#L110) @RequestParam MultipartFile與明確欄位檢查，不是Flux<PartEvent>
- 官方來源：[CVE-2026-47885 官方資料1](https://spring.io/security/cve-2026-47885/)
- 後續：保留條件式不適用證據；若新增相關功能、依賴或外部配置須重新核實。後續統一由Boot/BOM相容方案評估維護更新，不在本輪建立suppression或直接升級。

### CVE-2026-47886

**不適用**｜spring-core-6.2.17.jar｜掃描HIGH；供應者MEDIUM

- 必要條件：不可信SpEL可用^運算且context可到達BigDecimal/BigInteger
- 元件與版本：部分Framework相關module在classpath，但公告必要功能未使用；沒有使用者SpEL評估或可控evaluation context；產品系列版本6.2.17落在官方受影響範圍；不以此單獨判定專案可觸發。
- 判定理由：缺少不可信表達式入口；一般以Java做金額/數值運算不是SpEL power operator
- 本CVE最低修復資訊：6.2.20。
- 專案證據：[backend/pom.xml:3-16](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/pom.xml#L3) Boot3.5.13 starter-web/security/jdbc，未新增JMS/WebFlux/WebSocket/RSocket/Jetty/Aalto等依賴；[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 已查完整設定；Servlet multipart、Jackson及DB設定，未配置reactive/SpEL/resource版本策略；[補充證據 FRAMEWORK_RESOLVED_DEPENDENCIES.json](BACKEND_SECURITY_TRIAGE.json) 2026-10-18報告完整展開53主條目+34related；Framework core/beans/expression/web/webmvc皆6.2.17；沒有上述可選模組；[補充證據 FRAMEWORK_CODE_SEARCH_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) spel：35個main Java與1個application.yml的對應搜尋零匹配；另已查controllers與依賴，不只依賴單次搜尋；[backend/src/main/java/org/xkrotaract/api/ApiController.java:9-10,32-39,55-62,81-84](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/ApiController.java#L9) 註解@RestController、JsonNode request bodies與Map查詢；[backend/src/main/java/org/xkrotaract/api/Input.java:7-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/Input.java#L7) 以明確JsonNode欄位白名單和型別處理輸入；[backend/src/main/java/org/xkrotaract/api/SessionService.java:19](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SessionService.java#L19) @Value為固定${app.allowed-origin}設定，未解讀使用者輸入SpEL；[backend/src/main/java/org/xkrotaract/api/ReplayRetention.java:19-23](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/ReplayRetention.java#L19) 排程使用固定數值initialDelay/fixedDelay
- 官方來源：[CVE-2026-47886 官方資料1](https://spring.io/security/cve-2026-47886/)
- 後續：保留條件式不適用證據；若新增相關功能、依賴或外部配置須重新核實。後續統一由Boot/BOM相容方案評估維護更新，不在本輪建立suppression或直接升級。

### CVE-2026-47888

**不適用**｜spring-core-6.2.17.jar｜掃描HIGH；供應者MEDIUM

- 必要條件：啟用RSocket接受惡意SETUP frame
- 元件與版本：部分Framework相關module在classpath，但公告必要功能未使用；spring-messaging/rsocket無解析條目，無RSocket端點；產品系列版本6.2.17落在官方受影響範圍；不以此單獨判定專案可觸發。
- 判定理由：本案為Servlet HTTP REST，未包含/啟用RSocket服務
- 本CVE最低修復資訊：6.2.20。
- 專案證據：[backend/pom.xml:3-16](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/pom.xml#L3) Boot3.5.13 starter-web/security/jdbc，未新增JMS/WebFlux/WebSocket/RSocket/Jetty/Aalto等依賴；[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 已查完整設定；Servlet multipart、Jackson及DB設定，未配置reactive/SpEL/resource版本策略；[補充證據 FRAMEWORK_RESOLVED_DEPENDENCIES.json](BACKEND_SECURITY_TRIAGE.json) 2026-10-18報告完整展開53主條目+34related；Framework core/beans/expression/web/webmvc皆6.2.17；沒有上述可選模組；[補充證據 FRAMEWORK_CODE_SEARCH_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) reactive_websocket_rsocket：35個main Java與1個application.yml的對應搜尋零匹配；另已查controllers與依賴，不只依賴單次搜尋
- 官方來源：[CVE-2026-47888 官方資料1](https://spring.io/security/cve-2026-47888/)
- 後續：保留條件式不適用證據；若新增相關功能、依賴或外部配置須重新核實。後續統一由Boot/BOM相容方案評估維護更新，不在本輪建立suppression或直接升級。

### CVE-2026-47889

**不適用**｜spring-core-6.2.17.jar｜掃描HIGH；供應者MEDIUM

- 必要條件：WebFlux跑在Jetty12 Core reactive adapter並設定SameSite response cookie
- 元件與版本：部分Framework相關module在classpath，但公告必要功能未使用；解析為Tomcat embedded，無Jetty/WebFlux；Cookie以Servlet response處理；產品系列版本6.2.17落在官方受影響範圍；不以此單獨判定專案可觸發。
- 判定理由：受影響reactive Jetty組合不存在，不能因程式使用Cookie而判適用
- 本CVE最低修復資訊：6.2.20。
- 專案證據：[backend/pom.xml:3-16](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/pom.xml#L3) Boot3.5.13 starter-web/security/jdbc，未新增JMS/WebFlux/WebSocket/RSocket/Jetty/Aalto等依賴；[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 已查完整設定；Servlet multipart、Jackson及DB設定，未配置reactive/SpEL/resource版本策略；[補充證據 FRAMEWORK_RESOLVED_DEPENDENCIES.json](BACKEND_SECURITY_TRIAGE.json) 2026-10-18報告完整展開53主條目+34related；Framework core/beans/expression/web/webmvc皆6.2.17；沒有上述可選模組；[補充證據 FRAMEWORK_CODE_SEARCH_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) reactive_websocket_rsocket：35個main Java與1個application.yml的對應搜尋零匹配；另已查controllers與依賴，不只依賴單次搜尋
- 官方來源：[CVE-2026-47889 官方資料1](https://spring.io/security/cve-2026-47889/)
- 後續：保留條件式不適用證據；若新增相關功能、依賴或外部配置須重新核實。後續統一由Boot/BOM相容方案評估維護更新，不在本輪建立suppression或直接升級。

### CVE-2026-47893

**不適用**｜spring-core-6.2.17.jar｜掃描HIGH；供應者LOW

- 必要條件：WebFlux支援WebSocket連線，握手例外reason包含request headers
- 元件與版本：部分Framework相關module在classpath，但公告必要功能未使用；無spring-webflux/WebSocket dependency或握手服務；產品系列版本6.2.17落在官方受影響範圍；不以此單獨判定專案可觸發。
- 判定理由：缺少WebFlux WebSocket握手流程
- 本CVE最低修復資訊：6.2.20。
- 專案證據：[backend/pom.xml:3-16](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/pom.xml#L3) Boot3.5.13 starter-web/security/jdbc，未新增JMS/WebFlux/WebSocket/RSocket/Jetty/Aalto等依賴；[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 已查完整設定；Servlet multipart、Jackson及DB設定，未配置reactive/SpEL/resource版本策略；[補充證據 FRAMEWORK_RESOLVED_DEPENDENCIES.json](BACKEND_SECURITY_TRIAGE.json) 2026-10-18報告完整展開53主條目+34related；Framework core/beans/expression/web/webmvc皆6.2.17；沒有上述可選模組；[補充證據 FRAMEWORK_CODE_SEARCH_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) reactive_websocket_rsocket：35個main Java與1個application.yml的對應搜尋零匹配；另已查controllers與依賴，不只依賴單次搜尋
- 官方來源：[CVE-2026-47893 官方資料1](https://spring.io/security/cve-2026-47893/)
- 後續：保留條件式不適用證據；若新增相關功能、依賴或外部配置須重新核實。後續統一由Boot/BOM相容方案評估維護更新，不在本輪建立suppression或直接升級。

### CVE-2026-59282

**不適用**｜spring-core-6.2.17.jar｜掃描HIGH；供應者MEDIUM

- 必要條件：把不可信property paths綁定到含自動擴張List且元素有子屬性的target object
- 元件與版本：部分Framework相關module在classpath，但公告必要功能未使用；API以JsonNode白名單/Map參數處理；無@ModelAttribute/DataBinder/AutoPopulatingList/LazyList；非把輸入鍵當bean property path；產品系列版本6.2.17落在官方受影響範圍；不以此單獨判定專案可觸發。
- 判定理由：spring-beans元件存在，但公告要求的可控property binding加自動擴張複雜List不存在
- 本CVE最低修復資訊：6.2.20。
- 專案證據：[backend/pom.xml:3-16](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/pom.xml#L3) Boot3.5.13 starter-web/security/jdbc，未新增JMS/WebFlux/WebSocket/RSocket/Jetty/Aalto等依賴；[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 已查完整設定；Servlet multipart、Jackson及DB設定，未配置reactive/SpEL/resource版本策略；[補充證據 FRAMEWORK_RESOLVED_DEPENDENCIES.json](BACKEND_SECURITY_TRIAGE.json) 2026-10-18報告完整展開53主條目+34related；Framework core/beans/expression/web/webmvc皆6.2.17；沒有上述可選模組；[補充證據 FRAMEWORK_CODE_SEARCH_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) bean_data_binding：35個main Java與1個application.yml的對應搜尋零匹配；另已查controllers與依賴，不只依賴單次搜尋；[backend/src/main/java/org/xkrotaract/api/ApiController.java:9-10,32-39,55-62,81-84](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/ApiController.java#L9) 註解@RestController、JsonNode request bodies與Map查詢；[backend/src/main/java/org/xkrotaract/api/Input.java:7-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/Input.java#L7) 以明確JsonNode欄位白名單和型別處理輸入
- 官方來源：[CVE-2026-59282 官方資料1](https://spring.io/security/cve-2026-59282/)
- 後續：保留條件式不適用證據；若新增相關功能、依賴或外部配置須重新核實。後續統一由Boot/BOM相容方案評估維護更新，不在本輪建立suppression或直接升級。

### CVE-2026-59270

**不適用**｜spring-security-core-6.5.9.jar｜掃描CRITICAL；供應者CRITICAL

- 必要條件：啟用UnboundIdContainer（直接或spring.ldap.embedded.*）且LDAP埠可被攻擊者接觸。
- 元件與版本：受影響UnboundIdContainer屬spring-security-ldap；LDAP模組及UnboundID不在掃描classpath。；是；6.5.9落於本公告列出的6.5受影響範圍。
- 判定理由：本案沒有LDAP依賴/自動設定/監聽器，使用自訂PostgreSQL Session與密碼驗證；不是Security core存在就會開啟LDAP。
- 本CVE最低修復資訊：6.5.12。
- 專案證據：[backend/pom.xml:3-16](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/pom.xml#L3) 父版本3.5.13；web/security/jdbc等依賴明列，沒有本列特定可選功能starter。；[補充證據 BOOT_SECURITY_CLASSPATH_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) 原10/18 Dependency-Check報告主條目53+related34共87條目，保留Maven purl名單與缺少模組檢查；不代表本輪重新resolve。；[backend/src/main/java/org/xkrotaract/api/SecurityConfig.java:17-79](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SecurityConfig.java#L17) 唯一SecurityFilterChain採自訂DB SessionService、STATELESS，不配置X509、SAML、OAuth2/DPoP或WebAuthn。；[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 無spring.ldap.embedded.*設定。
- 官方來源：[CVE-2026-59270 官方資料1](https://spring.io/security/cve-2026-59270/)；[CVE-2026-59270 官方資料2](https://docs.spring.io/spring-security/reference/6.5/api/java/org/springframework/security/ldap/server/UnboundIdContainer.html)
- 後續：保留此版本與配置的逐項證據，不新增suppression；若導入相關功能或變更環境設定須重核。後續評估Boot/BOM修補時同時確認Java21相容、整體修復覆蓋及必要回歸，本輪不升級。

### CVE-2026-47838

**不適用**｜spring-security-core-6.5.9.jar｜掃描HIGH；供應者MEDIUM

- 必要條件：啟用X.509 pre-authentication且使用SubjectDnX509PrincipalExtractor解析CN；公告另說明依賴上游信任受損的情境。
- 元件與版本：SubjectDnX509PrincipalExtractor在spring-security-web相關路徑；該模組存在但X.509預認證流程未配置。；是；6.5.9落於本公告列出的6.5受影響範圍。
- 判定理由：SecurityFilterChain未啟用x509，當前server不配置client-auth，認證由自有SessionService完成。受影響版本存在但無該PrincipalExtractor認證路徑。
- 本CVE最低修復資訊：6.5.11。
- 專案證據：[backend/src/main/java/org/xkrotaract/api/SecurityConfig.java:17-79](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SecurityConfig.java#L17) 唯一SecurityFilterChain採自訂DB SessionService、STATELESS，不配置X509、SAML、OAuth2/DPoP或WebAuthn。；[backend/src/main/resources/application.yml:13-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L13) 無server.ssl.client-auth或X509相關設定。；[backend/src/main/java/org/xkrotaract/api/SessionService.java:43-78](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SessionService.java#L43) 以__Host-session cookie雜湊查詢DB建立身份。
- 官方來源：[CVE-2026-47838 官方資料1](https://spring.io/security/cve-2026-47838/)
- 後續：保留此版本與配置的逐項證據，不新增suppression；若導入相關功能或變更環境設定須重核。後續評估Boot/BOM修補時同時確認Java21相容、整體修復覆蓋及必要回歸，本輪不升級。

### CVE-2026-40988

**不適用**｜spring-security-core-6.5.9.jar｜掃描HIGH；供應者HIGH

- 必要條件：使用SAML2 Login/Logout REDIRECT binding，解析壓縮SAML載荷。
- 元件與版本：spring-security-saml2-service-provider不在POM或掃描classpath。；是；6.5.9落於本公告列出的6.5受影響範圍。
- 判定理由：未引入SAML2 provider也沒有SAML filter/REDIRECT入口；Security core CPE命中不能代替SAML module存在證據。
- 本CVE最低修復資訊：6.5.11。
- 專案證據：[backend/pom.xml:3-16](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/pom.xml#L3) 父版本3.5.13；web/security/jdbc等依賴明列，沒有本列特定可選功能starter。；[補充證據 BOOT_SECURITY_CLASSPATH_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) 原10/18 Dependency-Check報告主條目53+related34共87條目，保留Maven purl名單與缺少模組檢查；不代表本輪重新resolve。；[backend/src/main/java/org/xkrotaract/api/SecurityConfig.java:17-79](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SecurityConfig.java#L17) 唯一SecurityFilterChain採自訂DB SessionService、STATELESS，不配置X509、SAML、OAuth2/DPoP或WebAuthn。
- 官方來源：[CVE-2026-40988 官方資料1](https://spring.io/security/cve-2026-40988/)
- 後續：保留此版本與配置的逐項證據，不新增suppression；若導入相關功能或變更環境設定須重核。後續評估Boot/BOM修補時同時確認Java21相容、整體修復覆蓋及必要回歸，本輪不升級。

### CVE-2026-41707

**不適用**｜spring-security-core-6.5.9.jar｜掃描HIGH；供應者HIGH

- 必要條件：使用OAuth2 DPoP proof驗證；攻擊者取得有效proof並可大量請求逐出jti cache後重放。
- 元件與版本：DPoPProofJwtDecoderFactory位於spring-security-oauth2-jose；該模組不在掃描classpath。；是；6.5.9落於本公告列出的6.5受影響範圍。
- 判定理由：本案沒有OAuth2 JOSE/JWT/DPoP依賴與filter，身份使用自有cookie與PostgreSQL Session；不存在公告的DPoP驗證cache路徑。
- 本CVE最低修復資訊：6.5.12。
- 專案證據：[backend/pom.xml:3-16](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/pom.xml#L3) 父版本3.5.13；web/security/jdbc等依賴明列，沒有本列特定可選功能starter。；[補充證據 BOOT_SECURITY_CLASSPATH_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) 原10/18 Dependency-Check報告主條目53+related34共87條目，保留Maven purl名單與缺少模組檢查；不代表本輪重新resolve。；[backend/src/main/java/org/xkrotaract/api/SecurityConfig.java:17-79](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SecurityConfig.java#L17) 唯一SecurityFilterChain採自訂DB SessionService、STATELESS，不配置X509、SAML、OAuth2/DPoP或WebAuthn。；[backend/src/main/java/org/xkrotaract/api/SessionService.java:43-78](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SessionService.java#L43) 身份由DB Session取得，不驗證DPoP/JWT。
- 官方來源：[CVE-2026-41707 官方資料1](https://spring.io/security/cve-2026-41707/)；[CVE-2026-41707 官方資料2](https://github.com/spring-projects/spring-security/blob/6.5.9/oauth2/oauth2-jose/src/main/java/org/springframework/security/oauth2/jwt/DPoPProofJwtDecoderFactory.java)
- 後續：保留此版本與配置的逐項證據，不新增suppression；若導入相關功能或變更環境設定須重核。後續評估Boot/BOM修補時同時確認Java21相容、整體修復覆蓋及必要回歸，本輪不升級。

### CVE-2026-47841

**不適用**｜spring-security-core-6.5.9.jar｜掃描HIGH；供應者HIGH

- 必要條件：同時使用WebAuthn、明確設userVerification=REQUIRED，及分散式HttpSession序列化儲存；預設PREFERRED不受此項影響。
- 元件與版本：Security web/config共同存在不等於已採用WebAuthn；當前無passkey流程或Spring Session模組。；是；6.5.9落於本公告列出的6.5受影響範圍。
- 判定理由：本案MFA是TOTP而非WebAuthn；SecurityFilterChain不配置WebAuthn且STATELESS，自有api_sessions資料表不是Spring Session序列化HttpSession。三個必要條件未成立。
- 本CVE最低修復資訊：6.5.12。
- 專案證據：[backend/src/main/java/org/xkrotaract/api/SecurityConfig.java:17-79](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SecurityConfig.java#L17) 唯一SecurityFilterChain採自訂DB SessionService、STATELESS，不配置X509、SAML、OAuth2/DPoP或WebAuthn。；[補充證據 BOOT_SECURITY_CLASSPATH_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) 原10/18 Dependency-Check報告主條目53+related34共87條目，保留Maven purl名單與缺少模組檢查；不代表本輪重新resolve。；[backend/src/main/java/org/xkrotaract/api/SessionService.java:41-78,87-98](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SessionService.java#L41) 自有Session record包含雜湊、UUID、帳號、csrf，以SQL查詢/新增，非HttpSession物件序列化。；[backend/src/main/java/org/xkrotaract/api/MfaController.java:28-46](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/MfaController.java#L28) 現行MFA為TOTP secret/驗證流程。
- 官方來源：[CVE-2026-47841 官方資料1](https://spring.io/security/cve-2026-47841/)
- 後續：保留此版本與配置的逐項證據，不新增suppression；若導入相關功能或變更環境設定須重核。後續評估Boot/BOM修補時同時確認Java21相容、整體修復覆蓋及必要回歸，本輪不升級。

### CVE-2026-41293

**不適用**｜tomcat-embed-core-10.1.53.jar｜掃描CRITICAL；供應者Low

- 必要條件：HTTP/2 Connector已啟用，接收HTTP/2請求。
- 元件與版本：是；是。
- 判定理由：10.1.53在受影響範圍，但提交設定未啟用HTTP/2；Boot3.5.13 Http2.enabled預設false，未見額外Http2Protocol。現行預設沒有此觸發路徑。
- 本CVE最低修復資訊：10.1.55。
- 專案證據：[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 唯一已提交application設定；Tomcat TCP address/port，未啟用HTTP2、SSL、FFM、UDS或cluster。；[backend/src/main/java/org/xkrotaract/api/Application.java:8-15](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/Application.java#L8) 以SpringApplication啟動embedded容器；非另行維護server.xml的外部WAR部署。；[補充證據 TOMCAT_A_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) main全52檔未發現web.xml/server.xml/context.xml或Tomcat customizer/Realm/security-constraint/RewriteValve/EncryptInterceptor/Http2Protocol/UDS/FFM設定。
- 官方來源：[CVE-2026-41293 官方資料1](https://tomcat.apache.org/security-10.html)；[CVE-2026-41293 官方資料2](https://raw.githubusercontent.com/spring-projects/spring-boot/v3.5.13/spring-boot-project/spring-boot/src/main/java/org/springframework/boot/web/server/Http2.java)；[CVE-2026-41293 官方資料3](https://tomcat.apache.org/tomcat-10.1-doc/config/http.html)
- 後續：保留告警與逐項證據，不新增suppression。本案若啟用相關功能或部署配置改變須重新核實；後續評估相容的Spring Boot BOM維護升級並跑既有回歸。

### CVE-2026-43512

**不適用**｜tomcat-embed-core-10.1.53.jar｜掃描CRITICAL；供應者Moderate

- 必要條件：Tomcat container DIGEST authentication與Realm已設定。
- 元件與版本：是；是。
- 判定理由：受影響DigestAuthenticator類別存在，但專案採自訂Session登入，無Tomcat DIGEST/Realm配置；Spring formLogin禁用並不是排除此Tomcat漏洞的唯一依據，還已查無container登入設定。
- 本CVE最低修復資訊：10.1.55。
- 專案證據：[backend/src/main/java/org/xkrotaract/api/SecurityConfig.java:14-45](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SecurityConfig.java#L14) 使用自訂Session/CSRF filter；Spring formLogin/httpBasic禁用；未建立Tomcat Realm或container security constraints。；[補充證據 TOMCAT_A_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) main全52檔未發現web.xml/server.xml/context.xml或Tomcat customizer/Realm/security-constraint/RewriteValve/EncryptInterceptor/Http2Protocol/UDS/FFM設定。；[backend/src/main/java/org/xkrotaract/api/Application.java:8-15](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/Application.java#L8) 以SpringApplication啟動embedded容器；非另行維護server.xml的外部WAR部署。
- 官方來源：[CVE-2026-43512 官方資料1](https://tomcat.apache.org/security-10.html)；[CVE-2026-43512 官方資料2](https://github.com/apache/tomcat/commit/3d4d3fae07a6cd9c2eb193c5491001740ec64448)
- 後續：保留告警與逐項證據，不新增suppression。本案若啟用相關功能或部署配置改變須重新核實；後續評估相容的Spring Boot BOM維護升級並跑既有回歸。

### CVE-2026-65637

**不適用**｜tomcat-embed-core-10.1.53.jar｜掃描CRITICAL；供應者Moderate

- 必要條件：HTTP/2與TLS/SNI host驗證，尤其依Connector檢查的client certificate條件。
- 元件與版本：是；是。
- 判定理由：版本匹配，但現行提交既無HTTP/2、Tomcat TLS/SNI配置，也無CLIENT-CERT認證。前端HTTPS代理不代表Tomcat本身啟用HTTP/2/TLS。
- 本CVE最低修復資訊：10.1.59。
- 專案證據：[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 唯一已提交application設定；Tomcat TCP address/port，未啟用HTTP2、SSL、FFM、UDS或cluster。；[backend/src/main/java/org/xkrotaract/api/Application.java:8-15](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/Application.java#L8) 以SpringApplication啟動embedded容器；非另行維護server.xml的外部WAR部署。；[backend/README.md:120](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/README.md#L120) 正式API尚未部署；未提供正式環境Tomcat connector有效設定，本判定不代替未來部署驗證。；[補充證據 TOMCAT_A_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) main全52檔未發現web.xml/server.xml/context.xml或Tomcat customizer/Realm/security-constraint/RewriteValve/EncryptInterceptor/Http2Protocol/UDS/FFM設定。
- 官方來源：[CVE-2026-65637 官方資料1](https://tomcat.apache.org/security-10.html)；[CVE-2026-65637 官方資料2](https://github.com/apache/tomcat/commit/40012414df828a56126f76a7339669c7c919aae7)；[CVE-2026-65637 官方資料3](https://raw.githubusercontent.com/spring-projects/spring-boot/v3.5.13/spring-boot-project/spring-boot/src/main/java/org/springframework/boot/web/server/Http2.java)
- 後續：保留告警與逐項證據，不新增suppression。本案若啟用相關功能或部署配置改變須重新核實；後續評估相容的Spring Boot BOM維護升級並跑既有回歸。

### CVE-2026-65905

**不適用**｜tomcat-embed-core-10.1.53.jar｜掃描CRITICAL；供應者Low

- 必要條件：Tomcat DIGEST authenticator被使用，存在其nonceCount replay window。
- 元件與版本：是；是。
- 判定理由：專案沒有DIGEST/Realm設定，實際登入為自訂伺服器Session；不存在公告所需nonceCount驗證流程。
- 本CVE最低修復資訊：10.1.59。
- 專案證據：[backend/src/main/java/org/xkrotaract/api/SecurityConfig.java:14-45](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SecurityConfig.java#L14) 使用自訂Session/CSRF filter；Spring formLogin/httpBasic禁用；未建立Tomcat Realm或container security constraints。；[補充證據 TOMCAT_A_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) main全52檔未發現web.xml/server.xml/context.xml或Tomcat customizer/Realm/security-constraint/RewriteValve/EncryptInterceptor/Http2Protocol/UDS/FFM設定。；[backend/src/main/java/org/xkrotaract/api/Application.java:8-15](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/Application.java#L8) 以SpringApplication啟動embedded容器；非另行維護server.xml的外部WAR部署。
- 官方來源：[CVE-2026-65905 官方資料1](https://tomcat.apache.org/security-10.html)
- 後續：保留告警與逐項證據，不新增suppression。本案若啟用相關功能或部署配置改變須重新核實；後續評估相容的Spring Boot BOM維護升級並跑既有回歸。

### CVE-2026-43515

**不適用**｜tomcat-embed-core-10.1.53.jar｜掃描CRITICAL；供應者Moderate

- 必要條件：同extension pattern多個container security constraints有HTTP method限制。
- 元件與版本：是；是。
- 判定理由：未提交web.xml、@ServletSecurity或程式化Tomcat security constraints；應用授權由自訂Service/filter處理，不滿足重疊extension constraint前提。
- 本CVE最低修復資訊：10.1.55。
- 專案證據：[backend/src/main/java/org/xkrotaract/api/SecurityConfig.java:14-45](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SecurityConfig.java#L14) 使用自訂Session/CSRF filter；Spring formLogin/httpBasic禁用；未建立Tomcat Realm或container security constraints。；[補充證據 TOMCAT_A_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) main全52檔未發現web.xml/server.xml/context.xml或Tomcat customizer/Realm/security-constraint/RewriteValve/EncryptInterceptor/Http2Protocol/UDS/FFM設定。；[backend/src/main/java/org/xkrotaract/api/Application.java:8-15](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/Application.java#L8) 以SpringApplication啟動embedded容器；非另行維護server.xml的外部WAR部署。
- 官方來源：[CVE-2026-43515 官方資料1](https://tomcat.apache.org/security-10.html)
- 後續：保留告警與逐項證據，不新增suppression。本案若啟用相關功能或部署配置改變須重新核實；後續評估相容的Spring Boot BOM維護升級並跑既有回歸。

### CVE-2026-53434

**不適用**｜tomcat-embed-core-10.1.53.jar｜掃描CRITICAL；供應者Low

- 必要條件：額外FFM OpenSSL connector與CRL/certificate驗證設定。
- 元件與版本：否；是。
- 判定理由：FFM為可選tomcat-coyote-ffm模組，掃描classpath無此模組、core jar無panama類別；本案Java21且未啟用Tomcat TLS/CRL connector。
- 本CVE最低修復資訊：10.1.56。
- 專案證據：[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 唯一已提交application設定；Tomcat TCP address/port，未啟用HTTP2、SSL、FFM、UDS或cluster。；[backend/pom.xml:3-7](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/pom.xml#L3) Spring Boot3.5.13/starter-web，Java21；CI同樣Java21。；[原掃描座標及報告雜湊](BACKEND_SECURITY_TRIAGE.json) 完整53主+34related Maven依賴中有tomcat-embed-core/el/websocket，沒有tomcat-tribes、tomcat-catalina-ha或tomcat-coyote-ffm。；[補充證據 TOMCAT_A_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) main全52檔未發現web.xml/server.xml/context.xml或Tomcat customizer/Realm/security-constraint/RewriteValve/EncryptInterceptor/Http2Protocol/UDS/FFM設定。
- 官方來源：[CVE-2026-53434 官方資料1](https://tomcat.apache.org/security-10.html)；[CVE-2026-53434 官方資料2](https://github.com/apache/tomcat/commit/feec60d6099727db6f911534f6a0f6926ebab070)；[CVE-2026-53434 官方資料3](https://tomcat.apache.org/oldnews-2024.html)
- 後續：保留告警與逐項證據，不新增suppression。本案若啟用相關功能或部署配置改變須重新核實；後續評估相容的Spring Boot BOM維護升級並跑既有回歸。

### CVE-2026-55276

**不適用**｜tomcat-embed-core-10.1.53.jar｜掃描CRITICAL；供應者Low

- 必要條件：依賴logged effective web.xml檢查special roles或空authorization constraints。
- 元件與版本：是；是。
- 判定理由：本案無container declarative security constraints或effective-web.xml稽核流程；不是應用Service授權被繞過的證據。
- 本CVE最低修復資訊：10.1.56。
- 專案證據：[backend/src/main/java/org/xkrotaract/api/SecurityConfig.java:14-45](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SecurityConfig.java#L14) 使用自訂Session/CSRF filter；Spring formLogin/httpBasic禁用；未建立Tomcat Realm或container security constraints。；[補充證據 TOMCAT_A_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) main全52檔未發現web.xml/server.xml/context.xml或Tomcat customizer/Realm/security-constraint/RewriteValve/EncryptInterceptor/Http2Protocol/UDS/FFM設定。；[backend/src/main/java/org/xkrotaract/api/Application.java:8-15](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/Application.java#L8) 以SpringApplication啟動embedded容器；非另行維護server.xml的外部WAR部署。
- 官方來源：[CVE-2026-55276 官方資料1](https://tomcat.apache.org/security-10.html)
- 後續：保留告警與逐項證據，不新增suppression。本案若啟用相關功能或部署配置改變須重新核實；後續評估相容的Spring Boot BOM維護升級並跑既有回歸。

### CVE-2026-59083

**不適用**｜tomcat-embed-core-10.1.53.jar｜掃描CRITICAL；供應者Low

- 必要條件：已啟用RewriteValve，且rewrite規則以URL內容提供安全控制。
- 元件與版本：是；是。
- 判定理由：RewriteValve類別在core jar中，但main無Valve/customizer或rewrite.config，未使用Tomcat rewrite存取控制。
- 本CVE最低修復資訊：10.1.57。
- 專案證據：[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 唯一已提交application設定；Tomcat TCP address/port，未啟用HTTP2、SSL、FFM、UDS或cluster。；[補充證據 TOMCAT_A_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) main全52檔未發現web.xml/server.xml/context.xml或Tomcat customizer/Realm/security-constraint/RewriteValve/EncryptInterceptor/Http2Protocol/UDS/FFM設定。；[backend/src/main/java/org/xkrotaract/api/Application.java:8-15](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/Application.java#L8) 以SpringApplication啟動embedded容器；非另行維護server.xml的外部WAR部署。
- 官方來源：[CVE-2026-59083 官方資料1](https://tomcat.apache.org/security-10.html)
- 後續：保留告警與逐項證據，不新增suppression。本案若啟用相關功能或部署配置改變須重新核實；後續評估相容的Spring Boot BOM維護升級並跑既有回歸。

### CVE-2026-59084

**不適用**｜tomcat-embed-core-10.1.53.jar｜掃描CRITICAL；供應者Low

- 必要條件：Tomcat Tribes clustering的EncryptInterceptor被部署使用。
- 元件與版本：否；是。
- 判定理由：受影響功能位於Tribes，可選cluster模組未在實際Maven依賴中；core/websocket jar均無tribes/ha/EncryptInterceptor類別，且專案無cluster配置。
- 本CVE最低修復資訊：10.1.57。
- 專案證據：[原掃描座標及報告雜湊](BACKEND_SECURITY_TRIAGE.json) 完整53主+34related Maven依賴中有tomcat-embed-core/el/websocket，沒有tomcat-tribes、tomcat-catalina-ha或tomcat-coyote-ffm。；[補充證據 TOMCAT_A_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) main全52檔未發現web.xml/server.xml/context.xml或Tomcat customizer/Realm/security-constraint/RewriteValve/EncryptInterceptor/Http2Protocol/UDS/FFM設定。；[backend/src/main/java/org/xkrotaract/api/Application.java:8-15](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/Application.java#L8) 以SpringApplication啟動embedded容器；非另行維護server.xml的外部WAR部署。
- 官方來源：[CVE-2026-59084 官方資料1](https://tomcat.apache.org/security-10.html)；[CVE-2026-59084 官方資料2](https://github.com/apache/tomcat/commit/79466463f18cf57704513a5aaa93961bf14c9ef5)
- 後續：保留告警與逐項證據，不新增suppression。本案若啟用相關功能或部署配置改變須重新核實；後續評估相容的Spring Boot BOM維護升級並跑既有回歸。

### CVE-2026-65182

**不適用**｜tomcat-embed-core-10.1.53.jar｜掃描CRITICAL；供應者Important

- 必要條件：較長path constraint先於較嚴格短sub-path constraint的container declarative授權。
- 元件與版本：是；是。
- 判定理由：未定義container路徑security constraints，無所述constraint排序；自訂Session/Service的角色判斷不走這個Tomcat constraint機制。
- 本CVE最低修復資訊：10.1.59。
- 專案證據：[backend/src/main/java/org/xkrotaract/api/SecurityConfig.java:14-45](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SecurityConfig.java#L14) 使用自訂Session/CSRF filter；Spring formLogin/httpBasic禁用；未建立Tomcat Realm或container security constraints。；[補充證據 TOMCAT_A_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) main全52檔未發現web.xml/server.xml/context.xml或Tomcat customizer/Realm/security-constraint/RewriteValve/EncryptInterceptor/Http2Protocol/UDS/FFM設定。；[backend/src/main/java/org/xkrotaract/api/Application.java:8-15](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/Application.java#L8) 以SpringApplication啟動embedded容器；非另行維護server.xml的外部WAR部署。
- 官方來源：[CVE-2026-65182 官方資料1](https://tomcat.apache.org/security-10.html)
- 後續：保留告警與逐項證據，不新增suppression。本案若啟用相關功能或部署配置改變須重新核實；後續評估相容的Spring Boot BOM維護升級並跑既有回歸。

### CVE-2026-68525

**不適用**｜tomcat-embed-core-10.1.53.jar｜掃描CRITICAL；供應者Low

- 必要條件：Tomcat FORM authentication及GET/POST相異container security constraint。
- 元件與版本：是；是。
- 判定理由：未啟用Tomcat FORM LoginConfig或container method constraints；應用自行處理JSON Session API，Spring formLogin亦明確禁用。
- 本CVE最低修復資訊：10.1.59。
- 專案證據：[backend/src/main/java/org/xkrotaract/api/SecurityConfig.java:14-45](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SecurityConfig.java#L14) 使用自訂Session/CSRF filter；Spring formLogin/httpBasic禁用；未建立Tomcat Realm或container security constraints。；[補充證據 TOMCAT_A_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) main全52檔未發現web.xml/server.xml/context.xml或Tomcat customizer/Realm/security-constraint/RewriteValve/EncryptInterceptor/Http2Protocol/UDS/FFM設定。；[backend/src/main/java/org/xkrotaract/api/Application.java:8-15](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/Application.java#L8) 以SpringApplication啟動embedded容器；非另行維護server.xml的外部WAR部署。
- 官方來源：[CVE-2026-68525 官方資料1](https://tomcat.apache.org/security-10.html)
- 後續：保留告警與逐項證據，不新增suppression。本案若啟用相關功能或部署配置改變須重新核實；後續評估相容的Spring Boot BOM維護升級並跑既有回歸。

### CVE-2026-65183

**不適用**｜tomcat-embed-core-10.1.53.jar｜掃描HIGH；供應者Low

- 必要條件：Tomcat Connector建立Unix Domain Socket並指定socket權限；本地不可信使用者可競爭。
- 元件與版本：是；是。
- 判定理由：application.yml配置TCP address/port，沒有unixDomainSocketPath或Connector自訂；Ubuntu CI/Unix OS本身不等於使用UDS。
- 本CVE最低修復資訊：10.1.59。
- 專案證據：[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 唯一已提交application設定；Tomcat TCP address/port，未啟用HTTP2、SSL、FFM、UDS或cluster。；[補充證據 TOMCAT_A_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) main全52檔未發現web.xml/server.xml/context.xml或Tomcat customizer/Realm/security-constraint/RewriteValve/EncryptInterceptor/Http2Protocol/UDS/FFM設定。；[backend/src/main/java/org/xkrotaract/api/Application.java:8-15](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/Application.java#L8) 以SpringApplication啟動embedded容器；非另行維護server.xml的外部WAR部署。
- 官方來源：[CVE-2026-65183 官方資料1](https://tomcat.apache.org/security-10.html)；[CVE-2026-65183 官方資料2](https://tomcat.apache.org/tomcat-10.1-doc/config/http.html)
- 後續：保留告警與逐項證據，不新增suppression。本案若啟用相關功能或部署配置改變須重新核實；後續評估相容的Spring Boot BOM維護升級並跑既有回歸。

### CVE-2026-66422

**不適用**｜tomcat-embed-core-10.1.53.jar｜掃描HIGH；供應者Low

- 必要條件：需使用Tomcat Realm及Servlet宣告security-role-ref角色別名。
- 元件與版本：是：受影響類別在Tomcat core或related websocket jar；仍須功能前提；是：10.1.53落於官方Tomcat影響範圍10.1.0-M1–10.1.57；不代表所有模組/配置適用。
- 判定理由：使用自有SessionService與Spring過濾鏈，未定義Tomcat Realm、web.xml角色參照或isUserInRole授權。
- 本CVE最低修復資訊：10.1.59。
- 專案證據：[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 僅明定DB、multipart、JSON與基本server address/port；未啟用HTTP/2、Realm、Valve或WebDAV。；[backend/README.md:116-120](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/README.md#L116) 正式API尚未部署；正式TLS反向代理與外部配置尚未驗收，結果不外推未知正式環境。；[補充證據 TOMCAT_B_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) 唯讀搜尋36個main程式/配置檔，相關自訂容器、Realm、Valve、WebDAV、WebSocket與HTTP/2啟用項零匹配；保留jar類別清單與雜湊。；[backend/src/main/java/org/xkrotaract/api/SecurityConfig.java:17-45](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SecurityConfig.java#L17) 停用容器表單/Basic認證，使用自有SessionService查核。；[backend/src/main/java/org/xkrotaract/api/SessionService.java:43-67](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SessionService.java#L43) 依cookie雜湊查api_sessions/accounts，而非Tomcat Realm。
- 官方來源：[CVE-2026-66422 官方資料1](https://tomcat.apache.org/security-10.html)
- 後續：記錄本版本不適用的具體前提，不新增suppression；部署配置或相關功能改變時重新核實。

### CVE-2026-68569

**不適用**｜tomcat-embed-core-10.1.53.jar｜掃描HIGH；供應者Important

- 必要條件：需使用DataSourceRealm及CLIENT-CERT/SPNEGO等容器驗證。
- 元件與版本：是：受影響類別在Tomcat core或related websocket jar；仍須功能前提；是：10.1.53落於官方Tomcat影響範圍10.1.0-M1–10.1.57；不代表所有模組/配置適用。
- 判定理由：本案資料庫帳號/Session自行查核，未建立DataSourceRealm或CLIENT-CERT/SPNEGO驗證路徑。
- 本CVE最低修復資訊：10.1.59。
- 專案證據：[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 僅明定DB、multipart、JSON與基本server address/port；未啟用HTTP/2、Realm、Valve或WebDAV。；[backend/README.md:116-120](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/README.md#L116) 正式API尚未部署；正式TLS反向代理與外部配置尚未驗收，結果不外推未知正式環境。；[補充證據 TOMCAT_B_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) 唯讀搜尋36個main程式/配置檔，相關自訂容器、Realm、Valve、WebDAV、WebSocket與HTTP/2啟用項零匹配；保留jar類別清單與雜湊。；[backend/src/main/java/org/xkrotaract/api/SecurityConfig.java:17-45](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SecurityConfig.java#L17) 停用容器表單/Basic認證，使用自有SessionService查核。；[backend/src/main/java/org/xkrotaract/api/SessionService.java:43-67](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SessionService.java#L43) 依cookie雜湊查api_sessions/accounts，而非Tomcat Realm。
- 官方來源：[CVE-2026-68569 官方資料1](https://tomcat.apache.org/security-10.html)
- 後續：記錄本版本不適用的具體前提，不新增suppression；部署配置或相關功能改變時重新核實。

### CVE-2026-34483

**不適用**｜tomcat-embed-core-10.1.53.jar｜掃描HIGH；供應者Low

- 必要條件：需JsonAccessLogValve及非預設relaxedPathChars/relaxedQueryChars。
- 元件與版本：是：受影響類別在Tomcat core或related websocket jar；仍須功能前提；是：10.1.53落於官方Tomcat影響範圍10.1.0-M1–10.1.53；不代表所有模組/配置適用。
- 判定理由：accesslog預設關閉，專案未安裝JsonAccessLogValve或放寬URI字元。
- 本CVE最低修復資訊：10.1.54。
- 專案證據：[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 僅明定DB、multipart、JSON與基本server address/port；未啟用HTTP/2、Realm、Valve或WebDAV。；[backend/README.md:116-120](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/README.md#L116) 正式API尚未部署；正式TLS反向代理與外部配置尚未驗收，結果不外推未知正式環境。；[補充證據 TOMCAT_B_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) 唯讀搜尋36個main程式/配置檔，相關自訂容器、Realm、Valve、WebDAV、WebSocket與HTTP/2啟用項零匹配；保留jar類別清單與雜湊。
- 官方來源：[CVE-2026-34483 官方資料1](https://tomcat.apache.org/security-10.html)；[CVE-2026-34483 官方資料2](https://docs.spring.io/spring-boot/3.5/appendix/application-properties/index.html)
- 後續：記錄本版本不適用的具體前提，不新增suppression；部署配置或相關功能改變時重新核實。

### CVE-2026-34486

**不適用**｜tomcat-embed-core-10.1.53.jar｜掃描HIGH；供應者Important

- 必要條件：需Tomcat叢集Tribes EncryptInterceptor。
- 元件與版本：否：受影響叢集模組不在classpath；是：10.1.53落於官方Tomcat影響範圍僅10.1.53；不代表所有模組/配置適用。
- 判定理由：掃描classpath無tomcat-tribes/catalina-ha，core/websocket jar均無EncryptInterceptor，專案無容器叢集。
- 本CVE最低修復資訊：10.1.54。
- 專案證據：[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 僅明定DB、multipart、JSON與基本server address/port；未啟用HTTP/2、Realm、Valve或WebDAV。；[backend/README.md:116-120](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/README.md#L116) 正式API尚未部署；正式TLS反向代理與外部配置尚未驗收，結果不外推未知正式環境。；[補充證據 TOMCAT_B_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) 唯讀搜尋36個main程式/配置檔，相關自訂容器、Realm、Valve、WebDAV、WebSocket與HTTP/2啟用項零匹配；保留jar類別清單與雜湊。；[原掃描座標及報告雜湊](BACKEND_SECURITY_TRIAGE.json) 遞迴檢視dependencies/relatedDependencies：僅Tomcat core/websocket/el及starter，無Tribes/HA；WebSocket jar存在但不代表有client使用。
- 官方來源：[CVE-2026-34486 官方資料1](https://tomcat.apache.org/security-10.html)
- 後續：記錄本版本不適用的具體前提，不新增suppression；部署配置或相關功能改變時重新核實。

### CVE-2026-34487

**不適用**｜tomcat-embed-core-10.1.53.jar｜掃描HIGH；供應者Low

- 必要條件：需cloud membership叢集整合及Kubernetes bearer token。
- 元件與版本：否：受影響叢集模組不在classpath；是：10.1.53落於官方Tomcat影響範圍10.1.0-M1–10.1.53；不代表所有模組/配置適用。
- 判定理由：掃描classpath無叢集模組，core/websocket jar均無cloud membership類別；專案無Kubernetes membership整合。
- 本CVE最低修復資訊：10.1.54。
- 專案證據：[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 僅明定DB、multipart、JSON與基本server address/port；未啟用HTTP/2、Realm、Valve或WebDAV。；[backend/README.md:116-120](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/README.md#L116) 正式API尚未部署；正式TLS反向代理與外部配置尚未驗收，結果不外推未知正式環境。；[補充證據 TOMCAT_B_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) 唯讀搜尋36個main程式/配置檔，相關自訂容器、Realm、Valve、WebDAV、WebSocket與HTTP/2啟用項零匹配；保留jar類別清單與雜湊。；[原掃描座標及報告雜湊](BACKEND_SECURITY_TRIAGE.json) 遞迴檢視dependencies/relatedDependencies：僅Tomcat core/websocket/el及starter，無Tribes/HA；WebSocket jar存在但不代表有client使用。
- 官方來源：[CVE-2026-34487 官方資料1](https://tomcat.apache.org/security-10.html)
- 後續：記錄本版本不適用的具體前提，不新增suppression；部署配置或相關功能改變時重新核實。

### CVE-2026-41284

**不適用**｜tomcat-embed-core-10.1.53.jar｜掃描HIGH；供應者Low

- 必要條件：需部署WebdavServlet並接受LOCK或PROPFIND請求。
- 元件與版本：是：受影響類別在Tomcat core或related websocket jar；仍須功能前提；是：10.1.53落於官方Tomcat影響範圍10.1.0-M1–10.1.54；不代表所有模組/配置適用。
- 判定理由：WebdavServlet雖在core jar中，本案未註冊WebDAV Servlet；multipart限制不作此CVE的排除理由。
- 本CVE最低修復資訊：10.1.55。
- 專案證據：[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 僅明定DB、multipart、JSON與基本server address/port；未啟用HTTP/2、Realm、Valve或WebDAV。；[backend/README.md:116-120](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/README.md#L116) 正式API尚未部署；正式TLS反向代理與外部配置尚未驗收，結果不外推未知正式環境。；[補充證據 TOMCAT_B_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) 唯讀搜尋36個main程式/配置檔，相關自訂容器、Realm、Valve、WebDAV、WebSocket與HTTP/2啟用項零匹配；保留jar類別清單與雜湊。
- 官方來源：[CVE-2026-41284 官方資料1](https://tomcat.apache.org/security-10.html)；[CVE-2026-41284 官方資料2](https://docs.spring.io/spring-boot/3.5/appendix/application-properties/index.html)
- 後續：記錄本版本不適用的具體前提，不新增suppression；部署配置或相關功能改變時重新核實。

### CVE-2026-43513

**不適用**｜tomcat-embed-core-10.1.53.jar｜掃描HIGH；供應者Low

- 必要條件：需LockOutRealm包裝大小寫不敏感的使用者Realm。
- 元件與版本：是：受影響類別在Tomcat core或related websocket jar；仍須功能前提；是：10.1.53落於官方Tomcat影響範圍10.1.0-M1–10.1.54；不代表所有模組/配置適用。
- 判定理由：本案自行Session與限流，沒有Tomcat LockOutRealm或容器帳密驗證。
- 本CVE最低修復資訊：10.1.55。
- 專案證據：[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 僅明定DB、multipart、JSON與基本server address/port；未啟用HTTP/2、Realm、Valve或WebDAV。；[backend/README.md:116-120](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/README.md#L116) 正式API尚未部署；正式TLS反向代理與外部配置尚未驗收，結果不外推未知正式環境。；[補充證據 TOMCAT_B_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) 唯讀搜尋36個main程式/配置檔，相關自訂容器、Realm、Valve、WebDAV、WebSocket與HTTP/2啟用項零匹配；保留jar類別清單與雜湊。；[backend/src/main/java/org/xkrotaract/api/SecurityConfig.java:17-45](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SecurityConfig.java#L17) 停用容器表單/Basic認證，使用自有SessionService查核。；[backend/src/main/java/org/xkrotaract/api/SessionService.java:43-67](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/java/org/xkrotaract/api/SessionService.java#L43) 依cookie雜湊查api_sessions/accounts，而非Tomcat Realm。
- 官方來源：[CVE-2026-43513 官方資料1](https://tomcat.apache.org/security-10.html)
- 後續：記錄本版本不適用的具體前提，不新增suppression；部署配置或相關功能改變時重新核實。

### CVE-2026-65927

**不適用**｜tomcat-embed-core-10.1.53.jar｜掃描HIGH；供應者Important

- 必要條件：需RewriteValve與[N]旗標規則作為安全控制。
- 元件與版本：是：受影響類別在Tomcat core或related websocket jar；仍須功能前提；是：10.1.53落於官方Tomcat影響範圍10.1.0-M1–10.1.57；不代表所有模組/配置適用。
- 判定理由：未設定RewriteValve或rewrite規則；前端路由不等同Tomcat容器rewrite。
- 本CVE最低修復資訊：10.1.59。
- 專案證據：[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 僅明定DB、multipart、JSON與基本server address/port；未啟用HTTP/2、Realm、Valve或WebDAV。；[backend/README.md:116-120](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/README.md#L116) 正式API尚未部署；正式TLS反向代理與外部配置尚未驗收，結果不外推未知正式環境。；[補充證據 TOMCAT_B_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) 唯讀搜尋36個main程式/配置檔，相關自訂容器、Realm、Valve、WebDAV、WebSocket與HTTP/2啟用項零匹配；保留jar類別清單與雜湊。
- 官方來源：[CVE-2026-65927 官方資料1](https://tomcat.apache.org/security-10.html)
- 後續：記錄本版本不適用的具體前提，不新增suppression；部署配置或相關功能改變時重新核實。

### CVE-2026-68763

**不適用**｜tomcat-embed-core-10.1.53.jar｜掃描HIGH；供應者Important

- 必要條件：需Tomcat連接器啟用HTTP/2。
- 元件與版本：是：受影響類別在Tomcat core或related websocket jar；仍須功能前提；是：10.1.53落於官方Tomcat影響範圍10.1.0-M1–10.1.57；不代表所有模組/配置適用。
- 判定理由：Spring Boot HTTP/2預設false，專案沒有http2啟用或Connector客製；TLS前端代理不代表Tomcat使用HTTP/2。
- 本CVE最低修復資訊：10.1.59。
- 專案證據：[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 僅明定DB、multipart、JSON與基本server address/port；未啟用HTTP/2、Realm、Valve或WebDAV。；[backend/README.md:116-120](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/README.md#L116) 正式API尚未部署；正式TLS反向代理與外部配置尚未驗收，結果不外推未知正式環境。；[補充證據 TOMCAT_B_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) 唯讀搜尋36個main程式/配置檔，相關自訂容器、Realm、Valve、WebDAV、WebSocket與HTTP/2啟用項零匹配；保留jar類別清單與雜湊。
- 官方來源：[CVE-2026-68763 官方資料1](https://tomcat.apache.org/security-10.html)；[CVE-2026-68763 官方資料2](https://docs.spring.io/spring-boot/3.5/appendix/application-properties/index.html)
- 後續：記錄本版本不適用的具體前提，不新增suppression；部署配置或相關功能改變時重新核實。

### CVE-2026-42498

**不適用**｜tomcat-embed-core-10.1.53.jar｜掃描HIGH；供應者Low

- 必要條件：需應用使用Tomcat WebSocket client，帶認證後跟隨至另一host的redirect。
- 元件與版本：是：受影響類別在Tomcat core或related websocket jar；仍須功能前提；是：10.1.53落於官方Tomcat影響範圍10.1.0-M1–10.1.54；不代表所有模組/配置適用。
- 判定理由：related jar tomcat-embed-websocket確有client類別，但本案無WebSocket client/API或外連認證重導流程。
- 本CVE最低修復資訊：10.1.55。
- 專案證據：[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 僅明定DB、multipart、JSON與基本server address/port；未啟用HTTP/2、Realm、Valve或WebDAV。；[backend/README.md:116-120](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/README.md#L116) 正式API尚未部署；正式TLS反向代理與外部配置尚未驗收，結果不外推未知正式環境。；[補充證據 TOMCAT_B_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) 唯讀搜尋36個main程式/配置檔，相關自訂容器、Realm、Valve、WebDAV、WebSocket與HTTP/2啟用項零匹配；保留jar類別清單與雜湊。；[原掃描座標及報告雜湊](BACKEND_SECURITY_TRIAGE.json) 遞迴檢視dependencies/relatedDependencies：僅Tomcat core/websocket/el及starter，無Tribes/HA；WebSocket jar存在但不代表有client使用。
- 官方來源：[CVE-2026-42498 官方資料1](https://tomcat.apache.org/security-10.html)
- 後續：記錄本版本不適用的具體前提，不新增suppression；部署配置或相關功能改變時重新核實。

### CVE-2026-53404

**不適用**｜tomcat-embed-core-10.1.53.jar｜掃描HIGH；供應者Low

- 必要條件：需RewriteValve存在OR鏈與後續非OR條件。
- 元件與版本：是：受影響類別在Tomcat core或related websocket jar；仍須功能前提；是：10.1.53落於官方Tomcat影響範圍10.1.0-M1–10.1.55；不代表所有模組/配置適用。
- 判定理由：未安裝RewriteValve或重寫條件，沒有這條處理路徑。
- 本CVE最低修復資訊：10.1.56。
- 專案證據：[backend/src/main/resources/application.yml:1-24](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/src/main/resources/application.yml#L1) 僅明定DB、multipart、JSON與基本server address/port；未啟用HTTP/2、Realm、Valve或WebDAV。；[backend/README.md:116-120](https://github.com/xk2022/codex-xk-rotaract/blob/632b090fe1576a0a29e14177a2d0d47bf0f6dcde/backend/README.md#L116) 正式API尚未部署；正式TLS反向代理與外部配置尚未驗收，結果不外推未知正式環境。；[補充證據 TOMCAT_B_EVIDENCE.json](BACKEND_SECURITY_TRIAGE.json) 唯讀搜尋36個main程式/配置檔，相關自訂容器、Realm、Valve、WebDAV、WebSocket與HTTP/2啟用項零匹配；保留jar類別清單與雜湊。
- 官方來源：[CVE-2026-53404 官方資料1](https://tomcat.apache.org/security-10.html)
- 後續：記錄本版本不適用的具體前提，不新增suppression；部署配置或相關功能改變時重新核實。

## 任務狀態與交付界線

TASK-002首次核實清單已完成；CVE-2026-42198補證與TASK-003修補留在工程待辦，ENG-Q001未結案。01完成後進入02，不以工程修補作為前置。原需求總表v1.0範圍與優先級保留。

首次核實為分析與文件工作，未修改程式、依賴、安全設定或Secrets，未新增suppression。文件以feat/ISSUE-2-requirements-baseline分支交付，使用者續授權透過[PR #6](https://github.com/xk2022/codex-xk-rotaract/pull/6)合併develop；合併狀態以PR紀錄為準，main與部署不在本次範圍。
