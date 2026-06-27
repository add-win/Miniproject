# 🐾 WildGuard — Progressive Web App (PWA)

A real-time wildlife intrusion alert PWA. Open it in any browser on any device on your local network — it receives push notifications via Firebase Cloud Messaging even when the browser tab is in the background or the screen is off.

---

## 📁 Structure

```
pwa/
├── index.html                  ← Main UI
├── app.js                      ← FCM setup, polling, alert rendering
├── firebase-messaging-sw.js    ← Service worker (background notifications)
├── manifest.json               ← PWA manifest (makes it installable)
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

---

## ⚙️ Setup

### 1. PWA Config (Frontend)

Copy `pwa/config.example.js` to `pwa/config.js` and replace the placeholders:

```javascript
const CONFIG = {
  apiKey: "YOUR_API_KEY",
  vapidKey: "YOUR_VAPID_KEY"
};
```
These keys help the frontend communicate with Firebase Cloud Messaging.

### 2. Backend Config (Node.js)

1. **Environment Variables**: Copy `backend/.env.example` to `backend/.env` and configure your settings (like port and keys).
2. **Service Account**: Download your Firebase Service Account JSON from the Firebase Console, name it `firebase-key.json`, and place it in the `backend/` folder (or update the `.env` path).

> **Note**: Both `config.js`, `.env`, and `firebase-key.json` are ignored by Git, so your credentials remain safe.

### 3. Backend IP (Automatic)
The backend IP in the PWA automatically adapts to the origin, so no manual IP configuration is required!

### 4. AI Detector Setup (Python)
To run the animal detection AI script:
1. Make sure you have **Python 3.10 - 3.13** installed.
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   .venv\Scripts\activate  # Windows
   source .venv/bin/activate  # macOS/Linux
   ```
3. Install the required dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
4. **Model File Setup**: Place your TensorFlow trained model file (`wild_animal_model.keras`) directly in the `backend/` directory. *(Note: This file is ignored by Git to avoid uploading large binaries to GitHub).*
5. **Deterrent Sounds Setup**: Run the audio generator script to create the audio deterrent `.wav` files inside `backend/sounds/` (they may already be pre-generated):
   ```bash
   cd backend
   python generate_sounds.py
   ```


---

## 🚀 Running the PWA & Exposing to Internet

The PWA **must be served over HTTPS** (or localhost) for service workers and FCM push notifications to work on your phone.

### 1. Start the Backend
The backend already serves the PWA static assets natively. Start the server:
```bash
cd backend
npm run start
```
It will run locally on `http://localhost:5000`.

### 2. Start the AI Detection Script
With the backend server running, launch the live monitoring script:
```bash
# Ensure your virtual environment is active
python backend/detect.py
```
This will initialize your webcam, load the TensorFlow model, start real-time monitoring, and:
- Play a pulsing deterrent audio alarm on detection.
- Save the detection frames inside `backend/detections/`.
- Send alerts to the backend, which triggers FCM push notifications to registered devices.
*(Note: Press `q` to quit the camera window).*

### 3. Expose with Ngrok (Required for Phone)
To securely access the PWA from your phone with HTTPS, use [ngrok](https://ngrok.com/download):
```bash
ngrok http 5000
```
Ngrok will generate a secure HTTPS Forwarding URL (e.g., `https://a1b2c3d4.ngrok-free.app`).

---

## 📱 How to Install on Phone

1. Open your **ngrok HTTPS URL** in Chrome on your Android phone.
2. Tap the **⬇ Install App** button that appears in the top bar  
   *(or tap Chrome menu → "Add to Home Screen")*
3. The PWA installs like a native app with its own icon on your homescreen.
4. Tap **Enable Notifications** when prompted.
5. Done — you'll now receive push alerts even if the app UI is closed!

---

## 🔔 Notification Flow

```
Detection Script
      │  POST /detect
      ▼
Backend (laptop)
      ├──▶ FCM push → Phone receives notification (even if PWA is closed)
      └──▶ detections.json updated → PWA polls every 5s → UI updates
```

---

## 🧪 Test It

```bash
curl -X POST http://localhost:5000/detect \
  -H "Content-Type: application/json" \
  -d '{"animal":"Tiger","location":"North Fence","threatLevel":"HIGH"}'
```

Your phone should show a push notification within seconds.