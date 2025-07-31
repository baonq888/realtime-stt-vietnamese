from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from starlette.websockets import WebSocketDisconnect
import aiohttp
import tempfile
import soundfile as sf
from backend.audio_processing import preprocess_audio
from backend.keys import FPT_API_KEY, FPT_API_URL

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


BUFFER_DURATION = 2  # giây
RATE = 16000  # sample rate (Hz)
BYTES_PER_SAMPLE = 2  # 16-bit PCM
CHANNELS = 1

# Kích thước buffer: 2s x 16000 Hz x 2 bytes = 64000 bytes
BUFFER_SIZE = BUFFER_DURATION * RATE * BYTES_PER_SAMPLE * CHANNELS


@app.websocket("/ws/stt")
async def websocket_stt(websocket: WebSocket):
    await websocket.accept()
    audio_buffer = bytearray()

    try:
        while True:
            audio_chunk = await websocket.receive_bytes()
            audio_buffer += audio_chunk

            if len(audio_buffer) >= BUFFER_SIZE:
                processed_audio = preprocess_audio(audio_buffer)

                # Write to .wav file
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_wav:
                    sf.write(tmp_wav.name, processed_audio, RATE, subtype='PCM_16')

                async with aiohttp.ClientSession() as session:
                    with open(tmp_wav.name, "rb") as f:
                        headers = {
                            "api-key": FPT_API_KEY,
                            "voice": "banmai",  
                        }
                        response = await session.post(FPT_API_URL, data=f, headers=headers)
                        result = await response.json()

                        text = result.get("hypotheses", [{}])[0].get("utterance", "")
                        if text:
                            await websocket.send_text(text)

                audio_buffer = bytearray()  

    except WebSocketDisconnect:
        print("Client disconnected.")
    except Exception as e:
        print("Error:", e)
        await websocket.close()