# Xk-rotaract

採用 monorepo 管理前端、後端與協作文件的專案。

GitHub repo：[xk2022/codex-xk-rotaract](https://github.com/xk2022/codex-xk-rotaract)。

目前已建立目錄骨架與 AI 團隊規範，第一階段與後續模組的需求基準 v1.0 已完成，後續以需求變更調整。前端已選定 React + TypeScript + Vite，UI 保留舊版品牌與配色並適度更新版面，參考 Metronic Tailwind 文件；後端與部署架構已依使用者授權採用需求基準中的預設，詳見[現行規格](docs/2027/13-requirements-baseline.md)。正式供應商設定與資產仍待實際取得。已建立可啟動的 React 前端合成資料雛形、14 項單元測試與瀏覽器流程測試，正式 OpenAPI 已通過靜態驗證；前端 CI／Pages 部署流程已推送，GitHub 建置與測試通過，網站等待管理者首次啟用 Pages；後端與資料庫串接尚未實作。

## 目錄

| 路徑 | 用途 | 目前內容 |
| --- | --- | --- |
| `frontend/` | 前端畫面與互動 | React／TypeScript／Vite 可點擊雛形與測試 |
| `backend/` | 後端 API 與業務邏輯 | 規劃文件 |
| `docs/` | 需求、架構、API 契約與團隊規則 | 協作文件 |
| `.github/workflows/` | GitHub Actions | 前端測試、建置及 Pages 部署流程 |

設計目標為前後端各自建置、測試與部署，具體架構已列需求基準，啟動與部署命令待實作驗證；跨模組變更在同一個 pull request 中協調。

## 開始開發

1. 閱讀 [代理協作規則](AGENTS.md) 與 [團隊分工](docs/TEAM.md)。
2. 閱讀[需求基準](docs/2027/13-requirements-baseline.md)、[角色矩陣](docs/2027/14-role-matrix.md)與[交付清單](docs/2027/11-development-phases.md)。
3. 建立可點擊的前端雛形，同步定義 [API 契約](docs/api/README.md)。
4. 依基準技術完成一條前後端串接流程，再加入經驗證的啟動、測試與 CI 命令。

已確認事項與待決策項目見 [架構紀錄](docs/architecture.md)。

## 體驗第一版

```sh
cd frontend
npm ci
npm run dev
```

完整流程與限制見[前端說明](frontend/README.md)，驗證證據見[交付紀錄](docs/2027/17-prototype-delivery.md)。
