# 企業申請／繳費紀錄（業務語意待確認）

> 現行狀態（2026-10-15）：剩餘規格已依使用者授權補齊，請先讀[需求基準 v1.0](13-requirements-baseline.md)、[權限矩陣](14-role-matrix.md)及[現行階段清單](11-development-phases.md)。下方保留來源分析與歷次討論；其中「待確認／提案」及舊狀態僅供追溯，已由現行基準處理。程式與驗收尚未完成。

## 來源與歷次討論（非現行待辦）

狀態：討論稿 v0.1；所有新版行為待確認。[規格索引](README.md)

## 舊版依據與差異

固定來源（僅證明原始碼存在，未驗證執行）：

- [src/main/java/com/xk/cms/model/po/CmsCompanyPay.java](https://github.com/xk2022/xkRotaract/blob/0c2aad93e1127b5e99b9e65bbd3adb7f3d7b2788/src/main/java/com/xk/cms/model/po/CmsCompanyPay.java)
- [src/main/java/com/xk/cms/service/impl/CmsCompanyPayServiceImpl.java](https://github.com/xk2022/xkRotaract/blob/0c2aad93e1127b5e99b9e65bbd3adb7f3d7b2788/src/main/java/com/xk/cms/service/impl/CmsCompanyPayServiceImpl.java)
- [src/main/java/com/xk/cms/controller/web/CmsCompanyPayController.java](https://github.com/xk2022/xkRotaract/blob/0c2aad93e1127b5e99b9e65bbd3adb7f3d7b2788/src/main/java/com/xk/cms/controller/web/CmsCompanyPayController.java)
- [src/main/resources/templates/admin/cms/applyCompany/input.html](https://github.com/xk2022/xkRotaract/blob/0c2aad93e1127b5e99b9e65bbd3adb7f3d7b2788/src/main/resources/templates/admin/cms/applyCompany/input.html)
- [src/main/resources/templates/admin/cms/applyCompany/view.html](https://github.com/xk2022/xkRotaract/blob/0c2aad93e1127b5e99b9e65bbd3adb7f3d7b2788/src/main/resources/templates/admin/cms/applyCompany/view.html)

本文件的狀態、授權、資料結構與驗收是新版提案；不得將其記為舊版已實作。

舊模型雖有 payDate／繳費日期註解，但控制器路徑為 applyCompany，模板有「覆核公司付款」「確認繳費」「付款日期」；可確認人工繳費確認介面與日期紀錄存在，但實際資金支付與業務用途仍待確認。以下人工繳費流程只是候選方案；若實際為上架申請，應改為申請／審核狀態，不加入付款欄位。

## 使用者與流程

指定紀錄管理者；一般會員能否看見與提交由業務規則决定。

選擇公司 → 登錄付款日期及必要欄位 → 檢查重複 → 儲存 → 更正或作廢並保留歷史。

## 資料草案

舊版只有 companyId、payDate、locked 與基础欄位；新版候選 PaymentRecord：ID、companyId、paidAt、period、amount、currency、reference、狀態、登錄者、作廢原因。新增金額等欄位僅在業務確認後納入。

共同 ID、版本、分頁、錯誤與公開欄位規則見 [資料與介面](09-data-and-api.md)。所有範例只用合成資料。

## 功能要求

- **PAY-01**：本模組不是線上收款，不收信用卡資料、不發送付款请求、不宣稱對帳完成。
- **PAY-02**：繳費用途、週期、金額、幣別與是否影響上架均待確認；未決前不得自動算欠款或有效期限。
- **PAY-03**：同一公司同一週期重複登錄需提示；是否允許分次付款待決，不能草率設定唯一鍵。
- **PAY-04**：更正與作廢須記錄操作者、時間與理由，不能刪除稽核歷史。
- **PAY-05**：提供資料投影，僅授權者可閱財務欄位；繳費紀錄不由公開地图 API 暴露。

## 介面候選

GET /companies/{id}/payment-records；POST /companies/{id}/payment-records；POST /payment-records/{id}/void；更正模型待業務確認。

以上為契約討論清單，不是已實作端點；正式 schema、欄位長度、必填與空值處理於規格定稿時補齐。畫面至少具備載入、空資料、欄位錯誤、無權限、服務失敗與衝突處理，錯誤不清除使用者未儲存內容。

## 驗收情境

- **PAY-AC-01**：未授權的公司維護者不能登錄、作廢或讀取他公司紀錄。
- **PAY-AC-02**：重複送出同一請求不產生两笔付款；作廢保留原紀錄與理由。
- **PAY-AC-03**：記錄新增不觸發外部收款；公開頁面不包含財務資料。

以上尚未執行；實作後由獨立驗證者依情境驗收。

## 待討論

是否為人工繳費確認、上架申請或其他紀錄？payDate 的業務含意為何？若是繳費，是公司上架費、會費還是其他用途？金額及週期是否需要？誰登錄、誰能查看與作廢？

## 非正常社籍查詢與加購曝光（2026-10-15 最新確認）

- 會員查詢須登入；預設正常社籍，勾選特殊選項後可查已退出、OB 等非正常社籍會員，隱私及歷史公開規則仍適用。
- 當年度正常會員有社籍，商家地圖曝光免費；非當年度社友欲曝光商家，採付費會員／廣告形式，不再設定同社團年資門檻。付費曝光起始日由平台管理者設定，期限為起始日加一年，到期續費並確認商家資料，未續費則下架地圖、保留資料。付費資格不授予有效社籍或社團管理權。
- 此為地圖後續商業需求，不代表第一階段加入金流；驗證服務、收款、退款、到期下架及資料更新確認另行規劃。

## 地圖免費資格與廣告曝光（2026-10-15 最新決策）

- 當年度正常會員持有社籍，地圖曝光不用付費；非當年度社友想曝光商家，採付費會員的廣告形式。取消先前同社團社籍年資門檻。
- 付費廣告保留社團圖標、以不同顏色呈現，並加「廣告」文字標示。
- 平台管理者設定曝光起始日，結束日為起始日加一年；到期續費並確認商家資料，未續費則退出地圖並保留資料。日期邊界、時區與閏日處理待細化。
- 此處僅確認平台管理者設定曝光日期的動作，不推導其他平台維運權限。收款與對帳方式、廣告費用、續費及共用公司資格仍待定，不代表本階段串接金流。
- 扶輪年度為 7/1 至隔年 6/30；各社管理帳號及當年度社長、秘書可在面板確認社員狀態。年度確認流程與轉社／退社當年度的曝光處理待確認。

## 年度待確認與付費曝光（2026-10-15 已確認）

有效付費廣告依平台管理者設定的曝光期間持續，不因年度社籍待確認而下架；逾期補確認為正常社員後立即恢復免費曝光。補確認不自動取消、延長或退費既有廣告，相關方案切換及費用規則仍待確認。
