<div align="center">

# 🌿 FocusWork

### Organize your workday, stay focused, and take care of your well-being.

A minimalist, friendly **PWA** that keeps you company through your workday: a plant that grows with your progress, stretch reminders, recurring meetings, and a kiosk mode to block out distractions.

**[🚀 Live Demo](https://juanpablogzm.github.io/FocusWork/)**

![Version](https://img.shields.io/badge/version-0.1.0-3fae84) ![React](https://img.shields.io/badge/React-19-61dafb) ![Vite](https://img.shields.io/badge/Vite-8-646cff) ![Firebase](https://img.shields.io/badge/Firebase-Google%20Auth%20%2B%20Realtime-ffca28) ![PWA](https://img.shields.io/badge/PWA-ready-2ea043) ![License](https://img.shields.io/badge/license-private-8b8b8b)

</div>

---

## ✨ Features

| | |
|---|---|
| 🕐 **Live clock** | A big, always-visible clock in the center of the screen. |
| 🌱 **Growing plant** | Visually represents your accumulated focus progress; it grows as you advance. |
| ⭕ **Progress ring** | Shows the % of your workday completed (start → end) in real time. |
| 📅 **Meetings** | Schedule meetings with date/time and **recurrence** (daily, weekly, monthly). Get notified 5 minutes before each one. |
| 🧘 **Stretch reminders** | Reminds you to stand up and stretch at the interval you choose. |
| 🏁 **Leaving reminder** | Nudges you to "get ready to leave" before your workday ends. |
| 💬 **Motivational quotes** | Rotate automatically every 20 seconds. |
| 🌙 **Dark mode** | Toggle between light and dark themes. |
| 🖥 **Fullscreen** | Kiosk mode for maximum focus. |
| 📱 **Responsive** | Designed to look great on any device. |
| ☁️ **Cloud sync** | Data stored in Firebase Realtime DB, synced across devices with your Google account. |

---

## 🚀 Getting Started

### Requirements
- Node.js 18+ and npm

### Installation

```bash
git clone https://github.com/juanpablogzm/FocusWork.git
cd FocusWork
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### Production build
```bash
npm run build && npm run preview
```

---

## 🧰 Tech Stack

- **React 19** – declarative UI with hooks and components.
- **Vite 8** – ultra-fast bundler with HMR.
- **Firebase** – Google Authentication + Realtime Database (multi-device sync).
- **oxlint** – modern linting rules.
- **PWA + Manifest** – installable on any device.

---

## 📁 Project Structure

```
src/
├── main.jsx          # React entry point
├── App.jsx           # Main component and app logic
├── App.css           # App styles
├── index.css         # Global styles
└── firebase.js       # Firebase config and helpers
```

---

## 🔐 Persistence

Data (meetings, work schedule, preferences) is persisted in **Firebase Realtime Database** and synced across devices when you sign in with your **Google account**. When signed out (or if Firebase isn't configured), the app falls back to `localStorage`.

> 🔒 Credentials (`VITE_FIREBASE_*`, see `.env.example`) are in `.gitignore` and never committed.

---

## 🛠 Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Lint with oxlint |

---

## 📄 License

Private use project. Please ask before redistributing it.
