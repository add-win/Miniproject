# 🐾 WildGuard
### *Next-Gen AI Wildlife Surveillance & Security*

WildGuard is an advanced AI-powered monitoring system designed to mitigate human-wildlife conflict and preserve biodiversity. By combining real-time computer vision with cloud-based mobile alerting, it provides an instantaneous defense layer for forest borders, agricultural lands, and remote communities.

---

## ✨ Key Features

-   **🧠 Smart AI Detection**: Uses a Deep Learning (CNN) model to identify 50+ species of wildlife.
-   **🛡️ Anti-False Alert Engine**: Implements multi-frame confirmation and motion pre-filtering to ensure only valid threats trigger alerts.
-   **📱 Instant PWA Alerts**: Real-time push notifications delivered to any mobile device (Android/iOS) via Firebase Cloud Messaging.
-   **📡 Remote Radar Feed**: Live monitoring dashboard with "Radar Mode" and incident history logs.
-   **⚡ Low-Latency Pipeline**: Optimized for performance with background motion subtraction to reduce CPU load.
-   **💾 Cloud Sync**: All detections are automatically synced to Firebase Firestore for cross-device visibility.

---

## 🌍 Sustainable Development Goals (SDG)

WildGuard is engineered to support the United Nations 2030 Agenda:

| Goal | Contribution |
| :--- | :--- |
| **SDG 15: Life on Land** | Protects endangered species and prevents poaching through 24/7 automated monitoring. |
| **SDG 11: Sustainable Cities** | Safer human-animal co-existence in urban-forest transition zones. |
| **SDG 2: Zero Hunger** | Protects livelihoods by preventing crop raids and livestock loss. |
| **SDG 9: Industry & Innovation** | Demonstrates the power of AI & IoT in modern environmental conservation. |

---

## 🛠️ Technology Stack

-   **Vision Engine**: Python 3.10+, OpenCV, TensorFlow/Keras.
-   **Cloud Infrastructure**: Firebase (FCM, Firestore, Hosting).
-   **Server**: Node.js, Express.
-   **Frontend**: PWA with Vanilla JS & Tailwind CSS.

---

## ⚙️ Quick Start Guide

### 1. Installation
```bash
# Clone the repository
git clone <repository-url>
cd Miniproject

# Install backend dependencies
cd backend
npm install
```

### 2. Configuration
1.  **Backend**: Place your `firebase-key.json` (Firebase Service Account) in the `backend/` folder.
2.  **Frontend**: Copy `pwa/config.example.js` to `pwa/config.js` and add your Firebase project keys.

### 3. Execution
**Step A: Launch the Backend**
```bash
node server.js
```
**Step B: Start AI Monitoring**
```bash
python detect.py
```
*Tip: Press **'q'** in the video window to safely exit and release the camera.*

---

## 📱 Mobile Installation

1.  **Expose Server**: Use Ngrok to create a secure tunnel: `npx ngrok http 5000`.
2.  **Access URL**: Scan the QR/Open the HTTPS URL in your mobile browser.
3.  **Install**: Tap **"Add to Home Screen"** or the **"Install App"** button in the top bar.
4.  **Stay Alert**: Grant notification permissions to receive background push alerts.

---

## 📁 System Architecture

```text
Miniproject/
├── backend/
│   ├── detect.py              # Smart AI Detection Engine
│   ├── server.js               # API Server & PWA Host
│   ├── wild_animal_model.keras # AI Weight File
│   └── detections.json         # Local Persistence Log
└── pwa/
    ├── index.html              # Modern Dashboard UI
    ├── app.js                  # PWA Interaction Logic
    └── firebase-messaging-sw.js # Background Service Worker
```

---

*Designed with ❤️ for Wildlife Conservation & Community Safety.* 🌿