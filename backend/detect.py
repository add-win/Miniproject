import os
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"  # Silence oneDNN floating-point warning
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"   # Silence all TensorFlow C++ info/warning logs

from tensorflow.keras.models import load_model
import cv2
import numpy as np
import json
import requests
import time
import threading
from collections import deque

# -----------------------------
# Paths
# -----------------------------
MODEL_PATH = "./wild_animal_model.keras"
LABEL_PATH = "./class_labels.json"

# -----------------------------
# Load Model
# -----------------------------
model = load_model(MODEL_PATH)

with open(LABEL_PATH, "r") as f:
    class_labels = json.load(f)

# Reverse dictionary: index (int) -> name
class_labels = {v: k for k, v in class_labels.items()}

print("Model loaded successfully!")

# -----------------------------
# IMPROVEMENT 4: Duplicate Label Deduplication
# Maps confusingly split labels to one canonical name,
# so model confidence is no longer split between them.
# -----------------------------
LABEL_ALIASES = {
    "rhinoceros": "Rhino",
    "boar":       "Wild Boar",
    "Wild boar":  "Wild Boar",
}

# -----------------------------
# Alert Control Variables
# -----------------------------
last_alert_time = 0
ALERT_INTERVAL = 10   # seconds
last_animal = None

# -----------------------------
# Primate False-Alert Filter
# -----------------------------
PRIMATE_CLASSES = {"Monkey", "gorilla", "chimpanzee", "orangutan"}
# Humans routinely score 0.80–0.95 as primates.
# Raising to 0.99 means only a genuine, unambiguous primate detection fires.
PRIMATE_CONFIDENCE_THRESHOLD = 0.99
# Primates also require more sustained frames to confirm vs other animals.
PRIMATE_CONFIRMATION_FRAMES = 5

# -----------------------------
# IMPROVEMENT 1: Multi-Frame Confirmation
# The same animal must appear in this many consecutive frames
# before an alert is considered valid.
# -----------------------------
CONFIRMATION_FRAMES = 3
frame_streak = {"animal": None, "count": 0}

# -----------------------------
# IMPROVEMENT 6: Rolling Confidence Average
# Averages the confidence of the last 3 frames for stability.
# -----------------------------
confidence_history = deque(maxlen=3)

# -----------------------------
# IMPROVEMENT 3: Top-2 Confidence Gap
# If the top prediction and second prediction are too close,
# the model is uncertain — reject the result.
# -----------------------------
MIN_CONFIDENCE_GAP = 0.10

# -----------------------------
# Alert Function
# -----------------------------
def send_alert(animal, image_filename):
    try:
        requests.post(
            "http://localhost:5000/detect",
            json={
                "animal": animal,
                "location": "Camera 1",
                "imageUrl": f"/detections_images/{image_filename}"
            }
        )
        print("Alert sent:", animal)
    except Exception as e:
        print("Server error:", e)

# -----------------------------
# Create images folder safely
# -----------------------------
os.makedirs("detections", exist_ok=True)

# -----------------------------
# Camera Setup
# Releases rejected cameras to avoid device resource leak
# -----------------------------
cap = None

for i in range(5):
    temp_cap = cv2.VideoCapture(i)
    if temp_cap.isOpened():
        print(f"Camera detected at index {i}")
        cap = temp_cap
        break
    else:
        temp_cap.release()

if cap is None:
    print("No camera detected.")
    exit()

print("Camera started!")

# -----------------------------
# IMPROVEMENT 2: Background Subtractor for Motion Detection
# Only runs expensive model.predict() when something is moving.
# -----------------------------
bg_subtractor = cv2.createBackgroundSubtractorMOG2(
    history=500, varThreshold=50, detectShadows=False
)

def has_motion(frame, min_area=3000):
    """Returns True if a contour larger than min_area is detected in the foreground."""
    fg_mask = bg_subtractor.apply(frame)
    contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for c in contours:
        if cv2.contourArea(c) > min_area:
            return True
    return False

def check_frame_quality(frame):
    """
    IMPROVEMENT 5: Returns (is_good, reason).
    Rejects frames that are too dark or too blurry for reliable prediction.
    """
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    brightness = np.mean(gray)
    if brightness < 30:
        return False, "Too dark"
    blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
    if blur_score < 50:
        return False, "Too blurry"
    return True, "ok"

