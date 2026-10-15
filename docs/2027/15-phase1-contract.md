# 第一階段開發契約清單 v1.0

本文件為欄位、端點與驗收責任的設計清單。現已轉寫[正式 OpenAPI 3.1](../api/openapi.json)，包含補充讀取及復原操作，驗證方式見[API 說明](../api/README.md)。契約靜態驗證不代表後端已實作或授權執行通過。

## 資料字典

所有 id 使用 UUID 字串；createdAt／updatedAt／executedAt 為 RFC3339 UTC，業務日期 YYYY-MM-DD，以 Asia/Taipei 判斷。version 是非負整數，更新必填；必填欄位不可 null。非必填字串空白轉 null（密碼除外），未知歷史日期可 null 並附 datePrecision。每個欄位由輸入白名單決定，拒絕額外管理欄位。

| 實體 | 主要欄位與限制 | 可寫者 |
| --- | --- | --- |
| Account | id、accountCode(6～20)、codeChangeCount(0/1)、email(<=254，必填唯一)、phone(E.164，選填唯一)、status(active/disabled)、passwordHash(永不輸出)、version | 本人受控動作／支援案件 |
| Member | id、accountId(移轉前可空且唯一)、name(1～100)、callName(1～100，可重複)、avatarAssetId(可空)、phoneVisible(false)、emailVisible(true) | 本人；accountId 不走本人 PATCH |
| District | id、code(2～32，唯一)、name(1～100)、status | 地區／平台權限管理案件 |
| Club | id、clubTypeCode、districtId、name(1～100)、logoAssetId、description(<=5000)、contactEmail(<=254)、website／socialLinks(每項 URL<=2048，最多10)、contactVisibility、status | 按 B04 與矩陣 |
| Membership | id、memberId、clubId、typeCode、status、startsOn、endsOn、endReason、name／club／districtSnapshot、version | 核准／轉社／結束受控操作 |
| MembershipYear | membershipId、yearStart(7/1)、confirmationStatus、confirmedBy、confirmedAt | 授權管理者／年度排程 |
| JoinApplication | id、memberId、clubId、typeCode、message(<=2000)、status、reason(拒絕時1～1000)、requestedAt、expiresAt、version | 本人送出／撤回，管理者審核 |
| Transfer | id、memberId、fromMembershipId、toClubId、status、fromApproval／toApproval、expiresAt、version | 三段式操作，各核准綁授權與版本 |
| RoleGrant | id、accountId、role、scopeType／scopeId、startsAt、endsAt、grantedBy、reason、version | 按矩陣，不接受一般個資 PATCH |
| PublicationRequest | id、membershipId、subjectMemberId、contentVersion、visibilityVersion、status、expiresAt、decidedAt | moderate 提請求、本人決定 |
| AuditEvent | id、actorAccountId、action、targetType／id、recordedAt、reason、requestId、受控差異 | 伺服器追加，前端不可任意建改 |
| SupportCase | id、subjectAccountId、type、status、evidenceRefs、handledBy、decisionReason | 申請人與支援按案件範圍 |

密碼與限流、一次性憑證、日期規則、備查保留與 UI 狀態由需求基準 B02／B05／B07 規定。公開與管理輸出採不同 DTO，不因某欄存在於資料字典即一律回傳。

## 端點與授權

前綴 `/api/v1`；JSON、CSRF、Session、version、Idempotency-Key 按 B09。列表回 items/page/pageSize/total，page 從1、預設20上限100；未知／未授權資源一致404，未登入401、動作不足403，版本／唯一／狀態衝突409。

