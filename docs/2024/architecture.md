# 架構、資料與權限分析

來源：[提交 0c2aad93](https://github.com/xk2022/xkRotaract/tree/0c2aad93e1127b5e99b9e65bbd3adb7f3d7b2788)。以下來源路徑均以該提交為準；資料表名稱與關聯來自 Entity／Mapper，未對正式資料庫驗證。

## 舊系統架構

`pom.xml` 宣告 Spring Boot **2.7.18**、WAR 封裝、Java target **1.8**，並有需 Java 17 的註解；註解和編譯目標不同，實際 JDK 與容器相容性需另驗證。Tomcat 使用 provided scope，主要部署意圖為外部 Servlet 容器。

| 層 | 組件／來源 | 說明 |
| --- | --- | --- |
| Web | Spring MVC、`src/main/resources/templates/` | Thymeleaf 伺服器渲染，另含 REST API 與前端 JavaScript；不是前後端獨立產品 |
| 業務 | `src/main/java/com/xk/{cms,upms,admin,ui}/service/` | 社員／團／企業／活動、平台權限與公開網站 |
| 存取 | 各模組 `dao/repository/`、`dao/mapper/` | Spring Data JPA 與 MyBatis XML 並用，須對照兩種查詢的條件和關聯 |
| 資料庫 | `pom.xml`、`src/main/resources/application*.yml` | MySQL connector 8.0.33、Druid；profile 設定存在，文件不重刊連線資訊 |
| API 文件 | `src/main/java/com/xk/config/swagger/SwaggerConfig.java` | Springfox 3.0.0，存在設定；未啟動確認 Swagger 可用 |
| 稽核 | `common/base/BaseEntity.java`、`config/AuditorAwareImpl.java`（前綴 `src/main/java/com/xk/`） | 建立／修改者及時間欄位；不是不可竄改的完整稽核機制 |

## 核心資料模型

來源前綴：`src/main/java/com/xk/cms/model/po/`。

| 模型／表 | 主要結構 | 關聯與注意 |
| --- | --- | --- |
| `CmsDistrict`／`cms_district` | code、name、status | 與 UPMS 組織並存，不能假設兩者一對一或同步 |
| `CmsClub`／`cms_club` | fkUpmsOrganizationId、name、clubLogo、status | 團綁定 UPMS 組織，團徽為 byte[] |
| `CmsClubInfo`／`cms_club_info` | clubId、infoKey、infoValue、status | 團資訊 key/value；需把正式 key 與值格式轉成可驗證契約 |
| `CmsUser`／`cms_user` | fkUpmsUserId、稱呼／姓名、district_id、rotaract_id、avatarUrl、phoneNumber、gender | 登入帳號與社員分離；地區／團欄位是字串，不可直接當新版外鍵 |
| `CmsCompany`／`cms_company` | name、phone、address、url、industries、latlng | 產業與座標以字串儲存，應規劃解析及失敗處理 |
| `CmsUserCompany`／`cms_user_company` | fkCmsUserId、fkCmsCompanyId | 社員與企業關聯表；實際唯一性和刪除規則需驗證 |
| `CmsCompanyPay`／`cms_company_pay` | fkCmsCompanyId、payDate、locked | 名稱含 Pay，實際欄位沒有金額、付款狀態或支付識別碼 |
| `CmsCalendar`／`cms_calendar` | 活動資訊、allDay、startDate/startTime、endDate/endTime、type、district_id、rotaract_id、locked | 日期和時間分開；時區、跨日及 locked 業務語意需確認 |

UPMS 模型來源為 `src/main/java/com/xk/upms/model/po/`：`UpmsUser`、`UpmsRole`、`UpmsUserRole`、`UpmsPermission`、`UpmsRolePermission`、`UpmsOrganization`、`UpmsOrganizationUser`（Repository 命名；Entity 為 `UpmsUserOrganization`）、`UpmsSystem`、字典及日誌。其資料結構支持帳號／角色／权限與階層組織，但不證明跨組織隔離可靠。

## 身分與權限

`src/main/java/com/xk/admin/service/impl/AuthServiceImpl.java` 依帳號／Email／手機查使用者，再以 username 與傳入 password 比對；註解指向前端 MD5。登入 Controller 將 `UserExample` 放入 HttpSession；不能將前端雜湊當作安全密碼儲存。

`src/main/java/com/xk/upms/model/enums/PermissionAction.java` 定義 `READ`、`WRITE`、`CREATE`。`AuthServiceImpl.userPermissions()` 依使用者角色取得有效 READ 權限；`src/main/java/com/xk/common/base/BaseController.java` 產生左側選單及 Session 的 permissionAction。

本次未在 Java 來源發現全域 Spring Security、Filter 或 Interceptor 授權設定；存在頁面與 Session 權限資料不能證明每個 API 的動作及資料範圍都有伺服器端檢查。地區、團與本人限制需逐端點建立授權矩陣並測試。

## 外部整合

- Google Maps JavaScript：`src/main/resources/templates/bizmap/index.html`。
- Google Geocoding：`src/main/java/com/xk/common/util/GoogleApiGeocode.java`，對 `maps.googleapis.com` 呼叫。
- 產業／地區分類：`src/main/java/com/xk/common/json/` 及 `src/main/resources/static/js/locations.json`；屬來源資產，並非已驗證的即時資料服務。
- 模板及靜態 JS 包含 UI／行事曆資產；授權、實際載入版本及瀏覽器相容性需另確認。
- 未見可信的郵件寄送、通知、支付商或第三方身份驗證完整整合證據；勿由頁面名稱或依賴推定存在。
