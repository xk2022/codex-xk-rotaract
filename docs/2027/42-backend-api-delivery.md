# 全畫面對應後端 API 交付 v0.8

日期：2026-10-15（Asia/Taipei）。本輪使用者授權從規格階段轉為「全部現有前端對應後端 API，先不串接」。

## 掃描基準與保留

原雲端檢出停在文件骨架；已讀取遠端 main 並 fast-forward 至 `bd335822f3ea8d538d12b90459e986e76fc6cca0`，涵蓋優惠核銷，以及最新任務中心、商家回報、本人確認紀錄、共同維護邀請與登入後接續操作前端。原本未追蹤的分析／規格文件在同步前已複製至 `/workspace/shared/api-task-backups/pre-sync-20261015T093831438686Z`，逐檔 SHA-256 核對一致，沒有覆蓋掉原內容。

提交分支已整合至 main 基底 `8981412862f5810eb2d528e6c29056a46541e43d`，保留另一邊新增的 ICS／分享、收藏與年度交接總覽前端。141 項 API 的驗證範圍仍以 `bd33582` 為準；後續新增功能的差異見下方邊界。

本輪只修改後端、API 契約及交付說明；沒有修改前端檔案、資料來源、VITE_API_MODE 或部署流程。既有核心 live 模式仍保留，新增功能不自動切成正式 API。

## 畫面與 API 對應

| 前端畫面／功能 | 後端範圍 | 契約入口 |
| --- | --- | --- |
| 註冊、登入、本人帳號／聯絡／隱私 | 帳號、Session、CSRF、具版本個資與識別變更、MFA 設定與驗證 | `/accounts`、`/sessions`、`/me`、`/me/mfa` |
| 總覽與任務中心 | 本人、社團、已指派支援與明確選擇的商家身分；行動／等待／到期提醒 | `/me/tasks`、`/organization-overview` |
| 會員名冊、詳情與入社申請 | 隱私投影、核准／拒絕／撤回、當前與歷史社籍 | `/members`、`/join-applications` |
| 轉社、退社、OB | 原社／目標社獨立核准，本人最終確認；結束保留歷史 | `/membership-transfers`、`/membership-end-requests`、`/memberships/{id}/end` |
| 年度名冊與確認 | 年度讀寫、明確未確認、7/1／8/1 邊界 | `/clubs/{id}/annual-confirmations` |
| 社團資料、地區與角色交接 | 欄位授權、社徽、停復用、雙方轉區、範圍與任期授權 | `/clubs`、`/districts`、`/role-grants`、`/club-move-requests` |
| 歷史經歷、公開同意與稽核 | 本人決定、具額外權限者隱藏／請求同意、admin 密碼與 MFA 例外 | `/memberships/{id}/experience-visibility`、`/publication-requests/{id}/decision`、`/audit-events` |
| 帳號人工復原、認領與補件 | 案件收據／指派／獨立核實、Email proof、一次性重設、本人確認認領 | `/support-cases`、`/support-recovery-cases`、`/password-resets` |
| 社徽、頭像與案件證據 | 真實圖片驗證重編碼、用途與所有權、公開社徽／受控頭像／私有證據 | `/assets`、`/public/assets/{id}/content` |
| 公開社團、活動列表／詳情與行事曆 | 公開投影、月份與半開時間區間、停社後歷史政策 | `/public/clubs`、`/public/events`、`/public/calendar` |
| 活動工作區 | 草稿、原筆內容更正、發布／取消／封存／複製、組織範圍 | `/events` |
| 公司名錄、商家詳情、地圖與維護 | 營業資料公開旗標、owner/editor、關聯邀請、產業、發布與曝光資格 | `/companies`、`/public/companies`、`/public/map/companies` |
| 三日曝光、社友存在確認 | 首次 72 小時不可刷新、六位有效非維護者、年度與一年期限；曝光權益唯讀 | `/companies/{id}/confirmations`、`/companies/{id}/exposure-grants` |
| 商家問題回報 | 本人建案及追蹤；全域內容管理者接／結案，版本與說明必填，不自動下架公司 | `/business-reports` |
| 共同維護邀請 | 本人收發完整歷史、接受／拒絕／取消／撤權；重邀保留舊筆，無權限自動升級 | `/me/company-invitations`、`/company-invitations/{id}/cancel`、`.../revoke` |
| 本人商家確認紀錄 | 是否計入、到期時間及公開狀態分開；公司隱藏後仍可自行撤回 | `/me/business-confirmations` |
| 登入後接續公開操作 | 沿用公開社團、帳號、Session、入社；前端白名單路由及社團預填，不自動入社 | `/public/clubs/{id}`、`/accounts`、`/sessions`、`/join-applications` |
| 會員優惠、錢包與商家核銷 | 草稿／送審／審核／暫停、名額與每人上限、私人一次性碼、快照及核銷 | `/coupon-offers`、`/me/coupons`、`/companies/{companyId}/coupon-redemptions/confirm` |