| 方法與路徑 | 輸入／輸出契約要點 | 授權與主要錯誤 |
| --- | --- | --- |
| POST /accounts | name,callName,email,password,phone?；201 accountId,accountCode | 匿名，400欄位、409識別不可用、429 |
| POST /sessions | identifier,password,totp?；200 me投影，設Cookie | 匿名，401統一登入失敗、429 |
| DELETE /sessions/current | 無；204撤Session | 本人 |
| POST /password-recovery-requests | email；202統一結果 | 匿名限流，非帳號存在證據 |
| POST /password-resets | token,newPassword；204 | token持有者，400無效／過期，禁止重放 |
| GET /me | 本人資料、角色、目前範圍、代號剩餘修改次數 | 登入 |
| PATCH /me/profile | version,name?,callName?,avatarAssetId?；200新版投影 | 本人，不接受role/email/phone/accountId |
| PATCH /me/privacy | version,phoneVisible?,emailVisible?；200 | 本人 |
| POST /me/contact-changes | version,currentPassword,kind(email/phone),newValue；200 | 本人，單項，401密碼錯、409重複 |
| POST /me/account-code-changes | version,currentPassword,newCode；200 | 本人一次，409已用／保留／次數用完 |
| GET /members | keyword?,districtId?,clubId?,typeCode?,includeNonRegular?；分頁 | 登入、隱私欄位搜尋與scope |
| GET /members/{id} | 可見基本資料投影；聯絡依隱私 | 登入、有被查資格或本人／授權管理 |
| GET /members/{id}/memberships | 僅可見社籍列表 | 本人／scope／公開歷史投影 |
| POST /join-applications | clubId,message；201 pending | 本人，409有效社籍／同類待審 |
| GET /join-applications | scope,clubId?,status?；分頁 | 本人或該社審核者 |
| POST /join-applications/{id}/approve | version,startsOn；200社籍投影 | 該社審核者，交易查上限 |
| POST /join-applications/{id}/reject | version,reason；200 | 該社審核者 |
| POST /join-applications/{id}/withdraw | version；200 | 申請本人、pending |
| POST /membership-transfers | fromMembershipId,toClubId,reason；201 | 本人有效社籍 |
| GET /membership-transfers | 本人／社團一側投影；分頁 | 本人或對應審核者，不漏對方私有資料 |
| POST /membership-transfers/{id}/approve | version,side；200 | 對應side有效社團審核者 |
| POST /membership-transfers/{id}/reject | version,reason；200 | 原或目標審核者 |
| POST /membership-transfers/{id}/withdraw | version；200 | 本人未完成 |
| POST /membership-transfers/{id}/execute | version；200新舊社籍 | 本人、雙方已核准、再驗資格、冪等交易 |
| POST /membership-end-requests | membershipId,reason(resigned/ob),endsOn；201 | 本人提出，由社團核准 |
| POST /membership-end-requests/{id}/approve | version；200 | 該社管理者 |
| POST /memberships/{id}/end | version,endsOn,endReason,reason；200 | 該社管理者直接辦理，記理由 |
| POST /clubs/{id}/annual-confirmations | yearStart,membershipId,version,status；200 | 該社管理者，逐筆原子、補確認即生效 |
| GET/PATCH /clubs/{id} | 按角色投影／白名單更新、version | scope；名稱與社徽細分授權 |
| POST /clubs | 必填欄位；201 | 轄內地區管理者，拒絕跨區建立 |
| POST /clubs/{id}/disable 或 /restore | version,reason；200 | 轄內地區管理者，交易失效待審案件 |
| POST /club-move-requests | clubId,targetDistrictId,reason；201 | 來源地區，雙地區另各核准後執行 |
| GET/POST /role-grants | 範圍／授權資料；分頁／201 | 按矩陣，拒絕自升權及越範圍 |
| POST /role-grants/{id}/revoke | version,reason；200 | 授權管理者，立即撤權 |
| PATCH /memberships/{id}/experience-visibility | version,visibility；200 | 本人；moderate僅hidden |
| POST /memberships/{id}/publication-requests | contentVersion,visibilityVersion；201 | scope moderate，去重與冷卻 |
| GET /me/publication-requests | 本人待辦分頁 | 本人 |
| POST /publication-requests/{id}/decision | version,decision；200 | 本人，核准與公開同交易 |
| POST /admin/memberships/{id}/visibility-overrides | version,visibility,reason,currentPassword；200 | 有效特定admin＋MFA Session |
| GET /me/audit-events | 本人可見事件分頁 | 本人，不能看到他人證據 |
| GET /audit-events | scope,filter；受控分頁 | 對應稽核權，不開通用跨平台讀取 |
| POST /assets | multipart image；201 assetId | 已登入、檔案規則與ownership |
| POST/GET /support-cases | 類型、說明／案件投影 | 本人／被派支援者 |
| POST /support-cases/{id}/resolve | version,decision,evidenceRefs,reason；200 | 支援、證據與紀錄條件 |

上述欄位型別與限制轉寫正式 OpenAPI 時，必須為每個輸入補 additionalProperties:false、required、enum、nullable、response DTO、錯誤範例及資料範圍。此轉寫現已完成並通過靜態檢查；後端與資料庫仍須實作並執行驗收。

## 驗收追蹤

| 編號 | 必要場景 | 完成證據 |
| --- | --- | --- |
| P1-AUTH | 註冊欄位、識別唯一、代號僅改一次、舊代號不可重用、密碼／限流／重設30分鐘重放 | API及資料庫整合測試 |
| P1-SCOPE | 跨社／跨區列表、詳情、直接ID、附件、匯出與撤權；不靠選單 | 獨立權限案例 |
| P1-JOIN | pending上限、核准回溯日期、拒絕重送／撤回／停用／逾期競爭 | PostgreSQL交易測試 |
| P1-TRANSFER | 雙社核准不生效、本人execute才生效、失效重審、失敗回復與競爭 | E2E＋交易測試 |
| P1-YEAR | 6/30、7/1、7/31、8/1、補確認、授權到期，paid不受影響 | 可控時鐘邊界測試 |
| P1-HISTORY | 本人逐筆同意、管理者不能代同意、pending不公開、內容更改重新同意、override稽核 | E2E＋API投影測試 |
| P1-UI | 360px、鍵盤、錯誤保留、409不覆寫、空與載入狀態 | 可點擊雛形及瀏覽器驗收 |
| P1-OPS | 啟動文件、CI、mail失敗有限重試、無敏感日誌、備份還原 | 實際命令與演練紀錄 |

以上皆為未執行的驗收清單；文件完成不替代獨立驗收。
