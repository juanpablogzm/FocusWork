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

Data (meetings, work schedule, preferences) is persisted in **Firebase Realtime Database** and synchronized across devices when you sign in with your **Google account**. While signed out, or if Firebase isn't configured, it falls back to `localStorage`.

### Firebase setup (one time)

1. Go to the [Firebase Console](https://console.firebase.google.com) and **create a project** (or select one).
2. **Add your app** → select **Web** (`</>`), give it a name, and register it.
3. Copy the SDK config snippet (keys like `apiKey`, `authDomain`, `databaseURL`, `projectId`, …).
4. Create a `.env` file at the project root based on `.env.example` and paste your values (they start with `VITE_FIREBASE_`).
5. In the console, enable **Authentication** → *Get started* → **Google** provider → enable it and save.
6. Enable **Realtime Database** → *Create database* → choose a mode and region.
7. Set up **database rules** so each user can only read/write their own data:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

8. Restart the dev server (`npm run dev`) so Vite picks up the `.env` variables.

> **Note:** `.env` is gitignored to keep your credentials private. Don't commit it.

## 🧰 Stack

- [React](https://react.dev) 19
- [Vite](https://vitejs.dev) 8
- [Firebase](https://firebase.google.com) — Google Auth + Realtime Database
- [oxlint](https://oxc.rs) for linting

## 📄 License

Private use project. Please ask before redistributing it.
