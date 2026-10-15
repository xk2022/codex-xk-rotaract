# 活動與行事曆

> 現行狀態（2026-10-15）：剩餘規格已依使用者授權補齊，請先讀[需求基準 v1.0](13-requirements-baseline.md)、[權限矩陣](14-role-matrix.md)及[現行階段清單](11-development-phases.md)。下方保留來源分析與歷次討論；其中「待確認／提案」及舊狀態僅供追溯，已由現行基準處理。程式與驗收尚未完成。

## 來源與歷次討論（非現行待辦）

狀態：討論稿 v0.1；所有新版行為待確認。[規格索引](README.md)

## 舊版依據與差異

固定來源（僅證明原始碼存在，未驗證執行）：

- [src/main/java/com/xk/cms/model/po/CmsCalendar.java](https://github.com/xk2022/xkRotaract/blob/0c2aad93e1127b5e99b9e65bbd3adb7f3d7b2788/src/main/java/com/xk/cms/model/po/CmsCalendar.java)
- [src/main/java/com/xk/cms/service/impl/CmsCalendarServiceImpl.java](https://github.com/xk2022/xkRotaract/blob/0c2aad93e1127b5e99b9e65bbd3adb7f3d7b2788/src/main/java/com/xk/cms/service/impl/CmsCalendarServiceImpl.java)
- [src/main/java/com/xk/ui/controller/web/IndexCalendarController.java](https://github.com/xk2022/xkRotaract/blob/0c2aad93e1127b5e99b9e65bbd3adb7f3d7b2788/src/main/java/com/xk/ui/controller/web/IndexCalendarController.java)

本文件的狀態、授權、資料結構與驗收是新版提案；不得將其記為舊版已實作。

## 使用者與流程

社團／地區管理者建立授權範圍活動；會員與訪客依可見性閱讀。

新增草稿 → 日期及主辦驗證 → 發布 → 月曆／列表／詳情呈現 → 修改、取消或封存。

## 資料草案

Event：ID、標題、說明、地點、主辦類型與 ID、類型、allDay、startsAt／endsAt 或 startDate／endDateExclusive、timeZone、可見性、發布狀態、version。

共同 ID、版本、分頁、錯誤與公開欄位規則見 [資料與介面](09-data-and-api.md)。所有範例只用合成資料。

## 功能要求

- **EVT-01**：時區預設 Asia/Taipei（待確認）；時間型活動用帶時區語意的時間戳；全天以日期與不含結束日表示。禁止把字串時間與 Date 拼接當成跨時區規則。
- **EVT-02**：結束須晚於開始；跨日及全天格式互斥。7/1～次年 6/30 的扶輪年度與曆年查詢分開定義。
- **EVT-03**：狀態草案：draft → published → cancelled／archived；取消活動保留原因與歷史，不立即刪除。
- **EVT-04**：公開查詢只回傳公開且已發布／公開取消的活動；所有篩選先套可見範圍。主辦社團停用時的活動政策待決。
- **EVT-05**：更新採版本衝突處理；不以 GET 執行刪除或其他狀態變更。活動報名、名額、簽到不在本模組預設範圍。

## 介面候選

GET /events?from=…&to=…&districtId=…&clubId=…；GET /events/{id}；POST /events；PATCH /events/{id}；POST /events/{id}/publish；POST /events/{id}/cancel。

以上為契約討論清單，不是已實作端點；正式 schema、欄位長度、必填與空值處理於規格定稿時補齐。畫面至少具備載入、空資料、欄位錯誤、無權限、服務失敗與衝突處理，錯誤不清除使用者未儲存內容。

## 驗收情境

- **EVT-AC-01**：全天 7/1 活動在月曆只佔 7/1；跨午夜活動顯示正确起迄。
- **EVT-AC-02**：跨年度活動按區間重疊查詢，不因起始日位於前年度就消失。
- **EVT-AC-03**：訪客看不到草稿；社 A 管理者不能發布社 B 活動；取消活動详情與列表狀態一致。
- **EVT-AC-04**：結束早於開始時回應欄位錯誤，不產生半筆資料；過期 version 回應 409。

以上尚未執行；實作後由獨立驗證者依情境驗收。

## 待討論

活動是否需審核？地區活動可由誰發布？取消活動是否保留於公開月曆？是否要加入報名（另寫規格）？

## 瀏覽資格補充（2026-10-15 已確認）

社團行事曆為通用頁面，未登入訪客可瀏覽已公開活動；活動發布與管理權限另依核定角色及範圍處理，不公開私有活動。

## 社團名稱、公開設定與停用（2026-10-15 已確認）

- 社長、秘書及社團管理帳號可修改自己社團名稱與社徽；一般社團管理者不可修改名稱與社徽，原有介紹／聯絡資料維護權不受影響。
- 社團名稱、類型、地區、社徽與簡介預設公開；聯絡 Email、網站／社群連結可逐項勾選是否顯示。聯絡欄位預設勾選狀態另定，不將社團 Email 與會員 Email 的隱私設定混用。
- 停用社團保留社員、社籍及歷史資料，停止新入社申請及新增活動；不因停用刪除會員帳號或覆寫社籍歷史。
- 停用社團不再提供免費地圖曝光資格；會員若另有符合條件的有效社籍，或其商家具有有效付費廣告，則依該資格顯示。停用不能撤銷獨立有效的付費曝光期間。
- 社團停用／恢復的授權者、既有待審申請與已發布活動的處理仍待確認。
