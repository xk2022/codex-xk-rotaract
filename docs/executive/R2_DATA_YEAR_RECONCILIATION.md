# R2 獨立個體接手包：舊資料、身分、付款與年度口徑對帳

日期：2026-11-13。依使用者最新指示，本輪停止實作，改交付獨立個體派工／交接包；不啟動實際移轉或讀取正式資料。工作基準：本 repo `b3b3453`；舊 repo `xk2022/xkRotaract` 的 `0c2aad93e1127b5e99b9e65bbd3adb7f3d7b2788`，本輪依既存分析文件引用，未重新取得舊正式資料庫。這份交付只有設計與來源盤點；未連正式 DB、未匯入、未清理實際人員、未建立 UUID、未執行試轉或金額對帳。

## 主表與證據狀態

狀態只用「待辦／執行中／受阻／完成」。文件完成不表示資料移轉或正式年度驗收完成。

| 工作 | 狀態 | 本輪事實／證據 | 阻礙／下一步 |
| --- | --- | --- | --- |
| R2-MAIN 正式資料移轉與年度／付款對帳 | 受阻 | 只完成接手包與靜態來源草案，沒有實測結果 | 正式來源、schema缺口及執行授權未齊；留待獨立個體接手 |
| R2-DOC 來源字典、口徑與試轉設計 | 完成 | 本文件及兩份 CSV；來源為 repo 文件、migration 與 model 靜態閱讀 | 主代理整合及獨立審查；不代表已對正式資料驗證 |
| R2-SOURCE 正式來源授權與可重複擷取 | 受阻 | 沒有本輪可核驗的來源 manifest、schema 匯出及快照 | 取得下述最小來源資料與資料擁有人核可 |
| R2-CLEAN 重複身分／日期／付款語意核實 | 待辦 | 已定義隔離欄位與禁止自動合併規則 | 有來源後產生去識別化差異清單及具名裁決 |
| R2-TRIAL 分批試轉與年度／金額驗收 | 受阻 | 僅有試轉方案；沒有實際來源筆數、目標筆數或金額 | 來源、目標 schema 缺口、執行授權及隔離演練環境齊備後才開始 |
| R2-CUTOVER 正式切換 | 待辦 | 本輪未執行，未取得正式切換／破壞性操作授權 | 先完成對帳、還原演練與正式切換核准 |

兩份機讀附件：[欄位映射](R2_SOURCE_FIELD_MAPPING.csv)、[對帳登錄](R2_RECONCILIATION_REGISTER.csv)。CSV 字面值 `null` 表示尚無實測值，**不是 0、不適用或已通過**。mapping_id／check_id 是文件追蹤代碼，不是業務 UUID。

## 證據與版本邊界

- [舊資料模型](../2024/architecture.md)、[舊風險與遷移](../2024/risks-and-migration.md)：舊欄位與 Pay 證據；其中「新版只有骨架」是當時觀察，不是 2026-11-13 現況。
- [需求基準 B03～B07、B11～B12](../2027/13-requirements-baseline.md)、[社籍與歷史](../2027/12-membership-and-history.md)、[移轉規格](../2027/10-quality-and-migration.md)：產品方向；歷史文件內「尚待確認／預設為提案」須與較新基準分開，不將舊文字當成已執行。
- [V1](../../backend/src/main/resources/db/migration/V1__core.sql)、[V4](../../backend/src/main/resources/db/migration/V4__account_identifier_changes.sql)、[V5](../../backend/src/main/resources/db/migration/V5__expanded_access_scopes.sql)、[V7](../../backend/src/main/resources/db/migration/V7__membership_workflows.sql)：實際帳號、社員、社籍、任期及年度持久層。
- [V9](../../backend/src/main/resources/db/migration/V9__business.sql)、[V11](../../backend/src/main/resources/db/migration/V11__support_and_recovery.sql)、[V14](../../backend/src/main/resources/db/migration/V14__invitation_history.sql)：企業、曝光、認領 staging 與邀請歷史。staging 存在不代表通用移轉器、財務模型或歷史匯入流程已完成。
- [年度總覽文件](../2027/41-annual-handover-overview.md)、[handoverModel.ts](../../frontend/src/engagement/handoverModel.ts)、[organizationModel.ts](../../frontend/src/features/organizationModel.ts)、[CoreService.java](../../backend/src/main/java/org/xkrotaract/api/CoreService.java)、[ApiSupport.java](../../backend/src/main/java/org/xkrotaract/api/ApiSupport.java)、[MembershipService.java](../../backend/src/main/java/org/xkrotaract/api/MembershipService.java)、[OrganizationService.java](../../backend/src/main/java/org/xkrotaract/api/OrganizationService.java)、[BusinessService.java](../../backend/src/main/java/org/xkrotaract/api/BusinessService.java)：口徑的實際程式證據；本輪未跑程式驗證。