# -----------------------------
# Detection Loop
# try/finally guarantees camera is released on crash or Ctrl+C
# -----------------------------
try:
    while True:
        ret, frame = cap.read()
        if not ret:
            print("Frame error")
            break

        label = "No Animal"
        animal = "No Animal"

        # --- IMPROVEMENT 2: Motion Pre-Filter ---
        # Skip model inference entirely when the scene is static.
        if not has_motion(frame):
            cv2.putText(frame, "Monitoring...", (20, 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (120, 120, 120), 2)
            cv2.imshow("Wild Animal Detection", frame)
            if cv2.waitKey(100) & 0xFF == ord('q'):
                break
            continue

        # --- IMPROVEMENT 5: Frame Quality Check ---
        quality_ok, reason = check_frame_quality(frame)
        if not quality_ok:
            cv2.putText(frame, f"Skipped: {reason}", (20, 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 165, 255), 2)
            cv2.imshow("Wild Animal Detection", frame)
            if cv2.waitKey(100) & 0xFF == ord('q'):
                break
            continue

        # Preprocess for model
        img = cv2.resize(frame, (224, 224))
        img = (img / 255.0).astype(np.float32)
        img = np.expand_dims(img, axis=0)

        # Predict — get full softmax output
        prediction = model.predict(img, verbose=0)[0]

        # Get top-2 predictions
        top2_idx = np.argsort(prediction)[-2:][::-1]
        top1_conf = float(prediction[top2_idx[0]])
        top2_conf = float(prediction[top2_idx[1]])
        class_index = int(top2_idx[0])
        confidence = top1_conf
        conf_gap = top1_conf - top2_conf

        # --- IMPROVEMENT 3: Top-2 Gap Reject ---
        if conf_gap < MIN_CONFIDENCE_GAP:
            label = f"Uncertain ({top1_conf:.2f} vs {top2_conf:.2f})"
            frame_streak = {"animal": None, "count": 0}
            confidence_history.clear()

        elif confidence > 0.80:
            detected = class_labels[class_index]

            # --- IMPROVEMENT 4: Normalize duplicate labels ---
            detected = LABEL_ALIASES.get(detected, detected)

            # --- Primate / Human Filter ---
            if detected in PRIMATE_CLASSES and confidence < PRIMATE_CONFIDENCE_THRESHOLD:
                label = f"Filtered: {detected} ({confidence:.2f}) - possible human"
                print(label)
                frame_streak = {"animal": None, "count": 0}
                confidence_history.clear()

            else:
                # --- IMPROVEMENT 6: Rolling Confidence Average ---
                if frame_streak["animal"] == detected:
                    confidence_history.append(confidence)
                else:
                    confidence_history.clear()
                    confidence_history.append(confidence)

                avg_confidence = sum(confidence_history) / len(confidence_history)

                # --- IMPROVEMENT 1: Multi-Frame Confirmation ---
                if frame_streak["animal"] == detected:
                    frame_streak["count"] += 1
                else:
                    frame_streak["animal"] = detected
                    frame_streak["count"] = 1

                # Use stricter frame count for primate classes
                required_frames = PRIMATE_CONFIRMATION_FRAMES if detected in PRIMATE_CLASSES else CONFIRMATION_FRAMES

                if frame_streak["count"] >= required_frames:
                    animal = detected
                    label = f"{animal} ({avg_confidence:.2f}) [CONFIRMED]"
                else:
                    label = f"Confirming: {detected} [{frame_streak['count']}/{required_frames}]"

        else:
            # Confidence below threshold — reset streak
            frame_streak = {"animal": None, "count": 0}
            confidence_history.clear()

        current_time = time.time()

        if animal != "No Animal":
            if animal != last_animal and (current_time - last_alert_time > ALERT_INTERVAL):
                print("New Detection:", animal)
                cv2.imwrite("latest.jpg", frame)
                timestamp = int(current_time)
                filename = f"{animal}_{timestamp}.jpg"
                filepath = f"detections/{filename}"
                cv2.imwrite(filepath, frame)
                threading.Thread(target=send_alert, args=(animal, filename), daemon=True).start()
                last_alert_time = current_time
                last_animal = animal
            elif animal == "No Animal" and (current_time - last_alert_time > 60):
                # Reset so same animal can re-trigger after a long pause
                # (only reset when no animal is currently in frame — avoids immediate re-alert)
                last_animal = None

        # Draw label on frame
        cv2.putText(frame, label, (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

        cv2.imshow("Wild Animal Detection", frame)

        # waitKey(100) controls frame pacing (~10 FPS) and captures keypresses
        if cv2.waitKey(100) & 0xFF == ord('q'):
            break

finally:
    cap.release()
    cv2.destroyAllWindows()
    print("Camera released. Exited cleanly.")
