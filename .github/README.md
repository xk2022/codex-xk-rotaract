# GitHub 協作設定

`workflows/deploy-frontend.yml` 提供 GitHub Pages 的前端雛形建置與部署：main 的 frontend 變更與手動執行觸發，Node 24、npm ci、41 項單元測試及 TypeScript／Vite build，僅發布 frontend/dist。

權限依工作分開：build contents:read，deploy pages:write／id-token:write，部署環境 github-pages；不設定個人存取憑證、不發布後端或私人文件。並行部署依序完成，不中斷已開始的部署。

Pages 已啟用 GitHub Actions Source，詳細命令見[前端部署說明](../frontend/README.md#github-pages-部署)。後端CI與部署尚未加入。

## 最新發布狀態（2026-10-15）

使用者完成 public 與 Pages Source 設定後，run 38671615647 的 build 與 deploy 均成功，Pages 回報部署完成並提供 https://xk2022.github.io/codex-xk-rotaract/ 。先前首次啟用限制已解除。僅發布前端合成資料雛形，後端CI與部署仍未加入。
