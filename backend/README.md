# 全畫面對應後端 API v0.8

已實作 Java 21、Spring Boot 3.5.13、Spring Security、JDBC、PostgreSQL 17 與 Flyway。本輪已擴充為141個API操作，對應 `bd33582` 的前端範圍（後續收藏及交接總覽見交付差異）；沒有新增前端串接。完整清單見 [API操作索引](../docs/api/operations.md) 與 [本輪交付](../docs/2027/42-backend-api-delivery.md)。正式部署與外部服務仍有下述限制。

## 本地啟動

需要完整 JDK 21（包含 `javac`）、Maven 3.9+、Docker Compose。從 repo 根目錄依 `.env.example` 建立不提交的 `.env`，設定 `POSTGRES_PASSWORD`，然後：

```sh
docker compose up -d postgres
cd backend
export DATABASE_URL=jdbc:postgresql://127.0.0.1:55432/xk_rotaract
export DATABASE_USER=xk_local
# DATABASE_PASSWORD 設定為根目錄 .env 中的 POSTGRES_PASSWORD
# 以下三項由操作者設置，不把真實值寫入 repo：
export DATABASE_PASSWORD='<local database password>'
export IDEMPOTENCY_SECRET='<at least 32 random characters; stable across restarts>'
export LOCAL_REVIEWER_PASSWORD='<12 to 128 code points; local synthetic account only>'
export APP_ORIGIN=https://localhost:5173
mvn -DskipTests package
SPRING_PROFILES_ACTIVE=local mvn spring-boot:run
```

`local` profile 只在資料不存在時建立合成地區、社團與審核者：登入 `reviewer@example.test`，密碼使用 `LOCAL_REVIEWER_PASSWORD`。社團 ID 為 `20000000-0000-4000-8000-000000000001`。再次啟動不覆寫既有密碼或展延角色；重新建立測試資料需明確清理專用本地資料庫。不要對正式資料庫啟用 `local` profile。

服務預設綁定 `127.0.0.1:8080`。前端以 HTTPS Vite 同源代理 `/api`，啟動方式見 [frontend README](../frontend/README.md)。`APP_ORIGIN` 是單一精確來源，必須與瀏覽器網址相符；不接受萬用來源，不採信任意 forwarded header。`__Host-session` 始終保留 Secure、HttpOnly、SameSite=Lax、Path=/、無 Domain；不提供降低 Cookie 安全性的 HTTP 展示模式。

## 已實作端點（原有核心與新增模組）

均在 `/api/v1`，請求與回應依 [OpenAPI](../docs/api/openapi.json)。

- `GET /csrf-token`：匿名 pre-session 或目前登入 Session 綁定 token。
- `POST /accounts`：註冊、不自動登入；Email、選填 E.164 電話唯一；亂數帳號代號。
- `POST /sessions`、`DELETE /sessions/current`、`GET /me`：伺服器 Session、登入輪替、到期與停權檢查。
- `PATCH /me/profile`、`PATCH /me/privacy`：本人白名單、會員資料版本、即時更新查詢投影；不接受角色、Email、電話或 accountId。
- `POST /me/contact-changes`：目前密碼確認後，一次只改 Email 或 E.164 電話；原子唯一性及帳號版本、撤銷其他工作階段、輪替目前 Cookie／CSRF，保留原登入的12小時絕對到期時間。
- `POST /me/account-code-changes`：目前密碼確認後只可改一次；不分大小寫唯一，舊代號永久保留且不能登入、被重新分配；UUID 與關聯不變。
- `GET /clubs`：登入後的啟用社團公開欄位選單。
- `GET/POST /join-applications`、`POST /join-applications/{id}/approve|reject|withdraw`：本人與有效本社管理者範圍、版本、30 日到期、每日五筆、拒絕後24小時冷卻、交易唯一上限、核准日期與重疊檢查。
- `GET /members`、`GET /members/{id}`：登入後投影；未曾核准入社者不出現在名冊；列表無聯絡資訊、詳情依隱私開關省略欄位。

新增完整模組：MFA／轉社與退社OB／年度確認／歷史公開同意與稽核／組織角色與轉區／圖片資產與人工復原／活動與公開社團／公司名錄、地圖及存在確認／優惠配額、本人錢包與一次性核銷／任務中心／商家回報／邀請歷史、取消與撤權／本人確認紀錄。逐端點請以141項 [OpenAPI](../docs/api/openapi.json) 為準。`GET /api/v1/openapi` 提供打包契約，`GET /api/v1/health` 作為含資料庫的啟動檢查。

