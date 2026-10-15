# Xk-rotaract

採用 monorepo 管理前端、後端與協作文件的專案。

GitHub repo：[xk2022/codex-xk-rotaract](https://github.com/xk2022/codex-xk-rotaract)。

第一階段與後續模組的需求基準 v1.0 已完成，後續以需求變更調整。前端採 React + TypeScript + Vite，保留舊版品牌與配色並更新版面；正式供應商設定與資產仍待取得，詳見[現行規格](docs/2027/13-requirements-baseline.md)。GitHub Pages 已發布前端合成資料展示。另新增 Java 21／Spring Boot／PostgreSQL 17 的本地核心 API 與前端串接模式，涵蓋註冊、登入、入社審核及會員查詢，已有48項前端單元測試與19項資料庫整合測試；本次驗證、啟動與剩餘範圍見[核心串接紀錄](docs/2027/26-core-api-integration.md)。第一階段整體與正式後端部署尚未完成。

## 目錄

| 路徑 | 用途 | 目前內容 |
| --- | --- | --- |
| `frontend/` | 前端畫面與互動 | 公開展示、可選本地 API 串接模式與測試 |
| `backend/` | 後端 API 與業務邏輯 | 13個核心 API operation、Flyway與PostgreSQL整合測試 |
| `docs/` | 需求、架構、API 契約與團隊規則 | 協作文件 |
| `.github/workflows/` | GitHub Actions | 前端 Pages 部署、核心 API 與 HTTPS 流程驗證 |

前後端分開建置與測試，本地啟動命令見各自README；正式後端部署與還原仍待完成。跨模組變更協調既有OpenAPI契約。

## 開始開發

1. 閱讀 [代理協作規則](AGENTS.md) 與 [團隊分工](docs/TEAM.md)。
2. 閱讀[需求基準](docs/2027/13-requirements-baseline.md)、[角色矩陣](docs/2027/14-role-matrix.md)與[交付清單](docs/2027/11-development-phases.md)。
3. 建立可點擊的前端雛形，同步定義 [API 契約](docs/api/README.md)。
4. 依基準技術完成一條前後端串接流程，再加入經驗證的啟動、測試與 CI 命令。

已確認事項與待決策項目見 [架構紀錄](docs/architecture.md)。

本地資料庫與真實 API 串接：[啟動及交付範圍](docs/2027/26-core-api-integration.md)。GitHub Pages 預設仍使用合成資料，不連接本地 API。

[UI／UX 畫面規格](docs/2027/21-ui-ux-spec.md) · [UI／UX 檢查與修正](docs/2027/22-ui-ux-qa.md)

[跨年代評分與優劣勢](docs/2027/23-ui-ux-strengths-and-ratings.md)

[v0.4 UI／UX 改善](docs/2027/24-ui-ux-improvements.md)

## 啟動前端（預設公開首頁）

```sh
cd frontend
npm ci
npm run dev
```

完整流程與限制見[前端說明](frontend/README.md)，驗證證據見[交付紀錄](docs/2027/17-prototype-delivery.md)。

## 對外公開首頁

[公開首頁](https://xk2022.github.io/codex-xk-rotaract/) · [管理入口](https://xk2022.github.io/codex-xk-rotaract/#/admin) · [公開首頁交付說明](docs/2027/20-public-index.md)。僅為合成資料操作雛形，尚未接上後端，重新整理會重設資料。最新入口與全頁升級見[v0.5交付紀錄](docs/2027/25-public-entry-and-page-upgrade.md)。
