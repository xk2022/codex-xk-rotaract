# UI／UX 檢查與修正紀錄 v0.3.1

日期：2026-10-15。針對目前假資料前端，配合[UI／UX 規格](21-ui-ux-spec.md)盤點與操作檢查。此紀錄不代表後端或正式安全驗收。

## 本次發現及修正

| 編號 | 重現操作 | 修正前 | 修正方式 | 驗收條件 |
| --- | --- | --- | --- | --- |
| UX-01 | 會員→帳號設定→輸入新姓名但不儲存→畫面情境選「資料版本衝突」→重新取得資料 | 表單被卸載，草稿消失，與「輸入會保留」提示矛盾 | 狀態提示獨立呈現；原內容暫時隱藏並停止互動，保持同一表單實例 | 回復後仍有原草稿，尚未擅自儲存；登入逾時仍須重新登入 |
| UX-02 | 社長→退社與OB→直接辦理第一位社員→繼續為選單顯示的下一位社員辦理 | 選單顯示下一位，送出卻沿用已結束社籍的舊ID而失敗 | 顯示值與送出值一律取自目前有效社員；舊選取失效時改用第一個有效選項 | 連續兩次辦理各移除正確社員，歷史仍保留 |

`frontend/scripts/browser-ux.mjs` 在修正前實際回報 `draftPreserved: false`、`secondMemberCompleted: false`，修正後兩者為 `true`。測試檢查可見選取與實際結果，不只檢查畫面文案。

## 驗證方法

先啟動 frontend dev server；系統 Chromium 可透過 `CHROMIUM_PATH=/usr/bin/chromium` 指定。

```sh
npm --prefix frontend run build
npm --prefix frontend test
npm --prefix frontend run test:browser
npm --prefix frontend run test:browser:v2
npm --prefix frontend run test:browser:public
npm --prefix frontend run test:browser:ux
```

- 單元測試38項，涵蓋帳號、社團角色、社籍／年度、歷史與支援模型。
- 核心瀏覽器流程涵蓋註冊入社、三段轉社、隱私、年度與手機操作。
- v2涵蓋帳號識別變更、角色、年度、OB、同意彈窗、案件補件、新社團入社與分頁。
- 公開站流程涵蓋匿名頁、直連與重新整理、搜尋／詳情、活動月份、登入註冊、管理入口與鍵盤操作。
- UX回歸涵蓋本次兩項修復，並檢查360／768／1024px公開頁與工作區是否水平溢出。

## 本次結果

正式建置、38項單元測試及上述四套瀏覽器流程均通過。UX檢查包含360／768／1024px，沒有水平溢出或瀏覽器例外。獨立審查已複核兩項程式修補，並將文件中匿名復原、角色欄位及異動紀錄的描述修正為實際行為。文件相對連結檢查通過。

## 仍待驗證與後續工作

- [ ] 使用者先前回報的公開首頁異常尚未提供具體症狀，不能把本次兩項修正視為該問題已定位。外網工具未能直接開啟 Pages；部署結果與本地建置驗證須分開看待。
- [ ] 真實裝置 Safari／Chrome、輔助科技及完整無障礙稽核。
- [ ] 後端整合後的真正403／409、斷線、重送、Session失效與交易競爭。
- [ ] 跨頁離開前的未儲存提示與草稿策略，目前只保證同頁情境切換／重試保留，不保證換頁、登出或重新整理保留。
- [ ] 真實舊資料、圖片服務、郵件與效能樣本驗證。

## 發布

程式與文件提交 `c6c5e61` 已推送 main；[GitHub Actions 38678551729](https://github.com/xk2022/codex-xk-rotaract/actions/runs/38678551729) 的 build／deploy 均成功。修補已發布至 [GitHub Pages](https://xk2022.github.io/codex-xk-rotaract/)。此為部署工作結果，不代表已在使用者的裝置重現或排除先前未明首頁異常。