關鍵建立與審核使用 actor/path/key 的24小時冪等紀錄，請求內容以配置金鑰 HMAC 雜湊，不保存原始密碼。回放內容以獨立用途衍生金鑰 AES-256-GCM 加密，12-byte 隨機 nonce，AAD 綁定 actor、path、key、status 與內容雜湊；不接受明文或驗證失敗的回覆。V3 遷移會清除首次發布前本地試跑的舊明文回放暫存，保留業務資料與加密暫存；先前本地明文請求代號將無法回放原結果，不提供降級解密。每60秒獨立排程清除到期紀錄（不依賴流量），服務停止時不執行、重啟後補清；查詢則到期立即拒絕回放。成功業務操作與冪等回應同交易提交；重送內容不同409。社籍及待審唯一索引搭配會員資料列鎖，不以前端狀態代替交易。管理角色每次請求重查有效期及社團狀態，冪等回放前同樣檢查目前授權。

密碼使用 Argon2id，保留空白且依 Unicode 碼點計長，電話以 libphonenumber 解析。離線弱密碼名單來自 SecLists `Passwords/Common-Credentials/10k-most-common.txt`（2026-10-15 擷取），附原 MIT 授權 `src/main/resources/common-passwords.LICENSE`，另補少量長弱密碼；這不是完整外洩密碼資料庫，後續應定期更新與擴充。沒有外部密碼查詢或將密碼送至第三方。

## 測試

`CORE_TEST_ALLOW_RESET=true mvn verify` 使用 `DATABASE_URL` 指定的真 PostgreSQL，**會清空該資料庫中的核心資料表**；僅可指向獨立合成測試資料庫，勿與正在使用的本地服務或正式資料庫共用。測試啟動前強制要求 `CORE_TEST_ALLOW_RESET=true`、資料庫名稱以 `_test` 結尾，且不能啟用 `local` profile；缺少條件即停止而不清理資料。CI 使用臨時 PostgreSQL17 service。本地範例可另外建立 `xk_rotaract_test` 後執行：

```sh
CORE_TEST_ALLOW_RESET=true DATABASE_URL=jdbc:postgresql://127.0.0.1:55432/xk_rotaract_test mvn verify
```

整合案例涵蓋註冊登入核准至名冊、匿名 CSRF 與 Origin、Cookie 屬性、冪等重放／內容衝突、跨社／撤權、版本、隱私、唯一與密碼空白、待審上限、撤回、拒絕冷卻、停權及核准競爭。本輪在 PostgreSQL 17、JDK 21、Maven 3.9.11 執行 `mvn verify`：111 項測試通過，0 失敗、0 錯誤、0 跳過；包含原有核心回歸、所有新增模組與實際路由覆蓋。年度讀寫及7/1、8/1邊界已驗證，長期維運排程不因此視為完成。

### Java 檢查與覆蓋率報告

在上述獨立測試資料庫與環境變數已設定後，於 `backend/` 執行完整檢查：

```sh
CORE_TEST_ALLOW_RESET=true mvn --batch-mode clean verify
```

Maven Checkstyle Plugin 3.6.0 使用 Checkstyle 14.3.0（需要 Java 21），在 `validate` 階段檢查主程式與測試 Java 檔；規則位於 [CHECKSTYLE.xml](config/checkstyle/CHECKSTYLE.xml)，包含未使用 import、重複／多餘 import、頂層類別與檔名一致，以及每檔一個頂層類別。違規會使建置失敗；不掃描資源檔，也未設定縮排、行長或禁止 wildcard import。這些基本規則不提供完整型別或安全分析。

JaCoCo 0.8.15 在 `initialize` 階段為既有 Surefire 測試 JVM 加入 agent，於 `verify` 產生 HTML／XML 報告；原有 11 個 `*IntegrationTest.java`、111 項測試維持由 Surefire 執行一次。報告納入所有已編譯主程式類別，包括未執行到的類別，不設定固定覆蓋率百分比。另行啟動的 HTTPS 瀏覽器測試應用 JVM 未加入 agent，其執行結果不計入此覆蓋率。

