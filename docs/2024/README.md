# 舊專案與目前新版骨架分析

本目錄是使用者指定的 `2024` 文件分類，**不是 2024 年歷史快照**。分析日期為 2026-10-14；本次以來源 repo 當下取得的提交作靜態分析，不執行舊應用、不連線正式資料庫、不開發程式。

- 參考 repo：<https://github.com/xk2022/xkRotaract>。
- 來源提交：`0c2aad93e1127b5e99b9e65bbd3adb7f3d7b2788`。
- 固定來源入口：[提交樹](https://github.com/xk2022/xkRotaract/tree/0c2aad93e1127b5e99b9e65bbd3adb7f3d7b2788)。下列文件的來源路徑均相對於此提交。
- 新版 repo：`xk2022/codex-xk-rotaract`，現有 `frontend/`、`backend/` 僅有 README；產品需求與技術選型尚未決定，沒有可執行應用、測試或 CI。

## 閱讀順序

| 文件 | 內容 |
| --- | --- |
| [features.md](features.md) | 功能盤點、已存在的路由與實作邊界 |
| [architecture.md](architecture.md) | 舊架構、資料模型、權限與外部整合 |
| [risks-and-migration.md](risks-and-migration.md) | 安全與資料風險、遷移條件、新舊差異 |

新版需求草案請讀 [2027 規格書](../2027/README.md)。新規格是待討論的產品設計，不代表舊專案已支援，也不代表已同意開始開發。

## 證據分級

- **頁面／路由存在**：找到模板或 Controller；不等於流程完整。
- **靜態實作存在**：找到 Controller、Service 或持久層；未證明可成功執行。
- **未驗證**：未建置、未啟動、未連線資料庫、未執行端到端或權限測試。
- **未發現**：本次檢查範圍未見來源，不能推論外部系統一定沒有。

文件只記錄欄位結構及風險，不複製設定值、憑證、真實姓名、電話、地址或資料樣本。
