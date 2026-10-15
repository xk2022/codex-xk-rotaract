# 架構與決策紀錄

更新：2026-10-15。使用者授權依合理性原則補齊規格；技術選型為開發基準，尚未建置或實測。

- Monorepo：frontend、backend、docs/api，保留舊repo作來源。
- 前端React＋TypeScript＋Vite，Tailwind，Metronic參考版型；未取得模板授權先採自有元件。
- 後端Java 21、Spring Boot 3.5／Spring Security、PostgreSQL 17／Flyway，單體模組化，Session＋CSRF。
- REST /api/v1、OpenAPI 3.1；SMTP adapter＋outbox，S3相容檔案介面。
- 本地Compose／PostgreSQL／Mailpit；正式staging／production隔離、TLS反向代理、設定式供應商。
- 前後端分別建置測試，關鍵權限與社籍交易整合驗收；不用文件狀態替代實測。

詳細決策、理由及預設見[需求基準B08～B13](2027/13-requirements-baseline.md)，權限見[矩陣](2027/14-role-matrix.md)，交付狀態見[階段清單](2027/11-development-phases.md)。新決策可用CR調整，部署與正式資料操作沿用使用者授權邊界。
