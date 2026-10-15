# 架構與決策紀錄

更新：2026-10-15。使用者授權依合理性原則補齊規格；技術選型為開發基準。公開前端與141個後端API已有實作與本地驗證，本輪保留前端資料來源不新增串接；正式部署、SMTP發送及正式資料移轉尚未啟用，詳見[全部API交付](2027/42-backend-api-delivery.md)。

- Monorepo：frontend、backend、docs/api，保留舊repo作來源。
- 前端React＋TypeScript＋Vite，Tailwind，Metronic參考版型；未取得模板授權先採自有元件。
- 後端Java 21、Spring Boot 3.5／Spring Security、PostgreSQL 17／Flyway，單體模組化，Session＋CSRF。
- REST /api/v1、OpenAPI 3.1；加密持久 outbox；目前本地測試 adapter，SMTP 發送器未啟用；圖片暫存 PostgreSQL bytea 並重編碼，S3 相容儲存為後續替換介面。
- 本地Compose／PostgreSQL／Mailpit；正式staging／production隔離、TLS反向代理、設定式供應商。
- 前後端分別建置測試，關鍵權限與社籍交易整合驗收；不用文件狀態替代實測。

詳細決策、理由及預設見[需求基準B08～B13](2027/13-requirements-baseline.md)，權限見[矩陣](2027/14-role-matrix.md)，交付狀態見[階段清單](2027/11-development-phases.md)。新決策可用CR調整，部署與正式資料操作沿用使用者授權邊界。
