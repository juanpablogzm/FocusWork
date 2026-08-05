# 🌿 FocusWork

A minimalist, friendly web app to help you organize your workday, designed to reduce distractions and support your well-being.

![Palette](https://img.shields.io/badge/palette-mint%20green-3fae84) ![Stack](https://img.shields.io/badge/stack-React%20%2B%20Vite-61dafb) ![Status](https://img.shields.io/badge/status-in%20development-yellow)

## ✨ Features

- 🕐 **Live clock** — a big, always-visible clock in the center of the screen.
- 🌱 **Growing plant** — visually represents your accumulated focus progress; it grows as you advance.
- ⭕ **Workday progress ring** — shows the percentage of your work schedule you've completed (start → end), in real time.
- 📅 **Meetings** — add meetings with date and time, with **recurrence** support (daily, weekly, monthly). You get notified 5 minutes before each one.
- 🧘 **Stretch reminders** — get reminded to stand up and stretch at your chosen interval.
- ⏰ **Leaving reminder** — notifies you to "get ready to leave" before your workday ends.
- 💬 **Motivational quotes** — rotate automatically every 20 seconds.
- 🌙 **Dark mode** — toggle between light and dark themes.
- 🖥 **Fullscreen** — kiosk mode to stay focused.
- 📱 **Responsive** — designed to look great on desktop and mobile.

## 🎨 Design

Inspired by wellness and productivity apps, following Material Design principles:

- **Mint green** and natural tones palette.
- Rounded corners, soft shadows, and subtle micro-interactions.
- A clean interface with few visual elements to avoid distractions.

## 🚀 Getting Started

### Requirements

- Node.js 18+ and npm

### Installation

```bash
# Clone the repository
git clone https://github.com/juan-bot/FocusWork.git
cd FocusWork

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production build

```bash
npm run build
npm run preview
```

### Lint

```bash
npm run lint
```

## 🛠 Scripts

| Command           | Description                            |
| ----------------- | -------------------------------------- |
| `npm run dev`     | Development server with hot reload     |
| `npm run build`   | Build the app for production           |
| `npm run preview` | Preview the production build           |
| `npm run lint`    | Lint the code with oxlint              |

## 🗂 Project Structure

```
src/
├── main.jsx     # React entry point
├── App.jsx      # Main component and app logic
├── App.css      # App styles
└── index.css    # Global styles
```

## 💾 Persistence

Data (meetings, work schedule, preferences) is currently stored in the browser's `localStorage`, so it persists between reloads. No server or database is required.

> **Next step:** migration to **Firestore** to sync data across devices.

## 🧰 Stack

- [React](https://react.dev) 19
- [Vite](https://vitejs.dev) 8
- [oxlint](https://oxc.rs) for linting

## 📄 License

Private use project. Please ask before redistributing it.
