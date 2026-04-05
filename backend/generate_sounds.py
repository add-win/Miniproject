import wave
import numpy as np
import os

def generate_tone(filename, freq, duration=3, sample_rate=44100, pulse_freq=5):
    """Generates a pulsing deterrent tone as a .wav file."""
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    
    # Base tone
    tone = 0.5 * np.sin(2 * np.pi * freq * t)
    
    # Low-frequency wave to create a pulsing/siren effect (annoying to animals)
    pulse = 0.5 * (1 + np.sin(2 * np.pi * pulse_freq * t))
    audio_data = tone * pulse
    
    # Convert to 16-bit PCM
    audio_data = (audio_data * 32767).astype(np.int16)
    
    path = os.path.join("sounds", filename)
    with wave.open(path, 'w') as f:
        f.setnchannels(1)  # Mono
        f.setsampwidth(2)  # 16-bit
        f.setframerate(sample_rate)
        f.writeframes(audio_data.tobytes())
    print(f"Generated: {path} ({freq}Hz)")

# Ensure directory exists
os.makedirs("sounds", exist_ok=True)

# Generate sound files with various deterrent frequencies
generate_tone("apex_predators.wav", 880, pulse_freq=8)    # High pulsing
generate_tone("large_herbivores.wav", 440, pulse_freq=4)   # Deep pulsing
generate_tone("primates.wav", 1500, pulse_freq=12)         # Ultra-sharp
generate_tone("canine_predators.wav", 2000, pulse_freq=15) # Extreme sharp
generate_tone("wild_boar.wav", 550, pulse_freq=6)          # Aggressive
generate_tone("general_deterrent.wav", 1000, pulse_freq=10) # Standard alarm
