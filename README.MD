# 📺 Sports Bot — Telegram Streaming Bot

A Telegram bot that serves live sports streams from M3U playlists — deployed on **Cloudflare Workers** (free tier, 24/7, no server required).

Users type a simple command like `/willow` or `/fancode`, and the bot replies with all available matches as tappable buttons. Tapping a button sends the stream URL + DRM keys.

---

## ⚠️ Disclaimer

> **This project is made strictly for educational and research purposes only.**
>
> - This bot **does not host, store, or stream** any content.
> - It only **parses publicly available M3U playlists** and forwards links to the user.
> - All streams, trademarks, logos, and content belong to their **respective owners**.
> - The author(s) of this project **do not endorse or encourage** piracy or copyright infringement in any form.
> - Users are solely responsible for how they use this software and any links they access.
> - If you are a copyright holder and believe your content has been referenced, please contact the source of the M3U playlist directly.
> - Use of this bot must comply with your local laws and the terms of service of the platforms involved.
>
> By using this project, you accept full responsibility for your actions.

---

## ✨ Features

- 🎯 **Multiple playlists** — Willow, Fancode, SonyLIV, and easily extendable
- 🔘 **Inline buttons** — every match is a tappable button, no typing IDs
- 🔐 **DRM-aware** — extracts and sends ClearKey license keys automatically
- ⚡ **Fast** — 5-minute cache, no repeated GitHub calls
- 🌍 **Serverless** — runs on Cloudflare Workers, 100% free
- 🔗 **Direct commands** — `/willow1`, `/fancode3`, etc. for quick access
- 📱 **Works in groups & DMs**

---

## 🤖 Try the bot

👉 **[@sportlink2026_bot](https://t.me/sportlink2026_bot)**

---

## 📋 Available Commands

| Command | What it does |
|---|---|
| `/start` | Welcome + list of playlists |
| `/help` | Same as `/start` |
| `/list` | Full list of every match command |
| `/willow` | All Willow matches as buttons |
| `/fancode` | All Fancode matches as buttons |
| `/sonyliv` | All SonyLIV matches as buttons |
| `/willow1` | Direct link — Willow stream #1 |
| `/fancode2` | Direct link — Fancode stream #2 |
| `/sonyliv1` | Direct link — SonyLIV stream #1 |

---