## 永久身分與關聯

1. **Account 是登入與授權身分，Member 是同一自然人的社員主體**，各有永久 UUID；重新入社、年度交接、付款或公司曝光變更都不另造同一人的主體。角色授權不是會員主表欄位；備援社團帳號不得當成自然人。
2. **Membership 是社籍子表，每段經歷一筆**。同一 Member 可同時擁有最多一筆 active ROTARACT 與一筆 active ROTARY；不可用全體社籍唯一限制把其中一筆誤刪。JCI／BNI 只有擴充方向，未核定資格前不得以資料移轉自行啟用。
3. ended／OB（end_reason=ob）與 resigned／transferred 歷史保留；不得改回 active 來補年度，不因舊歷史付款推定仍在社。visibility、年度確認及 status 分開。歷史預設 hidden，舊公開旗標不是新本人同意。
4. **付款不是身分**：同姓名、同電話、同 Email、同公司付款人或同舊整數 ID 都只能產生候選衝突，不足以合併 accountId/memberId。更不能拿 Pay id 當 Member UUID。
5. 來源鍵建議使用 `(source_system, source_entity, source_record_id)`，另附來源快照 hash、映射決策、決策者與時間。映射台帳是本輪設計，不聲稱有通用實體表。已配置的 UUID 不因重跑、認領、轉社或對帳變更；同鍵不同目標、不同人共用目標均進隔離。
6. 重複候選採「隔離→核對獨立佐證→具名決策→審核重跑」。本輪不執行合併；如未來確需合併，要另列關聯搬移、登入綁定、同類型期間衝突、歷史歸屬與回復計畫，取得對應授權。`legacy_claim_links` 認領只連結經核實來源與既有主體，不能改寫其他現存 UUID。

### 目前 schema 的必要缺口

- V1 `members.account_id NOT NULL UNIQUE`；B12 允許「舊會員暫無帳號」是需求，並非目前可直接插入的 schema 能力。此類來源暫存 V11 staging／隔離輸出，不能造假 Email、共用帳號或假登入來通過約束。
- V1 `memberships.starts_on NOT NULL`，V7 雖加 `date_precision`，沒有因此解除起日必填。未知年月日不可填匯入日、1/1 或7/1補數；待受控 schema／匯入契約另行核定，未補齊前拒收至 staging。
- V9 `business_companies.owner_member_id NOT NULL`。舊企業只有會員關聯時，不得任選第一位當 owner；須核實擁有者及共同維護者接受狀態，未明企業隔離。
- V9 有 `business_exposure_grants`，但沒有金額／幣別／收款證明交易表。文件中的 PaymentRecord、人工收款與曝光分工不能當成 migration 已完成。
- V11 staging 的 reviewed_for_claim 是認領審查旗標，不等於來源資料已完整對帳或社籍可直接匯入。

## Pay、人工收款與曝光拆開對帳

舊 `CmsCompanyPay` 只有企業關聯、payDate、locked 及通用稽核；UI 有「覆核公司付款／確認繳費／付款日期」，支持人工確認紀錄，**沒有金額、幣別、支付商或資金到帳證據**。payDate 的時區、是否為操作日或實際繳款日仍須來源核實；locked 不自動等同已付款、作廢或上架。

對帳必須拆成四組：

| 組別 | 必要證據 | 不得推出的結論 |
| --- | --- | --- |
| 舊日期紀錄 | 原資料鍵、company映射、原日期／locked及操作欄位 | 不由一個日期推算金額、有效一年、已入帳 |
| 人工收款 | 原始證明索引、幣別、應收／實收、時間、核對人、追加退款／調整 | 不覆寫原財務事件，不讓付款變社員資格 |
| 曝光授權 | companyId、starts_on、推導 ends_on、active/void、操作者／理由 | 現有 grant 不代表已完成財務對帳 |
| 目前可見性 | 發布／暫停、首次72h、有效年度免費、獨立廣告、聯絡／位置公開 | 有收款也不能繞過公司暫停、未發布、位置同意或座標要求 |

