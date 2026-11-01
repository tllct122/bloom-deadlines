# Bloom for Blackboard ✿

**English** | [繁體中文](README.zh-Hant.md) | [简体中文](README.zh-Hans.md)

**Every Blackboard deadline at a glance — and Blackboard in your colors.**

A small Chrome extension for students on Blackboard Learn (Ultra). A ✿ button on every Blackboard page shows all your upcoming deadlines across every course, with a countdown and whether you've already submitted. Send them to your calendar or to [EdgeTodo](https://github.com/tllct122/edge-todo-for-mac), and give Blackboard's plain look your own color, font, or a dark mode.

![Deadlines panel](docs/panel.jpg)

## Features

- ⏰ **All deadlines in one place** — every course, sorted by what's due first: Overdue · Today · Tomorrow · This week · Later
- ✓ **Knows what you've handed in** — reads your submission status from Blackboard, so finished work is crossed out
- 🔴 **Countdown & colors** — "in 5h" in orange, overdue in red, so the urgent ones stand out
- 🔢 **Toolbar badge** — the extension icon shows how many deadlines are due within 24 hours (or 3 days)
- 📅 **Add to your calendar** — one click downloads a calendar file with a reminder the day before (Apple Calendar, Google Calendar, Outlook)
- ✅ **Send to EdgeTodo** — deadlines go straight into EdgeTodo's screen-edge to-do list with their due dates
- 🎨 **Restyle Blackboard** — replace your school's color with yours, switch the font, or turn on dark mode
- ☑️ **Mark done** — tick off things Blackboard can't track (like offline tasks)
- 🔒 **Private** — runs only on your school's Blackboard site, uses the session you're already signed in with, and keeps everything in your browser. No servers, no tracking

> Not affiliated with or endorsed by Blackboard / Anthology. Built and tested with Blackboard Learn Ultra.

## Install

1. Download this repo (**Code → Download ZIP**) and unzip it
2. In Chrome, go to `chrome://extensions` and turn on **Developer mode** (top right)
3. Click **Load unpacked** and choose the unzipped folder
4. The settings page opens — paste your Blackboard address (e.g. `https://learn.yourschool.edu`) and click **Connect**, then **Allow**
5. Open Blackboard and click the ✿ button in the bottom-right corner

Works in Chrome, Edge, Arc, Brave and other Chromium browsers.

## Usage

| Action | How |
|---|---|
| See deadlines | Click **✿** on any Blackboard page, or the extension icon in the toolbar |
| Open the assignment's course | Click a deadline |
| Tick something off yourself | Hover a deadline → **Mark done** |
| Hide finished work | **Hide finished** at the bottom of the panel |
| Add to your calendar | **📅 Calendar**, then open the downloaded `.ics` file |
| Send to EdgeTodo | **→ EdgeTodo** — EdgeTodo imports it if **Settings → Import** is on, or use its menu → **Import Tasks…** |
| Colors, font, dark mode, corner, how far ahead | Extension icon → ⚙︎ |

## Privacy

Bloom only runs on the one Blackboard address you connect. It reads your calendar and submission status through Blackboard's own web API with your existing login — the same data you see on Blackboard. It never sees your password, and nothing is sent to anyone else. Your settings and the deadline list are stored in your browser only.

## Support

If Bloom saved you from a missed deadline, you can support it here:

- ☕ Buy Me a Coffee: https://buymeacoffee.com/sirene122

## License

[MIT](LICENSE)
