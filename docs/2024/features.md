# 功能盤點

來源固定為 [0c2aad93](https://github.com/xk2022/xkRotaract/tree/0c2aad93e1127b5e99b9e65bbd3adb7f3d7b2788)，以下路徑相對於來源根目錄。全部為靜態檢視，實際執行結果未驗證。

## 公開網站

| 功能 | 證據 | 可確認範圍與限制 |
| --- | --- | --- |
| 首頁 | `src/main/java/com/xk/ui/controller/web/IndexController.java`、`src/main/resources/templates/index/index.html` | `/` 返回首頁模板；不是全站功能驗收證據 |
| 企業地圖 | `ui/controller/web/IndexMapController.java`、`ui/controller/rest/IndexRestController.java`（均位於 `src/main/java/com/xk/`）、`src/main/resources/templates/bizmap/index.html` | `/BizMap`、企業定位與泡泡資料 API，具有產業分類及地圖頁；地圖金鑰、地理編碼結果與公開資料範圍未驗證 |
| 公開行事曆 | `src/main/java/com/xk/ui/controller/web/IndexCalendarController.java`、`src/main/resources/templates/calendar/` | `/Calendar` 及 `/p`、`/r`、`/full` 版本存在；有地區選單。多種模板不表示每個版本都是正式產品 |
| 外連跳轉 | `src/main/java/com/xk/ui/controller/rest/RedirectController.java` | `/redirect` 接收 URL；僅檢查 HTTP(S) 前綴，需另評估允許的目的站 |

## CMS 業務管理

下列 Controller 來源前綴為 `src/main/java/com/xk/cms/controller/`；Service 實作位於 `src/main/java/com/xk/cms/service/impl/`。

| 功能 | 主要來源 | 靜態實作範圍 |
| --- | --- | --- |
| 地區管理 | `web/CmsDistrictController.java`、`CmsDistrictServiceImpl.java` | 清單、儲存、刪除及啟用狀態；刪除採 GET 路由 |
| 扶青團管理 | `web/CmsClubController.java`、`rest/CmsClubRestController.java`、`CmsClubServiceImpl.java` | 團名、組織關聯、團徽及狀態等操作 |
| 團資訊 | `rest/CmsClubInfoRestController.java`、`CmsClubInfoServiceImpl.java` | 團資訊以 key/value 維護，圖片處理存在資料庫儲存 TODO；欄位完整清單與正式用途需確認 |
| 社員管理 | `web/CmsUserController.java`、`CmsUserServiceImpl.java` | 社員、登入帳號關聯，地區／團篩選頁與儲存操作；篩選不代表所有 API 已驗證資料範圍 |
| 個人資料 | `web/CmsSelfController.java`、`CmsSelfServiceImpl.java` | 從 Session 取得社員及關聯企業，提供個人頁；自行修改範圍需檢查每個寫入入口 |
| 企業管理 | `web/CmsCompanyController.java`、`rest/CmsCompanyRestController.java`、`CmsCompanyServiceImpl.java` | 企業名稱、聯絡方式、網址、產業、地址與座標，社員企業關聯 |
| 人工繳費確認／企業日期紀錄（用途待確認） | `web/CmsCompanyPayController.java`、`CmsCompanyPayServiceImpl.java` | `/admin/cms/manage/applyCompany`；新增企業 id、當下日期與 locked=false；`src/main/resources/templates/admin/cms/applyCompany/input.html` 有「覆核公司付款」「確認繳費」，`view.html` 有「付款日期」。人工確認 UI 不等同實際資金支付成功。**沒有證據支持線上收款、訂單、金額或支付商整合** |
| 行事曆管理 | `web/CmsCalendarController.java`、`rest/CmsCalendarRestController.java`、`CmsCalendarServiceImpl.java` | 活動名稱、說明、地點、日期／時間、全天、類型、地區／團及 locked；不是完整報名管理 |
| 組織／地區儀表板 | `web/CmsOrganizationController.java`、`web/CmsDController.java` | 頁面與組織服務關聯存在；統計正確性和可用操作未驗證 |

## 帳號與平台管理

- 登入、登出、註冊、密碼重設頁及處理方法：`src/main/java/com/xk/admin/controller/web/AuthorizationController.java`。`rest/AuthorizationRestController.java` 另提供登入檢查 API；不能將「檢查」等同建立 Session。
- 使用者、角色、權限、組織、系統、字典、日誌等 Controller、Service、Entity 位於 `src/main/java/com/xk/upms/`；存在 CRUD 與角色權限資料結構，部分方法返回 `null`。
- `src/main/java/com/xk/upms/controller/web/UpmsSessionController.java` 返回 `null`，不能列為已完成線上 Session 管理。
- `src/main/java/com/xk/demo/`、備份模板及大量靜態 UI 範例屬示例／候選資產；不自動納入 2027 產品範圍。

## 不可由舊碼直接承諾的功能

本次未發現完整活動報名、名額／候補、簽到、通知佇列、金流、財務對帳、年度交接或匯入演練實作。任何新增功能都需在 2027 規格中標示為提案並另行確認。
