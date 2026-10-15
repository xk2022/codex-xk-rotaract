# 第一條核心 API 流程 v0.6

已實作 Java 21、Spring Boot 3.5.13、Spring Security、JDBC、PostgreSQL 17 與 Flyway。這是第一階段的核心串接切片，並非完整第一階段後端。

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

## 已實作端點

均在 `/api/v1`，請求與回應依 [OpenAPI](../docs/api/openapi.json)。

- `GET /csrf-token`：匿名 pre-session 或目前登入 Session 綁定 token。
- `POST /accounts`：註冊、不自動登入；Email、選填 E.164 電話唯一；亂數帳號代號。
- `POST /sessions`、`DELETE /sessions/current`、`GET /me`：伺服器 Session、登入輪替、到期與停權檢查。
- `GET /clubs`：登入後的啟用社團公開欄位選單。
- `GET/POST /join-applications`、`POST /join-applications/{id}/approve|reject|withdraw`：本人與有效本社管理者範圍、版本、30 日到期、每日五筆、拒絕後24小時冷卻、交易唯一上限、核准日期與重疊檢查。
- `GET /members`、`GET /members/{id}`：登入後投影；未曾核准入社者不出現在名冊；列表無聯絡資訊、詳情依隱私開關省略欄位。

關鍵建立與審核使用 actor/path/key 的24小時冪等紀錄，請求內容以配置金鑰 HMAC 雜湊，不保存原始密碼。回放內容以獨立用途衍生金鑰 AES-256-GCM 加密，12-byte 隨機 nonce，AAD 綁定 actor、path、key、status 與內容雜湊；不接受明文或驗證失敗的回覆。V3 遷移會清除首次發布前本地試跑的舊明文回放暫存，保留業務資料與加密暫存；先前本地明文請求代號將無法回放原結果，不提供降級解密。每60秒獨立排程清除到期紀錄（不依賴流量），服務停止時不執行、重啟後補清；查詢則到期立即拒絕回放。成功業務操作與冪等回應同交易提交；重送內容不同409。社籍及待審唯一索引搭配會員資料列鎖，不以前端狀態代替交易。管理角色每次請求重查有效期及社團狀態，冪等回放前同樣檢查目前授權。

密碼使用 Argon2id，保留空白且依 Unicode 碼點計長，電話以 libphonenumber 解析。離線弱密碼名單來自 SecLists `Passwords/Common-Credentials/10k-most-common.txt`（2026-10-15 擷取），附原 MIT 授權 `src/main/resources/common-passwords.LICENSE`，另補少量長弱密碼；這不是完整外洩密碼資料庫，後續應定期更新與擴充。沒有外部密碼查詢或將密碼送至第三方。

## 測試

`CORE_TEST_ALLOW_RESET=true mvn verify` 使用 `DATABASE_URL` 指定的真 PostgreSQL，**會清空該資料庫中的核心資料表**；僅可指向獨立合成測試資料庫，勿與正在使用的本地服務或正式資料庫共用。測試啟動前強制要求 `CORE_TEST_ALLOW_RESET=true`、資料庫名稱以 `_test` 結尾，且不能啟用 `local` profile；缺少條件即停止而不清理資料。CI 使用臨時 PostgreSQL17 service。本地範例可另外建立 `xk_rotaract_test` 後執行：

```sh
CORE_TEST_ALLOW_RESET=true DATABASE_URL=jdbc:postgresql://127.0.0.1:55432/xk_rotaract_test mvn verify
```

整合案例涵蓋註冊登入核准至名冊、匿名 CSRF 與 Origin、Cookie 屬性、冪等重放／內容衝突、跨社／撤權、版本、隱私、唯一與密碼空白、待審上限、撤回、拒絕冷卻、停權及核准競爭。本次在 PostgreSQL 17.11 執行 `mvn verify`：19 項整合測試通過，0 失敗、0 錯誤、0 跳過；測試包含年度查詢 7/1、8/1 台北日期邊界，並不代表年度寫入與排程已實作。

## 尚未實作

帳號代號修改、聯絡值變更、本人資料與隱私修改端點、密碼復原、TOTP、轉社／退社／OB、年度確認與補跑排程、組織／角色管理、歷史公開、支援案件、資產、SMTP outbox、備份還原與負載驗收仍待後續切片。本次僅讀取年度資格日期；未提供年度寫入或排程。讀取列表目前採應用層投影篩選，1萬會員負載目標尚未驗證，不應直接當正式上線版本。Mailpit 已規劃本地服務，但本切片不寄信，沒有假回「已寄達」。

尚未部署正式 API，GitHub Pages 預設維持合成資料展示。正式部署仍需 TLS 反向代理、資料庫權限隔離、環境秘密管理與後續驗收。
