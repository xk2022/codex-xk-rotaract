# 全畫面後端 API 契約 v0.8

[OpenAPI 3.1 JSON](openapi.json) 包含 141 個已實作 API 操作、158 個封閉 DTO schema，涵蓋 `bd33582` 的前端功能；最新收藏持久化與交接總覽差異見交付紀錄。完整清單見 [操作索引](operations.md)，畫面對應與驗證見 [交付紀錄](../2027/42-backend-api-delivery.md)。本輪沒有修改前端或新增前後端串接。

`GET /api/v1/openapi` 直接提供打包契約（不遞迴列入自身），`GET /api/v1/health` 檢查服務與資料庫。全部功能路徑以 `/api/v1` 為前綴。Cookie、CSRF、角色、資料範圍與資源版本均由伺服器驗證，不接受前端角色旗標。

## 讀取與驗證

契約為標準 JSON，可供支援 OpenAPI 3.1／JSON Schema 2020-12 的工具讀取。只需 Python 3 標準函式庫即可執行專案靜態檢查：

```sh
python3 docs/api/build_contract.py --check
python3 docs/api/validate_contract.py
```

核心契約保留於 `openapi.json`，模組覆寫位於 `fragments/`；修改模組後執行 `python3 docs/api/build_contract.py`，再做靜態及後端驗證。刪除端點或 schema 時也需同步移除合併文件，實際 Spring 路由覆蓋測試會拒絕契約漂移。

檢查涵蓋全部內部 `$ref`、operationId 唯一、原端點清單及補充操作覆蓋、所有 DTO 可達性、輸入欄位白名單、required、JSON 範例型別／長度／enum／format／條件 schema、版本與 CSRF 宣告，以及轉社、隱私與人工復原的必要保護條件。也以負例檢查額外權限欄位、空更新、不合法電話／Email 與過短密碼。

這是針對本契約所用關鍵字的靜態檢查，**不是完整通用 OpenAPI 驗證器，也不替代伺服器授權、PostgreSQL 交易或 E2E 驗收**。後續 CI 可再加入標準 OpenAPI 工具；本次沒有額外套件或網路依賴。

## 共通協定

- Session：`__Host-session` Cookie，Secure、HttpOnly、SameSite=Lax、Path=/、不設 Domain；閒置 30 分鐘、絕對 12 小時。每請求重查停權、有效角色及範圍，不能信任登入時的舊權限。
- CSRF：先 `GET /csrf-token` 初始化匿名或登入工作階段；每個變更請求帶 `X-CSRF-Token`，同時驗證 Origin。登入、註冊、重設等匿名變更也適用。Token 不放 URL、持久儲存或日誌。
- 更新：request 的 `version` 指向被修改資源；不相符回 409 並重新讀取，不覆寫他人更新。新建不假設已存在版本；社團跨區提案另帶 `clubVersion`，歷史公開提案綁 `contentVersion`／`visibilityVersion`。
- 關鍵建立／執行需 `Idempotency-Key`，以帳號（匿名時以 pre-session）、路徑及 key 界定，保留 24 小時；同內容重放結果，不同內容回 409。含密碼請求用受控摘要指紋，不保存原始密碼；需重放的敏感回覆以受控加密保存並到期清除，不存明文 token。
- 通用錯誤含 `code/message/fieldErrors/requestId`；未登入 401、動作不足 403、資源不存在或跨可見範圍一致 404、版本／識別／狀態衝突 409、限流 429（含 Retry-After）。不回堆疊、密碼、憑證或帳號存在證據。
- 分頁 page 預設 1、pageSize 預設 20，範圍 20～100；篩選資格與資料範圍先於 count／pagination。UUID 不因代號／電話／Email 更換而改動；業務日期 Asia/Taipei、瞬間 UTC、社籍區間 `[startsOn, endsOn)`。
- 所有物件拒絕額外欄位。選填字串依規格正規化空白為 null，密碼保留原字元；欄位有條件時由 schema 與操作規則共同限制。日期先後、跨資料庫唯一、任期／年資等業務條件須由實作檢查，並非宣告 enum 就自動成立。
- 含會員、案件、憑證、CSRF 或稽核的回覆須 `Cache-Control: no-store`；範例為設計用途，不可拿來當真實憑證。

## 投影與權限

每個操作的 `x-authorization` 是伺服器驗權要求，`x-state-safeguards` 是實作及交易測試的必要條件。OpenAPI security scheme 僅說明憑證傳遞，不能代替資源授權。

