# 2027 新版規格索引 v1.0

更新：2026-10-15。2027為文件分類，不代表已確定上線日期。

使用者已授權依合理性原則補齊剩餘規格，後續以需求變更調整。規格基準完成，已交付第一版前端合成資料雛形與正式 OpenAPI 契約；前端已部署 GitHub Pages；後端部署、試轉及正式整合驗收尚未完成。

## 優先閱讀

1. [需求基準 v1.0](13-requirements-baseline.md)：B01～B13涵蓋剩餘決策與各階段預設。
2. [角色與欄位矩陣](14-role-matrix.md)：誰可做什麼、能看哪些資料。
3. [第一階段開發契約清單](15-phase1-contract.md)：資料字典、端點及驗收範圍，已轉寫正式 OpenAPI，見[API說明](../api/README.md)。
4. [階段與To-do](11-development-phases.md)：已完成規格與尚未完成交付分開。
5. [本次雛形交付](17-prototype-delivery.md)：範圍、啟動、測試與限制。
6. [歷次討論快照](16-decision-history.md)：舊版階段清單，僅作追溯。

## UI／UX 與畫面驗證

- [UI／UX 畫面與互動規格](21-ui-ux-spec.md)：公開站與工作區、路由、角色、流程、樣式、RWD及待辦。
- [UI／UX 檢查與修正紀錄](22-ui-ux-qa.md)：可重現 bug、修正與驗證證據。

## 模組來源與歷次討論

以下保留舊碼證據、案例與討論脈絡，與現行基準不同時，以13及14為準。

| 模組 | 文件 |
| --- | --- |
| 產品範圍 | [00](00-product-scope.md) |
| 帳號與權限 | [01](01-identity-and-access.md) |
| 地區與社團 | [02](02-districts-and-clubs.md) |
| 會員 | [03](03-members-and-profile.md) |
| 活動 | [04](04-events-and-calendar.md) |
| 公司 | [05](05-companies-and-directory.md) |
| 地圖 | [06](06-business-map.md) |
| 付款／曝光 | [07](07-payment-records.md) |
| 公開站 | [08](08-public-site.md) |
| 資料／API | [09](09-data-and-api.md) |
| 品質／移轉 | [10](10-quality-and-migration.md) |
| 社籍／歷史 | [12](12-membership-and-history.md) |

舊版分析：[2024](../2024/README.md)。固定來源提交0c2aad93e1127b5e99b9e65bbd3adb7f3d7b2788，只做靜態檢視，不代表驗證正式站或資料庫。
