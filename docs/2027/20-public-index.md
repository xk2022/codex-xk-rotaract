# 公開首頁與管理入口

日期：2026-10-15。補足使用者指出的入口缺口：v0.2 預設直接進入社團管理雛形，沒有面向訪客的首頁；本次改為公開 index。

## 舊版依據

參考 [xk2022/xkRotaract](https://github.com/xk2022/xkRotaract/tree/0c2aad93e1127b5e99b9e65bbd3adb7f3d7b2788) 的既有 2024 模板（固定來源提交，非另行聲稱完整2024快照）：

- `src/main/resources/templates/index/index.html`：主標「玩轉你的扶青年代」，三入口 Rotaract BizMap、Rotaract Info、Rotaract Kalendar。
- `src/main/resources/templates/_fragments/_fragments.html`：紅色 Rotaract 萬花筒品牌、首頁／職業地圖／資訊／全區行事曆／後台導覽。
- `src/main/java/com/xk/ui/controller/web/IndexController.java`：`/` 回傳公開首頁，與管理頁分離。

沿用入口架構、品牌與主標，重新製作 React 元件與插畫；未複製舊版商用模板、外掛、追蹤或設定資料。

## 入口與行為

| 入口 | 網址片段 | 行為 |
| --- | --- | --- |
| 公開首頁 | `#/`（無片段亦同） | 匿名可看，不顯示管理側欄或私人會員資料 |
| 扶青產業地圖 | `#/map` | 合成商家與示意地圖，不是真實定位／曝光資格判定 |
| 共同行事曆 | `#/calendar` | 公開活動假資料預覽，不含內部活動 |
| 扶青資訊 | 舊版 Instagram 外連 | 明確外部連結，新視窗開啟 |
| 會員登入／註冊 | `#/login`、`#/register` | 獨立入口畫面；登入使用原假資料帳號流程 |
| 管理後台 | `#/admin` | 先顯示登入及明確標示的假資料體驗入口 |
| 管理示範 | `#/demo` | 原管理工作區，具假資料身分切換控制 |
| 會員工作區 | `#/workspace` | 本次示範登入／註冊後進入；重新整理回登入，不保存 Session |

使用 hash 路由相容 GitHub Pages 儲存庫子路徑；返回、前進、重新整理與直接連結不需要伺服器 rewrite。`#/BizMap`、`#/Calendar` 保留大小寫不敏感的片段別名；未支援的片段回首頁。這不是舊伺服器 `/BizMap` 路徑重導。

管理者不因點首頁入口或會員登入而自動取得權限；管理工作區仍是可切換身分的 UI 示範。假資料頁不等同正式登入及授權。

## To-do 與範圍

- [x] 公開首頁、品牌、三主入口與手機導覽。
- [x] 登入、註冊、管理後台及返回公開首頁的連結。
- [x] 商家與公開行事曆最小預覽，讓首頁入口可操作。
- [ ] 第二、三階段的真實活動／地圖資料、地理服務及資格串接。
- [ ] 正式會員登入、Session 與管理權限。
- [ ] 正式品牌原檔與社團公開內容確認。

## 驗證

- TypeScript／Vite 正式建置通過，既有38項業務測試通過。
- 既有兩套管理流程瀏覽器測試通過，包含註冊、入社、轉社與帳號／權限等流程。
- 新增 `npm run test:browser:public`：匿名首頁不顯示管理DOM、商家搜尋／詳情與鍵盤焦點、活動月份／詳情、登入／註冊、管理入口、瀏覽器返回、直連／重新整理、360px及跳至主要內容均通過。
- 獨立審查發現的skip link路由衝突、返回殘留浮層與焦點問題已修正並複核。

畫面：[桌機首頁](../previews/public-index-desktop.png)、[手機首頁](../previews/public-index-mobile.png)。

正式建置另以 `/codex-xk-rotaract/` 子路徑靜態伺服器執行整套公開瀏覽器測試通過，確認相對資源與片段路由相容 Pages 路徑。