幣別分組核對，不跨幣別直接加總；日期不能當金額；缺乏證據的筆數和金額保持 `null`，列「未知／未核實」，不得以 0 補足。舊 Pay 先存隔離 manifest／legacy 候選，不自動插入 active exposure grant。`first_published_at` 未知時不得填試轉時間以意外重送72小時曝光。

## 年度總覽的統一核對口徑

正式核對必須固定 `asOfInstant`、業務時區 Asia/Taipei、社員年度 Y（7/1～次年7/1不含）與角色觀察年度；前端 demoYear 可與角色預覽日不同，兩者不可共用一個隱含年度。下列是**本輪提出的正式對帳口徑**；沒有新增或修改 API。

| 項目 | 示範實作現況 | 正式資料核對／差異處理 |
| --- | --- | --- |
| 社員分母 | handoverModel 按單一 m.clubId，status confirmed/unconfirmed；排除 OB/退社 | 以 clubId/typeCode 及 active Membership 為社籍集合；人數用 distinct memberId、社籍數獨立呈現。ROTARACT+ROTARY 不得跨社合成一次，也不得算成重複人。期間、社團停用與帳號停用另列，總量可追溯 |
| 已確認 | demo 以 annualConfirmedYear 缺值預設2026，且 `>= demoYear` | CoreService.annual 只接受 confirmed_year==Y，且 status active、當年沒有 annual_unconfirmed_year 撤確認；未來年度不能算今年已確認。未知年度隔離，不套2026預設 |
| 七月寬限 | 總覽沒有獨立 grace status；示範名冊正常狀態與年度分開 | 上年度已確認且仍active、當年未明確撤確認者，台北7月為grace；8/1零時unconfirmed。grace可保留免費曝光，但**不得併入當年度已確認分子**。分母拆 confirmed/grace/unconfirmed，完成率=confirmed/active可確認社籍；空集合null |
| 任期起迄 | organizationModel與handoverModel的endsOn含尾日；`startsOn<=asOf<=endsOn`，重疊用兩端皆含 | API/grants為 `[starts_at,ends_at)`；2027-06-30含尾日轉成2027-07-01T00:00:00+08:00（UTC前日16時），不能轉成6/30零時或23:59:59。來源已是exclusive不可再+1日 |
| 任期合法性 | demo 以日期字串與現況示範社員判斷 | 除時間外核對revoked_at、帳號active、scope_type/scope_id、club有效性及具體角色；不可因歷史社籍仍在就恢復舊職權。正式任期截止下一年度7/1不含 |
| 到期提醒 | endsOn與asOf的日期差，最後有效日daysLeft=0，90日內提醒 | 明列以「剩餘有效日」或「剩餘瞬間」計算，不直接拿exclusive ends_at日期減觀察日期；建議UI先轉回含尾業務日，再與demo提醒比較。已到ends_at者先判expired |
| 下任社長／秘書 | 下一7/1各一筆涵蓋日期且目前示範status confirmed；重疊不是就緒 | 各職務在該7/1瞬間恰一筆有效授權，且club/type/member/scopes核實；目前社員正常不等於預測未來仍有效。「已指定」與「已生效」分開，不能提前授權；下任一般管理者不補社長／秘書缺額 |
| 歷史與權限 | 總覽只示範本社／地區及call name | 社團僅自己社團、地區僅有效授權地區；歷史只那段快照，不帶出轉社後新社或聯絡。總覽不能賦予年度修改權或匯出權 |

### 必備邊界樣例（僅規格，不是實測結果）

- `2027-06-30T15:59:59Z`／`16:00:00Z`：台北6/30最後一秒與7/1零時，前任在後一刻必須失效；前年度active社員可進grace，但ended/OB不得復活。
- `2027-07-31T15:59:59Z`／`16:00:00Z`：grace在8/1台北零時截止；付費廣告獨立處理，不因年度未確認自動抹除收款或更動期限。
- 同日轉社：原endsOn==新startsOn，半開區間不重疊；同日角色交接一筆ends_at==下一筆starts_at合法，不可套前端inclusive重疊公式。
- 明確 annual_unconfirmed_year==Y 優先於前年度確認；未來confirmed_year>Y、無年度、孤兒社籍分別列異常，不能計入完成。
- 完成率驗收同時核對分母、分子、grace、未確認、歷史排除、停用／停權分類；不只比畫面百分比。停用社團可備查但不列下任就緒。

