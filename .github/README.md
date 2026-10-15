# GitHub 協作設定

`workflows/deploy-frontend.yml` 提供 GitHub Pages 的前端雛形建置與部署：main 的 frontend 變更與手動執行觸發，Node 24、npm ci、14 項單元測試及 TypeScript／Vite build，僅發布 frontend/dist。

權限依工作分開：build contents:read，deploy pages:write／id-token:write，部署環境 github-pages；不設定個人存取憑證、不發布後端或私人文件。並行部署依序完成，不中斷已開始的部署。

Pages方案及Source設定見[前端部署說明](../frontend/README.md#github-pages-部署)。首次執行的建置與測試通過，但 GitHub 拒絕目前 Actions 權杖建立 Pages（Resource not accessible by integration）。目前將檢查 Pages 啟用放在 deploy，讓 build 先保留產物。使用者已將 repo 改為 public，但最新嘗試仍需管理者在 Settings → Pages 選擇 GitHub Actions 作為 Source，之後重跑失敗的 deploy；未啟用前沒有可用網站。後端CI與部署尚未加入。

## 最新發布狀態（2026-10-15）

使用者完成 public 與 Pages Source 設定後，run 38671615647 的 build 與 deploy 均成功，Pages 回報部署完成並提供 https://xk2022.github.io/codex-xk-rotaract/ 。先前首次啟用限制已解除。僅發布前端合成資料雛形，後端CI與部署仍未加入。
