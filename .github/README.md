# GitHub 協作與自動檢查

前端 PR 檢查、API 驗證與 Pages 示範站部署由不同工作流程負責。各次執行結果以 GitHub Actions 為準；本地驗證不能代替遠端工作流程結果。

## 工作流程

| 工作流程 | 觸發方式 | 檢查與輸出 |
| --- | --- | --- |
| [Verify frontend](workflows/verify-frontend.yml) | 所有目標分支的 PR、手動執行 | Node 24、`npm ci`、前端單元測試、TypeScript 檢查及 Vite 建置；不部署 |
| [Verify core API](workflows/core-api.yml) | main 的相關路徑 push、相關路徑 PR、手動執行 | API 靜態契約、Java 21／PostgreSQL 17 的 `mvn verify`，以及核心入社與本人帳號的兩條 live HTTPS 瀏覽器流程 |
| [Deploy frontend to GitHub Pages](workflows/deploy-frontend.yml) | main 的前端或該 workflow 變更、手動執行 | 前端測試與建置、正式輸出子路徑的展示瀏覽器檢查，通過後發布 `frontend/dist` |

既有 API 與 Pages 工作流程的觸發條件保持不變。Pages 發布的是合成資料展示，不代表正式後端已部署。

## 前端 PR 檢查

`Verify frontend` 的固定 job ID 與名稱均為 `frontend-check`。工作流程不設 PR 目標分支或路徑篩選，涵蓋 Git Flow 各目標分支及純文件 PR，避免這個檢查因路徑條件而沒有回報。

所有 shell 步驟在 `frontend/` 執行，依序進行：

```sh
npm ci
npm test
npm run build
```

`npm run build` 已包含 `tsc -b` 與 `vite build`。任一步驟失敗即令 job 失敗，不使用 `continue-on-error` 或忽略錯誤。依賴依既有 `package-lock.json` 安裝，不新增套件或修改產品程式。

此 job 限時 15 分鐘，僅有 `contents: read` 權限；checkout 不保留 Git 憑證，兩個 Actions 固定完整 commit SHA，npm cache 依前端 lockfile 建立。併行群組依 Repository、工作流程及 PR 編號／ref 區分；同一 PR 的新執行會取消舊執行，不影響其他 PR 或既有 Pages 部署群組。

## 檢查結果與合併條件

新增 workflow 會提供檢查結果，**不會自動設定分支保護或 required checks**。要由 GitHub 強制阻擋合併，仍須另經核准配置 ruleset／branch protection，並在實際 PR 執行後核對 `frontend-check` 的 check 名稱。必要檢查失敗、取消或沒有結果，不能視為已通過。

這是前端單元測試與建置的第一批改善。Lint、安全／依賴掃描、Coverage、後端 unit／integration 分層及完整品質總閘門仍有後續工作；不能據此宣稱已符合 XK SYSTEM 全套 CI 規範。瀏覽器展示測試與核心 live 測試也不代表所有新增畫面已完成真實 API 整合。

建立 PR、Merge 與正式部署依 [AGENTS.md](../AGENTS.md) 的核准界線處理；檢查通過不等於取得操作核准。

## Pages 部署與歷史紀錄

Pages build 僅有 `contents: read`；deploy 才有 `pages: write`／`id-token: write`，使用 `github-pages` environment。並行部署依序完成，不中斷已開始的部署；不使用個人存取憑證，不發布後端或私人文件。詳細設定見[前端部署說明](../frontend/README.md#github-pages-部署)。

2026-10-15 啟用紀錄：使用者完成 public 與 Pages Source 設定後，[run 38671615647](https://github.com/xk2022/codex-xk-rotaract/actions/runs/38671615647) 的 build 與 deploy 成功。此紀錄保留作歷史來源；目前每次發布的版本與結果仍須查該次 Actions。
