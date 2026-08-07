<div align="center">

# 🌿 FocusWork

### Organiza tu jornada de trabajo, enfócate y cuida tu bienestar.

Una **PWA** minimalista y amigable que te acompaña durante tu día laboral: plantita que crece con tu progreso, recordatorios de estiramientos, reuniones recurrentes y modo kiosco para eliminar distracciones.

**[🚀 Demo en vivo](https://juan-bot.github.io/FocusWork/)**

![Version](https://img.shields.io/badge/version-0.1.0-3fae84) ![React](https://img.shields.io/badge/React-19-61dafb) ![Vite](https://img.shields.io/badge/Vite-8-646cff) ![Firebase](https://img.shields.io/badge/Firebase-Google%20Auth%20%2B%20Realtime-ffca28) ![PWA](https://img.shields.io/badge/PWA-ready-2ea043) ![License](https://img.shields.io/badge/license-private-8b8b8b)

</div>

---

## ✨ Características

| | |
|---|---|
| 🕐 **Reloj en vivo** | Gran reloj siempre visible en el centro de la pantalla. |
| 🌱 **Planta que crece** | Representa visualmente tu progreso de foco acumulado; crece a medida que avanzás. |
| ⭕ **Anillo de progreso** | Muestra el % de tu jornada laboral completada (inicio → fin) en tiempo real. |
| 📅 **Reuniones** | Agendá reuniones con fecha/hora y **recurrencia** (diaria, semanal, mensual). Notificación 5 min antes. |
| 🧘 **Recordatorio de estiramientos** | Aviso para levantarte y estirarte en el intervalo que elijas. |
| 🏁 **Recordatorio de salida** | Te avisa para "prepararte para irte" antes del fin de tu jornada. |
| 💬 **Frases motivacionales** | Rotan automáticamente cada 20 segundos. |
| 🌙 **Modo oscuro** | Cambiá entre tema claro y oscuro. |
| 🖥 **Pantalla completa** | Modo kiosco para máxima concentración. |
| 📱 **Responsive** | Diseñada para verse increíble en cualquier dispositivo. |
| ☁️ **Sincronización en la nube** | Tus datos en Firebase Realtime DB, sincronizados entre dispositivos con tu cuenta de Google. |

---

## 🚀 Getting Started

### Requisitos
- Node.js 18+ y npm

### Instalación

```bash
git clone https://github.com/juan-bot/FocusWork.git
cd FocusWork
npm install
npm run dev
```

Abrí http://localhost:5173 en tu navegador.

### Despliegue en GitHub Pages
```bash
npm run build && npm run preview
```

---

## 🧰 Stack

- **React 19** – UI declarativa con hooks y componentes.
- **Vite 8** – Bundler ultrarrápido con HMR.
- **Firebase** – Google Authentication + Realtime Database (sincronización multi-dispositivo).
- **oxlint** – Linting con reglas modernas.
- **PWA + Manifest** – Instalable en cualquier dispositivo.

---

## 📁 Estructura del proyecto

```
src/
├── main.jsx          # Entrada de React
├── App.jsx           # Componente principal y lógica
├── App.css           # Estilos del componente
├── index.css         # Estilos globales
└── firebase.js       # Configuración y helpers de Firebase
```

---

## 🔐 Persistencia

Los datos (reuniones, horario laboral y preferencias) se persisten en **Firebase Realtime Database** y se sincronizan entre dispositivos al iniciar sesión con tu **cuenta de Google**. Sin sesión (o sin Firebase configurado), la app usa de respaldo `localStorage`.

> 🔒 Las credenciales (`VITE_FIREBASE_*`, ver `.env.example`) están en `.gitignore` y nunca se suben al repositorio.

---

## 🛠 Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con hot reload |
| `npm run build` | Build de producción |
| `npm run preview` | Previsualiza el build |
| `npm run lint` | Lint con oxlint |

---

## 📄 Licencia

Proyecto de uso privado. Consultá antes de redistribuirlo.