## 真正需要的來源資料

只收受經授權、最小必要、可核對的資料；正式個資與憑證不進 Git。起步用去識別化樣本與 schema，後續由受控儲存位置提供正式快照。

1. 擷取 manifest：來源系統／版本／環境、資料擁有人、授權、擷取時間及時區、快照hash、每表筆數、主鍵範圍、刪除／軟刪除政策、凍結或CDC水位。記錄缺表，不能拿空檔當零筆。
2. 舊 UPMS 使用者／組織／角色／關聯及 CMS 社員／地區／社團／企業／社員企業／Pay／活動 schema，包含 FK、唯一索引、nullable、字典及狀態值頻率；無密碼、token或其他登入憑證。
3. 身分／社籍核對所需的去識別化重複候選、合法取得的獨立佐證索引、有效／歷史期間、年度確認、社團類型、角色任期與授權來源；缺失時需資料擁有人裁決，不由模型猜測。
4. 收款證明及調整的受控索引、幣別、應收／實收及核對紀錄；若無資料，交付「未能核實」而非建假財務事件。
5. 團徽／頭像等檔案 manifest（hash、大小、格式、所有權）、已核實欄位公開同意、法定／爭議保留標記、禁止公開欄位。
6. 目標演練環境空白基線、版本、UUID映射保管方式、備份與還原證據；現存目標資料需另外快照，不能以TRUNCATE清場假裝無衝突。

## 分批試轉、拒收與回復設計

| 批次 | 範圍 | 放行與拒收條件 |
| --- | --- | --- |
| B0 來源與影子映射 | 只驗manifest/schema、候選身分與UUID映射，不寫業務表 | 來源鍵唯一、hash與水位可重現；授權／來源不明整批受阻 |
| B1 組織與字典 | 地區／社團／類型、產業與檔案索引 | 孤兒、代碼衝突、未知類型、未核定擁有權拒收；舊CMS與UPMS不能按相同數字硬接 |
| B2 Account/Member與社籍 | 帳號認領、已核實社籍、年度與歷史hidden | 重複候選、未知日期、無帳號但target必填、同類型active衝突隔離；不造憑證、不自動合併UUID |
| B3 任期與歷史 | 授權、已核實起迄、快照、同意與稽核 | inclusive/exclusive轉換、scope、撤權、跨年度及高權獨立授權核實；舊角色不自動導入現任高權 |
| B4 活動 | 主辦及日期／可見性 | 先有主辦映射，時間不明或無法判斷全天區間則隔離；私有內容不公開 |
| B5 公司與關聯 | 企業、owner、已接受維護／會員關聯 | owner不可猜、地址／位置及公開同意不可繼承；首次曝光日期未知不開trial |
| B6 Legacy Pay／收款／曝光 | 分開對照，僅可證實資料 | 金額、幣別、收款或效期缺證據不得啟用新廣告；未有目標付款模型不得假寫入曝光代替付款 |

每批先 dry-run／staging，輸出 source_total、accepted、quarantined、rejected、target_inserted、target_updated、unchanged、preexisting_conflicts 與映射／hash差異。分類互斥，`source_total=accepted+quarantined+rejected`；accepted不等於inserted，必須拆出重跑unchanged及更新。來源去重不靠刪除輸入列，重複原列仍留映射裁決證據。

金額用幣別、應收／實收／退款／調整分開對帳；未有金額資料無法驗收金額項，不能用筆數相同代替。對帳 CSV 不保存個資，只引用受控證據索引。

拒收不跳過約束：對來源錯誤採行隔離；schema能力不足則該類批次受阻；筆數／金額／關聯／隱私／年度與任期任一差異無可核准解釋，整批不放行。重跑同來源鍵與快照不新增UUID或重複事件。

回復先用批次manifest與寫入集做隔離環境還原演練；失敗交易整批回滾，跨批失敗停止後續批次。已被正式後續資料引用的UUID不可直接刪除或覆寫；需要另定補償與回復方案。正式切換前另須完整備份、可驗證還原、唯讀凍結／最後增量水位及差異清單。未解資料衝突或未驗證還原就不得切換；本輪不修改正式DB、不執行還原。

