# Bloom ✿

[English](README.md) | **繁體中文** | [简体中文](README.zh-Hans.md)

**一眼看清所有 Blackboard 和 Canvas 截止日期，還可以把學校網站換成你自己的風格。**

Bloom 是給使用 **Blackboard Learn（Ultra）** 或 **Canvas** 的學生用的 Chrome 擴充功能。每個頁面都會有一個 ✿ 按鈕，列出所有科目即將到期的功課，附倒數時間，還會顯示你是否已經提交。可以一鍵加入日曆或傳送到 [EdgeTodo](https://github.com/tllct122/edge-todo-for-mac)，也可以用你自己的顏色、字型和背景圖片重新設計網站。

![截止日期面板](docs/panel.jpg)

## 功能

- ⏰ **所有截止日期集中一處**：所有科目，按到期先後排列（Overdue · Today · Tomorrow · This week · Later）
- ✓ **知道你交了沒有**：從 Blackboard 或 Canvas 讀取提交狀態，已完成的會劃線
- 🔴 **倒數與顏色**：「in 5h」顯示為橙色，逾期顯示為紅色，緊急的一眼就看到
- 🔢 **工具列數字**：擴充圖示會顯示 24 小時（或 3 天）內到期的數量
- 📅 **加入日曆**：一鍵下載日曆檔，附前一天提醒（Apple 日曆、Google 日曆、Outlook）
- ✅ **傳送到 EdgeTodo**：截止日期直接加入 EdgeTodo 的螢幕邊待辦清單
- ☑️ **手動標記完成**：網站追蹤不到的事（例如實體功課）可以自己剔走
- 🔒 **私隱**：只在你連接的那個網站運作，使用你已登入的帳戶，所有資料只存在你的瀏覽器。沒有伺服器，不會追蹤

## 自訂你的風格 🎨

沒有任何東西是固定的。可以從預設主題開始，也可以完全自己設計：

- **8 個預設主題**：Sakura、Matcha、Showa Retro、Lavender、Ocean、Peach、Minimal、Night
- **5 種顏色分開設定**：側邊選單與頂欄、按鈕與連結、頁面背景、卡片、標題。任何顏色都可以選，或按 ⌀ 保留學校原本的顏色
- **任何字型**：內附三款圓體英文字型（Nunito、Fredoka、Quicksand），也可以用電腦已安裝的任何字型，或上載字型檔（.ttf .otf .woff .woff2）。中文會使用系統字型
- **文字大小**（80–140%）和**卡片圓角**
- **背景圖片**，可調整圖片顯示的程度
- **深色模式**
- **自訂 CSS**，想改甚麼都可以
- **匯出／匯入主題**檔案，可以分享給朋友
- **即時預覽**，已打開的 Blackboard 或 Canvas 分頁也會即時更新

![主題編輯器](docs/theme-editor.jpg)

![Canvas 上的 Bloom](docs/canvas.jpg)

> 與 Blackboard / Anthology 或 Instructure（Canvas）沒有任何關係，亦未獲其認可。以 Blackboard Learn Ultra 和 Canvas LMS 開發及測試。

## 安裝

1. 下載這個 repo（**Code → Download ZIP**），然後解壓縮
2. 在 Chrome 打開 `chrome://extensions`，開啟右上角的 **開發人員模式**
3. 點擊 **載入未封裝項目**，選擇解壓縮後的資料夾
4. 設定頁會自動打開，貼上學校網站的網址（例如 `https://learn.yourschool.edu` 或 `https://yourschool.instructure.com`），點擊 **Connect**，再按 **允許**
5. 打開 Blackboard 或 Canvas，點擊右下角的 ✿ 按鈕

適用於 Chrome、Edge、Arc、Brave 等 Chromium 瀏覽器。Bloom 會自動判斷是 Blackboard 還是 Canvas；如果學校網站改動很多，可以在設定的 **This site is** 自己選擇。

## 使用方法

| 動作 | 方法 |
|---|---|
| 查看截止日期 | 在網站任何頁面點擊 **✿**，或點擊工具列的擴充圖示 |
| 打開該份功課 | 點擊該截止日期 |
| 自己標記完成 | 滑鼠移到項目上 → **Mark done** |
| 隱藏已完成 | 面板底部的 **Hide finished** |
| 加入日曆 | **📅 Calendar**，然後打開下載的 `.ics` 檔 |
| 傳送到 EdgeTodo | **→ EdgeTodo**：如 EdgeTodo 已開啟 **Settings → Import** 就會自動匯入，或用它的選單 → **Import Tasks…** |
| 更改主題 | 擴充圖示 → ⚙︎ → **Your theme** |
| 分享主題 | **Export theme** → 把檔案傳給朋友 → 朋友按 **Import theme** |

## 私隱

Bloom 只會在你連接的那個網址運作。它用你現有的登入，透過 Blackboard 或 Canvas 本身的網絡介面讀取截止日期和提交狀態，也就是你在網站上本來就看到的資料。它不會看到你的密碼，也不會把任何資料傳給其他人。設定、主題和截止日期清單只會儲存在你的瀏覽器。

## 支持

如果 Bloom 幫你避過一次遲交，歡迎在這裡支持：

- ☕ Buy Me a Coffee：https://buymeacoffee.com/sirene122

## 授權

[MIT](LICENSE)。內附字型（Nunito、Fredoka、Quicksand）採用 SIL Open Font License，詳見 `fonts/`。