完整 [141 個操作索引](../api/operations.md) 與 [OpenAPI](../api/openapi.json)。API 契約會在打包時放入服務；`GET /api/v1/openapi` 可讀取，不依賴本機 checkout 路徑。

## 資料庫與共通保護

沿用 Java 21、Spring Boot 3.5.13、Spring Security、JDBC、PostgreSQL 17；V5～V14 為本輪 additive migrations。整合測試只重建本輪專用 `_test` 資料庫，沒有連線或修改正式資料庫。

所有變更保留 Session、Origin／CSRF 驗證；關鍵 POST 的冪等回放前重驗當前授權。既有 PATCH 契約不強迫新增 Idempotency-Key，仍以資料版本及交易防止覆寫。MFA 使用 TOTP、驗證碼防重放、加密保存密鑰、十五分鐘特權有效期；MFA 回放回傳當前狀態，不讓舊成功回覆復活驗證。

轉社、社籍上限、名額分配與核銷使用資料庫鎖與交易；核准失效的轉區案可安全結束再重提。公開回應採欄位投影，不以選單或按鈕隱藏代替伺服器授權。

## 驗證證據

- `python3 docs/api/validate_contract.py`：141 個操作、158 個 DTO schema、1484 個 JSON 範例通過靜態驗證。
- PostgreSQL 17、JDK 21、Maven 3.9.11 的 `mvn verify`：111 項測試通過，0 失敗、0 錯誤、0 跳過，並成功打包。
- 測試包含既有 29 項核心回歸、各功能業務／權限／版本、競爭與回滾、匿名復原分權、真實圖片引用、TOTP 與實際 Spring 路由對契約雙向覆蓋。
- 已啟動實際打包後的 HTTPS 服務，44 項原生 HTTPS 請求通過：憑證驗證、Secure Session／CSRF、公開與未登入拒絕、活動草稿→發布→更正→公開月曆、商家建立／三日曝光、優惠草稿送審、任務scope、回報本人隔離、邀請取消及雙方歷史、復原待送與實際Tomcat multipart超限400。使用獨立合成smoke資料庫，未串前端。

最新新增模組另做獨立審查；回歸涵蓋邀請競爭、接案／結案競爭、撤權後拒絕回放、7 月寬限不誤列年度待辦、轉社核准失效、過期公開同意，以及帳號復原在社籍結束日的證據分流。測試使用合成資料，沒有寄出真實郵件。

## 邊界與未啟用項目

- 前端未串接新增 API；沒有部署、發布環境或推送 GitHub Pages。
- 郵件 outbox 已持久化並加密；目前只有本地測試 adapter，未啟用實際 SMTP 發送器，請求只回接受／待送，不假稱寄達。實際寄信及供應商驗證另需配置與驗收。
- 正式舊資料尚未匯入；認領 API 可對經盤點的 staging 合成資料驗證，不虛構正式來源，不自動合併永久 UUID 或搬遷正式社籍。
- main 後續新增的 ICS／分享已是純前端匯出，可沿用公開活動查詢；本輪尚未補收藏持久化 API，也未驗收年度交接總覽的真實資料串接及計算規則。三項前端文件為 39～41，本輪後端文件順延為 42～43。
- 前端目前曝光權益為唯讀，本輪不新增收款、付款確認、廣告啟用、退款、QR 設備或真實通知。
- 支援案件不讓 account_support 代替組織／社籍／停復權專責流程；未具備條件的核准會被拒絕，不假改帳號或社團狀態。
- 未完成正式部署、負載目標、長期保留／去識別化排程、備份還原與外部服務驗收；端點實作與本地測試不等於正式上線。
