# 相關分支整併紀錄

日期：2026-10-21（Asia/Taipei）。依使用者「把所有相關分支整併回 main」的指示執行。

## 範圍與來源

本次起始遠端 main 為 `8088b65`。後端 API 與工程規範已分別由 PR #1、#2 合併；本次再以四次 merge 納入其餘內容，保留各分支提交歷史。

| 來源分支 | 盤點時的 Head | 納入方式 |
| --- | --- | --- |
| `codex/backend-all-screen-apis` | `28285fe` | 已包含於起始 main（PR #1） |
| `docs/xk-standards-v1` | `b43f9ff` | 已包含於起始 main（PR #2） |
| `develop` | `7975e15` | 本次合併需求彙整與工程待辦 |
| `feat/ISSUE-2-requirements-baseline` | `eb76689` | 隨 develop 納入，保留原 PR #6 歷史 |
| `feat/ISSUE-2-development-templates` | `79dc1c3` | 本次合併 Issue／PR 範本（PR #5） |
| `feat/ISSUE-2-frontend-pr-checks` | `570a0d0` | 本次合併前端品質與依賴稽核（PR #3） |
| `feat/ISSUE-2-backend-ci-checks` | `afbe3be` | 本次合併後端品質與安全修補（PR #4） |

四次 merge 均無內容衝突。程式整合結果為 `a581bf2`；後續文件提交只更新整併紀錄、CI 說明及安全工程待辦的狀態。

## 合併後驗證

| 驗證 | 實際結果 |
| --- | --- |
| `python3 docs/api/build_contract.py --check` | 通過，模組 fragment 與打包契約一致 |
| `python3 docs/api/validate_contract.py` | 通過：141 個操作、158 個 DTO schema、1484 個 JSON 範例 |
| 前端 `npm ci`、`npm run lint` | 通過；使用可寫入的獨立 npm cache |
| 前端 `npm run test:coverage` | 18 個測試檔、184 項測試通過，已產生 Coverage 報告 |
| 前端 `npm run build` | TypeScript 與 Vite 正式建置通過 |
| 前端 `node scripts/audit-dependencies.mjs` | 當次 registry 稽核未發現已知弱點；包含 production／development／optional／peer 鎖定依賴 |
| 後端 `mvn --batch-mode clean verify` | Java 21／Maven 3.9.11／PostgreSQL 17.11；12 個 suite、114 項測試通過，0 失敗、0 錯誤、0 跳過 |
| Checkstyle、JaCoCo 與打包 | Checkstyle 0 error；HTML／XML 覆蓋率報告存在；成品僅包含 pgJDBC 42.7.14 |
| 既有 live HTTPS 瀏覽器流程 | 兩條均通過：註冊／入社／審核／名冊／隱私，以及本人帳號／聯絡值／Session；僅使用獨立合成 smoke 資料庫。測試前更新已過期的本地測試憑證，代理與 curl 的 TLS 驗證保持啟用 |
| `git diff --check` | 通過 |

前後端 CI 分支已分別做獨立唯讀審查，未發現合併阻擋問題；依賴稽核程式也驗證了失敗及無效報告會保留非零退出碼。既有僅報告弱點的政策未在本次整併中更動。

## 未完成的外部驗證與保留事項

雲端代理拒絕連線至 NVD（CONNECT 403），因此本次沒有完成後端 OWASP 弱點資料庫冷啟動與重掃。這是來源存取受限，沒有降低 TLS 驗證、改用過期資料或將掃描記為成功；後端已知風險仍依[安全修補紀錄](BACKEND_SECURITY_REMEDIATION.md)與[工程待辦](ENGINEERING_BACKLOG.md)追蹤。

本地建置及測試不代表 GitHub Actions 已成功。main 推送後會依既有設定觸發相關 CI 與 Pages 合成資料展示流程，實際遠端結果須以各次 Actions 為準；此紀錄不宣稱正式後端已部署。

本次沿用現有 API 與畫面資料模式，沒有開始新增畫面的前後端串接、正式資料移轉或修改正式認證／TLS 配置。來源分支保留供追溯。

## 合併核對

逐一確認各遠端來源 Head 都是 main 的祖先；推送採一般 fast-forward 更新，不使用 force push。遠端 main 的最終 SHA 與同步狀態以本次交付訊息及 Git 記錄為準。