- `MemberListItem` 不含電話／Email；`MemberDetail` 僅登入且符合被查資格、本人或有效管理範圍可讀。被隱藏聯絡欄位完全省略，管理角色不豁免隱私，也不能用隱藏聯絡值搜尋。
- `PublicExperience` 不含姓名、memberId、聯絡、原因及證據。`MembershipProjection` 明確標示 public/self/managed/former_club；原社只能取得自身歷史段，不得讀新社或新聯絡值。
- `GET /clubs/{id}?view=public` 可匿名，只回已啟用社團與已開放聯絡欄位；managed 投影需有效範圍授權。會員搜尋一律登入，沒有匿名整體經歷查詢。
- 社長／秘書／一般管理者／備援可審自己社團的一側；地區角色不能代替雙社核准。一般管理者不能授角色或改名稱／社徽。平台權限不互相繼承，history:moderate／override 需額外具名範圍授權。
- 三段式轉社：本人申請 → 雙社核准（僅 ready_for_member）→ 本人 execute。執行再驗有效授權與版本；失效 needs_reapproval；結束舊籍／建立新籍同一交易，不留半筆資料。
- 年度資格按日期即時判定：7 月寬限、8/1 未確認撤免費曝光；補確認即恢復，不能復活已結束社籍。獨立有效付費廣告不受年度待確認影響，廣告 API 不在第一階段。

## 新增畫面的讀寫入口

- 任務中心：`GET /me/tasks?scope=self|club|support|business`。預設本人待辦；社團需 `clubId`，帳號支援僅已指派案件。私人商家提醒須明確選擇 business，伺服器仍只使用登入者會員身分。`priority=all|action|waiting|reminder`；summary 是篩選及分頁前數量，不發送通知。
- 商家回報：`GET/POST /business-reports`、`GET /business-reports/{id}`，以及 `POST .../accept|close`。一般會員只讀本人；`scope=managed` 與接／結案需要全域內容管理角色。案件處理不會自動下架公司。
- 共同維護邀請：`GET /me/company-invitations` 回本人收發的全部狀態；`POST /companies/{id}/links` 建立，`POST /company-invitations/{id}/accept|reject|cancel|revoke` 決定。決定時 version 是邀請版本，可另外帶 companyVersion；被拒絕、取消或撤權的紀錄保留，重新邀請產生新 UUID。
- 本人確認紀錄：`GET /me/business-confirmations` 回到期時間、是否計入及公司是否公開；隱藏公司仍保留本人可撤回的最小紀錄，不揭露聯絡資料或其他確認者。
- 登入後返回公開頁與入社預填由前端 allowlist 處理；伺服器沿用公開社團、帳號、Session 與入社 API，重新驗證社團狀態，不因登入或註冊自動申請入社，也沒有接受任意 redirect URL 的新增入口。

## 清單之外補足的必要操作

原清單使用 Cookie／CSRF 及雙地區移轉，但沒有列完整取得 token 與後續核准路徑，因此補入：

- `GET /csrf-token`。
- `POST /club-move-requests/{id}/approve`、`POST /club-move-requests/{id}/execute`：兩地區各自核准後，原子切換範圍並立即撤原地區存取。

另補 `GET /clubs` 社團選擇、`GET /clubs/{id}/annual-confirmations` 年度資料與版本、`GET /membership-end-requests` 退社／OB 待辦、`GET /club-move-requests` 雙地區待辦，讓審核者能發現案件並於 409 後重讀正確版本。

未登入人工復原不能依賴既有登入，補入完整受控流程：

1. `POST /support-recovery-cases`：識別值、新信箱及說明，統一 202 回覆；無論是否匹配帳號都不洩漏存在性。只產生案件收據，不自動證明本人或綁定帳號。
2. `GET /support-recovery-cases/{id}`：透過 `X-Support-Receipt` 查本案狀態，不回會員身分或證據。收據只限一案、最多 30 日、結案撤銷，不能登入。
3. `POST /support-recovery-cases/{id}/evidence`：收據及 CSRF 限定本案補件，最多 10 張，每張 2 MiB、4096×4096、PNG/JPEG/WebP，所有證據私有。
4. 被派支援者由既有 `/support-cases` 與 resolve 操作核對獨立證據；匿名復原核准須提供核實的 `verifiedSubjectAccountId`。僅新信箱、姓名或案件收據不足以核准；核准先寄新信箱持有驗證連結，不直接改帳密。
5. `POST /support-recovery-email-confirmations`：一次性 30 分鐘 proof token 換成限定該案件、永久帳號與新信箱的單次密碼重設 token；此時仍不改登入資料。
6. 既有 `POST /password-resets` 最後在同一交易檢查新 Email 唯一、替換信箱與密碼、完成案件並撤銷全部工作階段與案件 token。一般忘記密碼 token 不能更換信箱。

寄信失敗使用 outbox 有限重試，不假稱已送達；任何證據不足保持待補件。復原證據結案 30 日刪除，案件稽核依基準保留。此流程已有本地合成資料與資料庫測試；實際 SMTP 發送器未啟用，outbox 維持待送，不宣稱寄達。

## 下一階段驗收

後端實作須按[第一階段驗收追蹤](../2027/15-phase1-contract.md#驗收追蹤)完成跨社／跨區拒絕、競爭與回復、一次性 token、角色到期、7/1／8/1 邊界、公開同意與隱私投影測試；靜態契約通過不代表上述執行測試已通過。
