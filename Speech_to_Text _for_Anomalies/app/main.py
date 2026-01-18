from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import whisper
import tempfile
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from app.distress import is_unsafe

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = None

def get_model():
    global model
    if model is None:
        logger.info("Loading Whisper model...")
        model = whisper.load_model("base")
        logger.info("✅ Whisper model loaded!")
    return model

@app.post("/analyze-voice")
async def analyze_voice(file: UploadFile = File(...)):
    import time
    start_time = time.time()
    
    logger.info(f"========== NEW REQUEST ==========")
    logger.info(f"Received: {file.filename}, type: {file.content_type}")
    
    audio_bytes = await file.read()
    logger.info(f"Read {len(audio_bytes)} bytes")

    # Save directly as WAV - no conversion needed!
    temp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    
    try:
        temp.write(audio_bytes)
        temp.close()
        
        logger.info(f"Starting transcription of {temp.name}...")
        result = get_model().transcribe(
            temp.name,
            task="translate",
            fp16=False,
            language=None,
            beam_size=1,
            best_of=1
        )
        
        logger.info(f"✅ Transcription complete")

        english_text = result["text"].strip()
        unsafe = is_unsafe(english_text)
        
        total_time = time.time() - start_time
        logger.info(f"Total: {total_time:.2f}s - '{english_text}' - Unsafe: {unsafe}")

        return {
            "unsafe": unsafe,
            "english_text": english_text,
            "trigger": "VOICE_HELP" if unsafe else "NONE"
        }

    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        if os.path.exists(temp.name):
            os.unlink(temp.name)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)