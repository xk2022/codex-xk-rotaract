# 全部後端 API 操作索引

基準：前端與既有後端取自 `bd335822f3ea8d538d12b90459e986e76fc6cca0`。日期：2026-10-15。

所有路徑前綴為 `/api/v1`；共 141 個操作，包含公開、管理、本人與安全輔助操作及 4 個商家相容路徑。`GET /api/v1/openapi` 另外提供本契約本身，不遞迴列入契約。

這是實作與路由覆蓋索引；各端點仍受登入、角色、範圍、版本與必要前提約束。111 項整合測試包含各模組流程及實際 Spring 路由覆蓋，不表示每一輸入組合皆已驗證。

| 模組 Controller | 操作數 |
| --- | --- |
| ApiCatalogController.java | 1 |
| ApiController.java | 17 |
| BusinessController.java | 30 |
| BusinessReportController.java | 5 |
| CouponController.java | 14 |
| EventController.java | 13 |
| MembershipController.java | 20 |
| MfaController.java | 4 |
| OrganizationController.java | 14 |
| PublicAssetController.java | 1 |
| SupportController.java | 21 |
| TaskController.java | 1 |

## 逐項操作

| 方法 | 路徑 | 操作 | 實作 |
| --- | --- | --- | --- |
| GET | `/health` | 確認服務與資料庫可用 | ApiCatalogController.java |
| POST | `/accounts` | 註冊會員 | ApiController.java |
| GET | `/clubs` | 入社申請社團選單 | ApiController.java |
| GET | `/csrf-token` | 取得匿名或登入工作階段 CSRF token | ApiController.java |
| GET | `/join-applications` | 入社申請列表 | ApiController.java |
| POST | `/join-applications` | 申請入社 | ApiController.java |
| POST | `/join-applications/{id}/approve` | 核准入社 | ApiController.java |
| POST | `/join-applications/{id}/reject` | 拒絕入社 | ApiController.java |
| POST | `/join-applications/{id}/withdraw` | 撤回入社申請 | ApiController.java |
| GET | `/me` | 取得本人資料 | ApiController.java |
| POST | `/me/account-code-changes` | 變更帳號代號一次 | ApiController.java |
| POST | `/me/contact-changes` | 單項變更聯絡資料 | ApiController.java |
| PATCH | `/me/privacy` | 修改聯絡隱私 | ApiController.java |
| PATCH | `/me/profile` | 修改本人資料 | ApiController.java |
| GET | `/members` | 查詢會員名冊 | ApiController.java |
| GET | `/members/{id}` | 查詢會員詳情 | ApiController.java |
| POST | `/sessions` | 登入 | ApiController.java |
| DELETE | `/sessions/current` | 登出 | ApiController.java |
| GET | `/business-review/companies` | listBusinessContentReview | BusinessController.java |
| GET | `/business-review/companies/{id}` | businessContentReviewDetail | BusinessController.java |
| GET | `/business-review/companies/{id}/exposure-grants` | reviewBusinessExposureGrants | BusinessController.java |
| POST | `/business-review/companies/{id}/reject` | rejectBusiness | BusinessController.java |
| POST | `/business-review/companies/{id}/suspend` | suspendBusiness | BusinessController.java |
| GET | `/companies` | listManagedBusinesses | BusinessController.java |
| POST | `/companies` | createBusiness | BusinessController.java |
| GET | `/companies/{id}` | managedBusinessDetail | BusinessController.java |
| PATCH | `/companies/{id}` | updateBusiness | BusinessController.java |
| POST | `/companies/{id}/confirmations` | confirmBusinessExists | BusinessController.java |
| POST | `/companies/{id}/confirmations/withdraw` | withdrawBusinessConfirmation | BusinessController.java |
| GET | `/companies/{id}/exposure-grants` | businessExposureGrants | BusinessController.java |
| GET | `/companies/{id}/links` | listBusinessLinks | BusinessController.java |
| POST | `/companies/{id}/links` | inviteBusinessMember | BusinessController.java |
| POST | `/companies/{id}/links/{linkId}/remove` | removeBusinessLink | BusinessController.java |
| POST | `/companies/{id}/publish` | publishBusiness | BusinessController.java |
| POST | `/company-invitations/{id}/accept` | acceptBusinessInvitation | BusinessController.java |
| POST | `/company-invitations/{id}/cancel` | cancelBusinessInvitation | BusinessController.java |
| POST | `/company-invitations/{id}/reject` | rejectBusinessInvitation | BusinessController.java |
| POST | `/company-invitations/{id}/revoke` | revokeBusinessInvitation | BusinessController.java |
| GET | `/industries` | businessIndustries | BusinessController.java |
| GET | `/me/business-confirmations` | myBusinessConfirmations | BusinessController.java |
| GET | `/me/company-invitations` | myBusinessInvitations | BusinessController.java |
| GET | `/public/business-map` | listPublicBusinessMapAlias | BusinessController.java |
| GET | `/public/businesses` | listPublicBusinessesAlias | BusinessController.java |
| GET | `/public/businesses/{id}` | publicBusinessDetailAlias | BusinessController.java |
| GET | `/public/companies` | listPublicBusinesses | BusinessController.java |
| GET | `/public/companies/{id}` | publicBusinessDetail | BusinessController.java |
| GET | `/public/industries` | businessIndustriesPublic | BusinessController.java |
| GET | `/public/map/companies` | listPublicBusinessMap | BusinessController.java |
| GET | `/business-reports` | 本人回報或內容管理案件列表 | BusinessReportController.java |
| POST | `/business-reports` | 建立商家資料問題回報 | BusinessReportController.java |
| GET | `/business-reports/{id}` | 商家回報案件詳情 | BusinessReportController.java |
| POST | `/business-reports/{id}/accept` | 接案處理商家回報 | BusinessReportController.java |
| POST | `/business-reports/{id}/close` | 結案商家回報 | BusinessReportController.java |
| POST | `/companies/{companyId}/coupon-redemptions/confirm` | 商家owner確認一次性核銷 | CouponController.java |
| POST | `/companies/{companyId}/coupon-redemptions/lookup` | 商家owner檢查會員出示的完整碼 | CouponController.java |
| GET | `/coupon-offers` | 會員可領優惠／商家優惠管理清單 | CouponController.java |
| POST | `/coupon-offers` | 公司owner建立優惠草稿 | CouponController.java |
| GET | `/coupon-offers/{id}` | 取得可領或可管理的優惠詳情 | CouponController.java |
| PATCH | `/coupon-offers/{id}` | 公司owner更新優惠並退回草稿 | CouponController.java |
| POST | `/coupon-offers/{id}/approve` | 核准會員優惠 | CouponController.java |
| POST | `/coupon-offers/{id}/claim` | 當年度正常會員領取一次性優惠碼 | CouponController.java |
| POST | `/coupon-offers/{id}/reject` | 退回會員優惠 | CouponController.java |
| POST | `/coupon-offers/{id}/submit` | 送審會員優惠 | CouponController.java |
| POST | `/coupon-offers/{id}/suspend` | 暫停會員優惠 | CouponController.java |
| GET | `/me/coupons` | 本人優惠錢包與狀態篩選 | CouponController.java |
| GET | `/me/coupons/{id}` | 本人優惠碼及領取快照 | CouponController.java |
| POST | `/me/coupons/{id}/void` | 本人附理由作廢優惠 | CouponController.java |
| GET | `/events` | listCommunityEvents | EventController.java |
| POST | `/events` | createCommunityEvent | EventController.java |
| GET | `/events/{id}` | getCommunityEvent | EventController.java |
| PATCH | `/events/{id}` | updateCommunityEvent | EventController.java |
| POST | `/events/{id}/archive` | archiveCommunityEvent | EventController.java |
| POST | `/events/{id}/cancel` | cancelCommunityEvent | EventController.java |
| POST | `/events/{id}/copy` | copyCommunityEvent | EventController.java |
| POST | `/events/{id}/publish` | publishCommunityEvent | EventController.java |
| GET | `/public/calendar` | getPublicCalendar | EventController.java |
| GET | `/public/clubs` | listCommunityPublicClubs | EventController.java |
| GET | `/public/clubs/{id}` | getCommunityPublicClub | EventController.java |
| GET | `/public/events` | listPublicEvents | EventController.java |
| GET | `/public/events/{id}` | getPublicEvent | EventController.java |
| POST | `/admin/memberships/{id}/visibility-overrides` | 特定 admin 例外公開 | MembershipController.java |
| GET | `/audit-events` | 範圍內稽核紀錄 | MembershipController.java |
| GET | `/clubs/{id}/annual-confirmations` | 讀取社團年度名冊及版本 | MembershipController.java |
| POST | `/clubs/{id}/annual-confirmations` | 年度社員確認 | MembershipController.java |
| GET | `/me/audit-events` | 本人異動紀錄 | MembershipController.java |
| GET | `/me/publication-requests` | 本人公開同意待辦 | MembershipController.java |
| GET | `/members/{id}/memberships` | 取得可見社籍與經歷 | MembershipController.java |
| GET | `/membership-end-requests` | 退社與 OB 申請待辦 | MembershipController.java |
| POST | `/membership-end-requests` | 本人申請退社或 OB | MembershipController.java |
| POST | `/membership-end-requests/{id}/approve` | 核准退社或 OB | MembershipController.java |
| GET | `/membership-transfers` | 轉社待辦 | MembershipController.java |
| POST | `/membership-transfers` | 本人申請轉社 | MembershipController.java |
| POST | `/membership-transfers/{id}/approve` | 核准轉社單一側 | MembershipController.java |
| POST | `/membership-transfers/{id}/execute` | 本人最終確認執行轉社 | MembershipController.java |
| POST | `/membership-transfers/{id}/reject` | 拒絕轉社 | MembershipController.java |
| POST | `/membership-transfers/{id}/withdraw` | 本人撤回轉社 | MembershipController.java |
| POST | `/memberships/{id}/end` | 管理者直接結束社籍 | MembershipController.java |
| PATCH | `/memberships/{id}/experience-visibility` | 修改歷史公開狀態 | MembershipController.java |
| POST | `/memberships/{id}/publication-requests` | 請求本人公開歷史 | MembershipController.java |
| POST | `/publication-requests/{id}/decision` | 本人同意或拒絕公開 | MembershipController.java |
| GET | `/me/mfa` | 取得本人 MFA 設定與當次驗證狀態 | MfaController.java |
| POST | `/me/mfa/enrollments` | 目前密碼確認後建立十分鐘 TOTP 設定 | MfaController.java |
| POST | `/me/mfa/enrollments/confirm` | 本人以一次性驗證碼完成 MFA 設定 | MfaController.java |
| POST | `/sessions/current/mfa-verifications` | 驗證目前工作階段的 TOTP，特權有效十五分鐘 | MfaController.java |
| GET | `/club-move-requests` | 跨地區移轉待辦 | OrganizationController.java |
| POST | `/club-move-requests` | 提出跨地區移轉 | OrganizationController.java |
| POST | `/club-move-requests/{id}/approve` | 核准跨區移轉單一側 | OrganizationController.java |
| POST | `/club-move-requests/{id}/execute` | 執行已雙方核准的跨區移轉 | OrganizationController.java |
| POST | `/clubs` | 建立社團 | OrganizationController.java |
| GET | `/clubs/{id}` | 社團公開或管理資料 | OrganizationController.java |
| PATCH | `/clubs/{id}` | 修改社團資料 | OrganizationController.java |
| POST | `/clubs/{id}/disable` | 停用社團 | OrganizationController.java |
| POST | `/clubs/{id}/restore` | 恢復社團 | OrganizationController.java |
| GET | `/districts` | 地區選單 | OrganizationController.java |
| GET | `/organization-overview` | 組織管理總覽 | OrganizationController.java |
| GET | `/role-grants` | 查詢授權 | OrganizationController.java |
| POST | `/role-grants` | 授予角色與任期 | OrganizationController.java |
| POST | `/role-grants/{id}/revoke` | 撤銷授權 | OrganizationController.java |
| GET | `/public/assets/{id}/content` | 讀取目前仍公開且已清理的社團圖像 | PublicAssetController.java |
| POST | `/assets` | 上傳圖片或案件證據 | SupportController.java |
| GET | `/assets/{id}` | getPrivateAssetMetadata | SupportController.java |
| GET | `/assets/{id}/content` | downloadPrivateAsset | SupportController.java |
| POST | `/password-recovery-requests` | 申請密碼復原 | SupportController.java |
| POST | `/password-resets` | 重設密碼 | SupportController.java |
| GET | `/support-cases` | 支援案件列表 | SupportController.java |
| POST | `/support-cases` | 建立支援案件 | SupportController.java |
| GET | `/support-cases/{id}` | getSupportCase | SupportController.java |
| POST | `/support-cases/{id}/assignments` | assignSupportCase | SupportController.java |
| POST | `/support-cases/{id}/evidence` | uploadSupportCaseEvidence | SupportController.java |
| POST | `/support-cases/{id}/legacy-confirmations` | confirmLegacyClaimAssociation | SupportController.java |
| POST | `/support-cases/{id}/recovery-email-requests` | 重新安排已核准案件的新信箱確認信 | SupportController.java |
| POST | `/support-cases/{id}/resolve` | 處理支援案件 | SupportController.java |
| GET | `/support-cases/{id}/supplements` | listSupportCaseSupplements | SupportController.java |
| POST | `/support-cases/{id}/supplements` | supplementOwnSupportCase | SupportController.java |
| POST | `/support-cases/{id}/verifications` | verifySupportCaseIdentity | SupportController.java |
| POST | `/support-recovery-cases` | 未登入申請人工復原 | SupportController.java |
| GET | `/support-recovery-cases/{id}` | 以案件收據查詢復原進度 | SupportController.java |
| POST | `/support-recovery-cases/{id}/evidence` | 補交復原案件證據 | SupportController.java |
| POST | `/support-recovery-cases/{id}/supplements` | supplementAnonymousRecoveryCase | SupportController.java |
| POST | `/support-recovery-email-confirmations` | 確認人工復原的新信箱持有權 | SupportController.java |
| GET | `/me/tasks` | 依明確選擇的身分範圍彙整即時待辦與曝光提醒 | TaskController.java |

請求、回應、錯誤與合成範例以 [OpenAPI](openapi.json) 為準；畫面對應與驗證範圍見 [本輪交付](../2027/42-backend-api-delivery.md)。