- Checkstyle XML：`target/checkstyle-result.xml`。
- JaCoCo HTML：`target/site/jacoco/index.html`；XML：`target/site/jacoco/jacoco.xml`。
- GitHub Actions 的 `Verify core API` 執行 `clean verify`，逐一確認上述報告非空後，上傳 `backend-quality-<run_attempt>` artifact，保留 7 天；下載並解壓後開啟 `site/jacoco/index.html`。報告於 HTTPS 流程前上傳，後續瀏覽器流程失敗時仍可檢視已產生的報告。

僅檢查上述 Java 規則可執行 `mvn --batch-mode validate`，不會啟動資料庫測試，也不會產生新的覆蓋率報告；執行完整驗證仍須遵守獨立 `*_test` 資料庫與重設許可要求。

## 本人帳號修改與重試

個人姓名／call name 及隱私使用 `member.version`；識別變更使用 `account.version`。空 PATCH、額外欄位、錯誤型別與格式均拒絕；409 不覆寫。頭像支援已上傳且屬於本人的清理後 avatar 資產及 null 清除；拒絕他人、案件證據與不存在資產。圖片上限2MiB、4096×4096，PNG/JPEG/WebP解碼後重編碼為PNG；其他登入者只可讀取目前引用且符合會員投影可見性的頭像。公開社徽只由目前啟用公開社團的引用提供。

聯絡值／代號 POST 必填 `Idempotency-Key`，profile／privacy PATCH 不要求此標頭。錯目前密碼回401 `AUTHENTICATION_FAILED`，不登出目前工作階段；前端應再查 `GET /me`，仍為200則保留登入並顯示密碼錯誤，401才要求重新登入。本人驗證失敗以帳號及 IP 各15分鐘10次限流，之後429；密碼保留所有空白，不寫入稽核／冪等原文。Email 僅去首尾空白、全地址不分大小寫比對，保留 `+` 與點號；電話透過 libphonenumber 驗證實際有效號碼。成功聯絡值變更才撤其他工作階段及更新 Cookie。

帳號資料列鎖序列化識別變更、同帳號競爭與登入最終檢查。登入在鎖後重新核對目前識別、密碼雜湊及狀態；變更在鎖後重新確認工作階段仍存在及未到期，不能以撤銷前的請求快照復活工作階段。V4 以資料庫 trigger 為初始與新代號建立保留紀錄，唯一索引阻擋大小寫與已保留代號競爭。成功 Cookie 只在外層交易提交後送出；業務、工作階段、稽核或冪等保存失敗均回滾。

聯絡／代號變更的冪等重送不重做業務或額外輪替，回覆使用目前有效工作階段重新產生的 `Me`（最新角色、聯絡、版本與 CSRF），不重新交付過期快照。其他操作仍維持原有回放／隱私遮罩規則。若首次回覆遺失而新 Cookie 未抵達瀏覽器，已撤銷的舊 Cookie 不能回放；需以新識別或既有帳號代號重新登入後，以同帳號、同 key／body 重試。這不是新的電話／Email OTP 驗證；兩者仍為後續可選功能。

新增測試覆蓋 PATCH／聯絡／代號白名單及版本、頭像 fail-closed、聯絡唯一與電話解析、舊識別立即失效、Cookie／CSRF 輪替與撤其他 Session、絕對到期保留、冪等回放最新投影、密碼空白與失敗限流、同帳號代號與聯絡競爭、跨帳號 Email 競爭，以及強制保存失敗時的交易回滾與不發送新 Cookie。未驗證大量並發負載，獨立交易限流在連線池高壓下的容量仍需壓測。

## 尚未啟用與正式驗收限制

新增API的前端串接、實際SMTP發送器、正式舊資料匯入、S3替換、長期保留／去識別化排程、備份還原與負載驗收尚未完成。密碼復原與MFA人工復原已有安全的outbox／proof／token及合成資料測試，但未配置真實郵件配送；不會假回「已寄達」。支援案件不替代組織／社籍專責操作，未滿足條件時拒絕核准，不假成功。

廣告權益目前唯讀，不提供新收款或付款／退款／曝光啟用API。人工認領只使用已盤點staging，沒有正式資料自動移轉或UUID合併。讀取列表仍有應用層投影篩選，1萬會員負載目標尚未驗證。

尚未部署正式 API，GitHub Pages 預設維持合成資料展示，既有核心live模式保留。本地建置產物名稱維持`core-api-0.6.0-SNAPSHOT.jar`以相容既有CI；契約版本為0.8.0。正式部署仍需TLS反向代理、資料庫權限隔離、環境秘密管理與後續驗收。
