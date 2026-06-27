import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
import json
import time
import threading
import requests
import cv2
import numpy as np
from collections import deque
from tensorflow.keras.models import load_model
import pygame  # For deterrent sound playback

# Silence TensorFlow logs
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

# --- Configuration ---
MODEL_PATH = "./wild_animal_model.keras"
LABEL_PATH = "./class_labels.json"
ALERT_INTERVAL = 10  # Seconds between alerts
CONFIRMATION_FRAMES = 2
MIN_CONFIDENCE_GAP = 0.10

# --- State Variables ---
last_alert_time = 0
last_animal = None
frame_streak = {"animal": None, "count": 0}
confidence_history = deque(maxlen=3)

# Filter for possible human detections (using primate labels)
PRIMATE_CLASSES = {"Monkey", "gorilla", "chimpanzee", "orangutan"}
PRIMATE_CONFIDENCE_THRESHOLD = 0.99
PRIMATE_CONFIRMATION_FRAMES = 5

# Label Normalization (Deduplication)
LABEL_ALIASES = {
    "rhinoceros": "Rhino",
    "boar": "Wild Boar",
    "Wild boar": "Wild Boar",
}

# --- Initialization ---
print("Loading model...")
model = load_model(MODEL_PATH)
with open(LABEL_PATH, "r") as f:
    class_labels = {v: k for k, v in json.load(f).items()}
print("Model loaded successfully!")

# Initialize Audio Mixer
pygame.mixer.init()

# Deterrent Sound Mapping (Match labels or aliases)
ANIMAL_SOUND_MAP = {
    # 1. Apex Predators
    "Lion": "apex_predators.wav", "Tiger": "apex_predators.wav", 
    "Leopard": "apex_predators.wav", "Cheetah": "apex_predators.wav", 
    "Jaguar": "apex_predators.wav",
    
    # 2. Large Herbivores
    "Elephant": "large_herbivores.wav", "Rhino": "large_herbivores.wav", 
    "Buffalo": "large_herbivores.wav", "Hippopotamus": "large_herbivores.wav", 
    "Bison": "large_herbivores.wav",
    
    # 3. Primates
    "Monkey": "primates.wav", "chimpanzee": "primates.wav", 
    "gorilla": "primates.wav", "orangutan": "primates.wav",
    
    # 4. Predatory Canines/Scavengers
    "Wolf": "canine_predators.wav", "coyote": "canine_predators.wav", 
    "hyena": "canine_predators.wav", "Fox": "canine_predators.wav",
    
    # 5. Wild Boars (Note: Uses aliased name "Wild Boar")
    "Wild Boar": "wild_boar.wav",
}
DEFAULT_SOUND = "general_deterrent.wav"

os.makedirs("detections", exist_ok=True)
os.makedirs("sounds", exist_ok=True)

def send_alert(animal, image_filename):
    """Sends detection alert to the backend server."""
    try:
        requests.post(
            "http://localhost:5000/detect",
            json={
                "animal": animal,
                "location": "Camera 1",
                "imageUrl": f"/detections_images/{image_filename}"
            },
            timeout=5
        )
        print(f"Alert sent: {animal}")
    except Exception as e:
        print(f"Alert failed: {e}")

def play_deterrent(animal):
    """Plays the mapped deterrent sound in the background."""
    try:
        sound_file = ANIMAL_SOUND_MAP.get(animal, DEFAULT_SOUND)
        sound_path = os.path.join("sounds", sound_file)
        
        if os.path.exists(sound_path):
            print(f"🔊 Playing deterrent for {animal}: {sound_file}")
            pygame.mixer.music.load(sound_path)
            pygame.mixer.music.play()
        else:
            print(f"⚠️  Sound file missing: {sound_path}")
    except Exception as e:
        print(f"Audio error: {e}")

# --- Camera Setup ---
cap = None
for i in range(5):
    temp_cap = cv2.VideoCapture(i)
    if temp_cap.isOpened():
        cap = temp_cap
        print(f"Using Camera Index {i}")
        break
    temp_cap.release()

if cap is None:
    print("Error: No camera found.")
    exit()

