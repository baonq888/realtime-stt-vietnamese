import numpy as np
import scipy.signal
import soundfile as sf
import noisereduce as nr

BUFFER_DURATION = 2
RATE = 16000  # Hz
BYTES_PER_SAMPLE = 2  # 16-bit PCM
CHANNELS = 1
BUFFER_SIZE = BUFFER_DURATION * RATE * BYTES_PER_SAMPLE * CHANNELS

def preprocess_audio(raw_bytes: bytes) -> np.ndarray:
    audio_np = np.frombuffer(raw_bytes, dtype=np.int16)

    # Normalize về float32 [-1, 1]
    audio_norm = audio_np.astype(np.float32) / 32768.0

    audio_denoised = nr.reduce_noise(y=audio_norm, sr=RATE)

    # High-pass filter
    sos = scipy.signal.butter(10, 80, btype='highpass', fs=RATE, output='sos')
    filtered_audio = scipy.signal.sosfilt(sos, audio_denoised)

    processed_int16 = (filtered_audio * 32767).astype(np.int16)
    return processed_int16