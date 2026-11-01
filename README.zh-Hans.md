# Bloom ✿

[English](README.md) | [繁體中文](README.zh-Hant.md) | **简体中文**

**一眼看清所有 Blackboard 和 Canvas 截止日期，还可以把学校网站换成你自己的风格。**

Bloom 是给使用 **Blackboard Learn（Ultra）** 或 **Canvas** 的学生用的 Chrome 扩展程序。每个页面都会有一个 ✿ 按钮，列出所有课程即将到期的作业，附倒计时，还会显示你是否已经提交。可以一键加入日历或发送到 [EdgeTodo](https://github.com/tllct122/edge-todo-for-mac)，也可以用你自己的颜色、字体和背景图片重新设计网站。

![截止日期面板](docs/panel.jpg)

## 功能

- ⏰ **所有截止日期集中一处**：所有课程，按到期先后排列（Overdue · Today · Tomorrow · This week · Later）
- ✓ **知道你交了没有**：从 Blackboard 或 Canvas 读取提交状态，已完成的会划线
- 🔴 **倒计时与颜色**：“in 5h”显示为橙色，逾期显示为红色，紧急的一眼就看到
- 🔢 **工具栏数字**：扩展图标会显示 24 小时（或 3 天）内到期的数量
- 📅 **加入日历**：一键下载日历文件，附前一天提醒（Apple 日历、Google 日历、Outlook）
- ✅ **与 EdgeTodo 同步（Mac）**：截止日期会自动出现在 [EdgeTodo](https://github.com/tllct122/edge-todo-for-mac) 的屏幕边待办清单，提交后会自动勾掉
- ☑️ **手动标记完成**：网站追踪不到的事（例如线下作业）可以自己勾掉
- 🔒 **隐私**：只在你连接的那个网站运行，使用你已登录的账号，所有数据只保存在你的浏览器。没有服务器，不会追踪

## 自定义你的风格 🎨

没有任何东西是固定的。可以从预设主题开始，也可以完全自己设计：

- **8 个预设主题**：Sakura、Matcha、Showa Retro、Lavender、Ocean、Peach、Minimal、Night
- **5 种颜色分开设置**：侧边菜单与顶栏、按钮与链接、页面背景、卡片、标题。任何颜色都可以选，或点 ⌀ 保留学校原本的颜色
- **任何字体**：内置三款圆体英文字体（Nunito、Fredoka、Quicksand），也可以用电脑已安装的任何字体，或上传字体文件（.ttf .otf .woff .woff2）。中文会使用系统字体
- **文字大小**（80–140%）和**卡片圆角**
- **背景图片**，可调整图片显示的程度
- **深色模式**
- **自定义 CSS**，想改什么都可以
- **导出／导入主题**文件，可以分享给朋友
- **实时预览**，已打开的 Blackboard 或 Canvas 标签页也会实时更新

![主题编辑器](docs/theme-editor.jpg)

![Canvas 上的 Bloom](docs/canvas.jpg)

> 与 Blackboard / Anthology 或 Instructure（Canvas）没有任何关系，亦未获其认可。基于 Blackboard Learn Ultra 和 Canvas LMS 开发及测试。

## 安装

1. 下载这个仓库（**Code → Download ZIP**），然后解压
2. 在 Chrome 打开 `chrome://extensions`，打开右上角的 **开发者模式**
3. 点击 **加载已解压的扩展程序**，选择解压后的文件夹
4. 设置页会自动打开，粘贴学校网站的网址（例如 `https://learn.yourschool.edu` 或 `https://yourschool.instructure.com`），点击 **Connect**，再点 **允许**
5. 打开 Blackboard 或 Canvas，点击右下角的 ✿ 按钮

适用于 Chrome、Edge、Arc、Brave 等 Chromium 浏览器。Bloom 会自动判断是 Blackboard 还是 Canvas；如果学校网站改动很多，可以在设置的 **This site is** 自己选择。

## 使用方法

| 操作 | 方法 |
|---|---|
| 查看截止日期 | 在网站任何页面点击 **✿**，或点击工具栏的扩展图标 |
| 打开该作业 | 点击该截止日期 |
| 自己标记完成 | 鼠标移到项目上 → **Mark done** |
| 隐藏已完成 | 面板底部的 **Hide finished** |
| 加入日历 | **📅 Calendar**，然后打开下载的 `.ics` 文件 |
| 与 EdgeTodo 同步 | 设置 → **Sync with EdgeTodo automatically**（保持 EdgeTodo 打开）。没有打开的话，**→ EdgeTodo** 会保存一个 EdgeTodo 可以导入的文件 |
| 更改主题 | 扩展图标 → ⚙︎ → **Your theme** |
| 分享主题 | **Export theme** → 把文件发给朋友 → 朋友点 **Import theme** |

## 隐私

Bloom 只会在你连接的那个网址运行。它用你现有的登录，通过 Blackboard 或 Canvas 本身的网络接口读取截止日期和提交状态，也就是你在网站上本来就能看到的数据。它不会看到你的密码，也不会把任何数据发给其他人。设置、主题和截止日期清单只会保存在你的浏览器。

## 支持

如果 Bloom 帮你避免了一次迟交，欢迎在这里支持：

- ☕ Buy Me a Coffee：https://buymeacoffee.com/sirene122

## 许可证

[MIT](LICENSE)。内置字体（Nunito、Fredoka、Quicksand）采用 SIL Open Font License，详见 `fonts/`。