bg_subtractor = cv2.createBackgroundSubtractorMOG2(history=500, varThreshold=50, detectShadows=False)

def has_motion(frame, min_area=3000):
    fg_mask = bg_subtractor.apply(frame)
    contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return any(cv2.contourArea(c) > min_area for c in contours)

def check_frame_quality(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    brightness = np.mean(gray)
    if brightness < 30: return False, "Too dark"
    if cv2.Laplacian(gray, cv2.CV_64F).var() < 50: return False, "Too blurry"
    return True, "ok"

# --- Main Monitoring Loop ---
try:
    while True:
        ret, frame = cap.read()
        if not ret: break

        label = "Monitoring..."
        detected_animal = "No Animal"

        # 1. Motion Filter - Skip expensive AI if no movement
        if has_motion(frame):
            quality_ok, reason = check_frame_quality(frame)
            
            if not quality_ok:
                label = f"Skipped: {reason}"
            else:
                # 2. AI Prediction
                img = cv2.resize(frame, (224, 224))
                img = (img / 255.0).astype(np.float32)
                img = np.expand_dims(img, axis=0)
                
                prediction = model.predict(img, verbose=0)[0]
                top2_idx = np.argsort(prediction)[-2:][::-1]
                top1_conf = float(prediction[top2_idx[0]])
                top2_conf = float(prediction[top2_idx[1]])
                
                detected = class_labels[int(top2_idx[0])]
                detected = LABEL_ALIASES.get(detected, detected)
                
                # 3. Confidence & Human Detection Filter
                if (top1_conf - top2_conf) < MIN_CONFIDENCE_GAP:
                    label = "Uncertain detection"
                    frame_streak = {"animal": None, "count": 0}
                    confidence_history.clear()
                elif top1_conf > 0.80:
                    # PRESERVE: Human detection logic (primates with low confidence are likely humans)
                    if detected in PRIMATE_CLASSES and top1_conf < PRIMATE_CONFIDENCE_THRESHOLD:
                        label = f"Filtered: Possible human ({detected} {top1_conf:.2f})"
                        frame_streak = {"animal": None, "count": 0}
                        confidence_history.clear()
                    else:
                        # 4. Multi-frame Confirmation
                        if frame_streak["animal"] == detected:
                            frame_streak["count"] += 1
                            confidence_history.append(top1_conf)
                        else:
                            frame_streak = {"animal": detected, "count": 1}
                            confidence_history.clear()
                            confidence_history.append(top1_conf)

                        required_frames = PRIMATE_CONFIRMATION_FRAMES if detected in PRIMATE_CLASSES else CONFIRMATION_FRAMES
                        avg_conf = sum(confidence_history) / len(confidence_history)

                        if frame_streak["count"] >= required_frames:
                            detected_animal = detected
                            label = f"{detected_animal} ({avg_conf:.2f}) [CONFIRMED]"
                        else:
                            label = f"Confirming: {detected} ({frame_streak['count']}/{required_frames})"
                else:
                    frame_streak = {"animal": None, "count": 0}
                    confidence_history.clear()

        # 5. Alert Triggering
        current_time = time.time()
        if detected_animal != "No Animal":
            if detected_animal != last_animal and (current_time - last_alert_time > ALERT_INTERVAL):
                filename = f"{detected_animal}_{int(current_time)}.jpg"
                cv2.imwrite(f"detections/{filename}", frame)
                cv2.imwrite("latest.jpg", frame)
                threading.Thread(target=send_alert, args=(detected_animal, filename), daemon=True).start()
                # Play deterrent sound
                threading.Thread(target=play_deterrent, args=(detected_animal,), daemon=True).start()
                last_alert_time = current_time
                last_animal = detected_animal
        elif (current_time - last_alert_time > 60):
            last_animal = None  # Reset after 60s of silence to allow re-detecting same animal

        # 6. UI Update
        cv2.putText(frame, label, (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
        cv2.imshow("WildGuard Monitoring", frame)
        
        if cv2.waitKey(100) & 0xFF == ord('q'):
            break

finally:
    if cap: cap.release()
    cv2.destroyAllWindows()
    print("System shut down cleanly.")
