# 風險、遷移與新版差異

本文件的風險依 [來源提交 0c2aad93](https://github.com/xk2022/xkRotaract/tree/0c2aad93e1127b5e99b9e65bbd3adb7f3d7b2788) 靜態判讀，沒有對線上站進行攻擊、執行舊程式或驗證正式資料。所有改善項目都是未來規格條件，這次只製作文件。

## 需優先處理的來源問題

| 議題 | 實際證據 | 新版應規定的處理 |
| --- | --- | --- |
| 密碼驗證 | `src/main/java/com/xk/admin/service/impl/AuthServiceImpl.java` 直接比對傳入 password，並註記前端 MD5 | 採標準伺服器端密碼雜湊；不可原樣沿用 MD5；舊帳號以驗證後重設／遷移方案處理 |
| 密碼重設 | `src/main/java/com/xk/admin/controller/web/AuthorizationController.java` 的 newPassword POST 只收 email/password 並呼叫 resetPassword，未見一次性 token 驗證 | 必須確認帳號所有權，使用有時效且一次性的驗證流程；不沿用快速設定密碼通道 |
| 授權缺口 | `src/main/java/com/xk/common/base/BaseController.java` 主做選單／Session；本次未發現全域授權攔截設定 | 每個讀寫 API 驗證登入、操作權限、組織範圍與資源所有權；不能只隱藏按鈕 |
| GET 寫入 | `src/main/java/com/xk/cms/controller/web/CmsDistrictController.java` 的 GET delete 路由 | 寫入改為有適當認證及 CSRF 防護的操作；重複操作需有明確結果 |
| 憑證管理 | `application*.yml`、地圖模板及地理編碼工具含整合設定，部分值直接放在來源 | 不複製值；另確認憑證是否有效與是否需輪替。瀏覽器地圖 key 應限網域與 API，伺服器 key 分離管理 |
| 任意外連 | `src/main/java/com/xk/ui/controller/rest/RedirectController.java` 只查 HTTP(S) 前綴 | 定義允許的連結用途、目的站限制或外連確認，避免誤信任本站跳轉 |
| 功能完成度 | Session Controller、部分 UPMS 方法為 null；備份／範例模板很多 | 只保留確認的產品流程，每一功能需獨立驗收 |

上述不是完整安全稽核。部署層可能另有保護，但本次沒有該證據，不能以假設取代新版契約。

## 資料遷移條件

1. 取得合法且最小範圍的資料來源，確認哪些欄位可公開及保留多久；規格、範例與測試用虛構資料。
2. 整理 UPMS 組織、CMS 地區、團及社員的對照，檢查孤兒關聯、重複代碼、重複帳號及停用狀態。
3. 將 district_id、rotaract_id 等字串對應到新版識別；不得直接按字面假設相同 id。
4. 明確解析 industries、latlng、日期／時間與 clubInfo key/value；格式異常進待處理清單，不能靜默丟棄。
5. 團徽 blob 與 avatarUrl 分別盤點可用性、大小、格式及授權，規劃新儲存及缺圖回退。
6. CmsCompanyPay 先確認業務語意，再依人工繳費確認／企業日期紀錄用途遷移；人工確認 UI 不等同實際資金支付成功，不得推生成金流驗證結果。locked 及 payDate 語意需使用者決定。
7. 先做離線演練，驗證筆數、必要欄位、關聯與抽樣流程，定義切換／回復程序；本次未讀取或移轉正式資料。

## 新舊 repo 差異

| 項目 | 舊 `xkRotaract` | 新 `codex-xk-rotaract` 現況 |
| --- | --- | --- |
| 應用 | Java MVC、Thymeleaf、REST 混合單體 | `frontend/`／`backend/` 只有文件 |
| 技術 | pom.xml 已宣告 Java／Spring／MySQL | 尚待選型，不能視為已選 Spring 或其他框架 |
| 資料 | Entity、Repository、Mapper 已有 | 尚無正式 schema／migration |
| 權限 | Session、角色權限、組織資料 | 尚未有身份驗證或授權實作 |
| 驗證 | 有 test 依賴；本次未發現 src/test 測試來源 | 尚無自動測試或 CI；只可做文件檢查 |
| 協作 | 單一來源工程 | 根目錄 AGENTS.md、docs/TEAM.md 定義代理分工與審查 |
| 部署 | WAR 與多環境設定 | 尚無執行、部署或啟動命令 |

新版 `README.md` 與 `docs/architecture.md` 的前後端獨立建置／部署是設計目標，尚未驗證。保留舊 repo 作參考，不把舊碼、設定或資料直接拷入新骨架。

## 必須在開發前討論

- 第一個可交付流程是公開行事曆、團資訊，或企業地圖？建議先以登入／組織授權打底，再選一條公開查詢與管理寫入流程。
- 地區、團、社員的真實管理責任與資料可見性；是否保留共用團／地區帳號？
- 企業申請紀錄真正業務語意，以及行事曆是否只發布資訊；報名、金流等新增需求需另議。
- 是否遷移舊資料、合法來源、個資公開範圍與切換時間。
- 技術、部署、地圖預算與外部服務配置待規格穩定後決策。