## 交付驗收與下一步

本輪只驗證三份文件的相對連結、CSV欄位／追蹤ID／null占位及一致性。來源數量、金額、實際UUID、執行時間與演練結果均未填造，不能把此文件標成「已移轉」。下一步只由總管將下方派工文字交付獨立個體；本輪文件收尾即停止。來源取得、schema缺口核定及B0／B1隔離試轉是後續個體的待辦，不因本包完成而啟動。


## 可直接貼到新對話的派工指令

> 你是獨立 R2 資料／年度口徑研究與交接個體。先讀 `/workspace/codex/AGENTS.md`、`USER.md`、`roles.md`、`HANDOFF.md`，再讀 `/workspace/codex-xk-rotaract/AGENTS.md` 與本接手包、兩份CSV。確認目前分支、HEAD及既有變更，不切分支、不自行commit/push/PR/merge。
>
> 目標：根據現有docs/2024、docs/2027、backend migrations及frontend年度model，複核舊來源欄位、永久account/member UUID、社籍子表、合法同時ROTARACT+ROTARY、付款與曝光分離，以及正式任期[t0,t1)與demo含尾日的差異。只完成可審閱的映射、來源需求與對帳設計，不修改程式、不啟動應用、不讀取正式DB、不執行移轉或對外通知。若目前repo與基準b3b3453不同，先記錄變更並更新證據，不把舊盤點當現況。
>
> 唯一可修改路徑：`docs/executive/R2_DATA_YEAR_RECONCILIATION.md`、`R2_SOURCE_FIELD_MAPPING.csv`、`R2_RECONCILIATION_REGISTER.csv`。不得修改共享索引、程式、migration、測試或其他工作線檔案。真正的資料擷取或試轉須另取得明確派工，不能用這份接手文字當作正式DB授權。
>
> 交付：核對每項映射的來源證據、目標欄位、轉換、清理、缺口；對帳登錄保留缺失計數／金額／UUID為null，不自動合併身分、不把付款認定為會員資格。確認NOT NULL與未知日期／無帳號匯入的衝突、owner必填與財務目標缺口；將可直接執行的後續隔離試轉工作另列待辦及依賴，不能冒稱已完成。
>
> DoD：三檔可解析、相對連結可定位、追蹤ID唯一、四狀態一致；每項關鍵差異有具體檔案證據；界線樣例覆蓋7/1、8/1、含尾日→exclusive、雙類型社籍與未知年度；列出拒收、重跑、回復與對帳放行條件。僅報實際做過的文件驗證，不宣稱資料庫或移轉測試通過。
>
> 每個里程碑向總管回報「狀態、完成事實、證據位置、缺資料／權限、下一步」。主狀態只用待辦／執行中／受阻／完成；本接手包可完成，但正式移轉／對帳仍待辦或受阻。遇來源個資／憑證、來源未授權、UUID合併、高權授予、正式DB、破壞性動作或超出檔案範圍，停止相關動作，先整理安全差異／交接，不自行擴權。

## 獨立個體里程碑（依賴式，不承諾背景執行）

| 里程碑 | 工作與產物 | 狀態／進入條件 |
| --- | --- | --- |
| M0 接手 | 核對規則、HEAD、檔案範圍及來源版本 | 待辦；由總管真正啟動獨立個體才開始 |
| M1 靜態核對 | 複核24項映射與17項對帳設計，標記版本差異 | 待辦；只讀repo與更新本三檔，不取正式資料 |
| M2 缺口交付 | 固定來源manifest需求、身分裁決與schema缺口、後續試轉DoD | 待辦；來源缺失保持受阻，不填造計數或付款 |
| M3 文件驗收與停止 | 檢查CSV、連結、四狀態、範圍與風險，回報總管 | 待辦；包裝完成即停，不接著執行移轉 |
| 後續B0～B6 | 本文件已列的真正隔離試轉／對帳／回復演練 | 受阻；來源、目標能力與新的具體執行派工未齊，不自動啟動 |

本輪沒有常駐個體、全天排程或通知已被啟動的證據；以上只供總管安排當日分派與里程碑，不把交接文字當成執行紀錄。
