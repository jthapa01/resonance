"""Chatterbox TTS API - Text-to-speech with voice cloning on Modal."""

import modal

# Secrets are read from Modal at container start, never from .env.
# Create the azure-storage secret from a temp file holding ONLY the two Azure vars
# (avoids leaking the connection string into shell history, and avoids shipping
# unrelated .env values such as Clerk/DATABASE_URL into the GPU container):
#   modal secret create azure-storage --from-dotenv .env.modal.azure
# Then delete that temp file. The other two secrets:
#   modal secret create chatterbox-api-key CHATTERBOX_API_KEY=<key>
#   modal secret create hf-token HF_TOKEN=<huggingface-read-token>

# Use this to test locally:
# modal run chatterbox_tts.py \
#   --prompt "Hello from Chatterbox [chuckle]." \
#   --voice-key "voices/system/<voice-id>"

# Use this to test CURL:
# curl -X POST "https://<your-modal-endpoint>/generate" \
#   -H "Content-Type: application/json" \
#   -H "X-Api-Key: <your-api-key>" \
#   -d '{"prompt": "Hello from Chatterbox [chuckle].", "voice_key": "voices/system/<voice-id>"}' \
#   --output output.wav

# Modal setup
image = modal.Image.debian_slim(python_version="3.10").uv_pip_install(
    "azure-storage-blob==12.27.1",
    "chatterbox-tts==0.1.6",
    "fastapi[standard]==0.124.4",
    "peft==0.18.0",
).env({"HF_HOME": "/cache/huggingface"})
app = modal.App("chatterbox-tts", image=image)

# Persists model weights across containers so only the very first cold start downloads them.
hf_cache = modal.Volume.from_name("chatterbox-hf-cache", create_if_missing=True)

with image.imports():
    import hashlib
    import io
    import os
    from pathlib import Path

    import torch  # pyright: ignore[reportMissingImports]
    import torchaudio as ta  # pyright: ignore[reportMissingImports]
    from azure.core.exceptions import ResourceNotFoundError
    from azure.storage.blob import BlobServiceClient
    from chatterbox.tts_turbo import ChatterboxTurboTTS  # pyright: ignore[reportMissingImports]
    from fastapi import (
        Depends,
        FastAPI,
        HTTPException,
        Security,
    )
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import StreamingResponse
    from fastapi.security import APIKeyHeader
    from pydantic import BaseModel, Field

    api_key_scheme = APIKeyHeader(
        name="x-api-key",
        scheme_name="ApiKeyAuth",
        auto_error=False,
    )

    def verify_api_key(x_api_key: str | None = Security(api_key_scheme)):
        expected = os.environ.get("CHATTERBOX_API_KEY", "")
        if not expected or x_api_key != expected:
            raise HTTPException(status_code=403, detail="Invalid API key")
        return x_api_key

    class TTSRequest(BaseModel):
        """Request model for text-to-speech generation."""

        prompt: str = Field(..., min_length=1, max_length=5000)
        voice_key: str = Field(..., min_length=1, max_length=300)
        temperature: float = Field(default=0.8, ge=0.0, le=2.0)
        top_p: float = Field(default=0.95, ge=0.0, le=1.0)
        top_k: int = Field(default=1000, ge=1, le=10000)
        repetition_penalty: float = Field(default=1.2, ge=1.0, le=2.0)
        norm_loudness: bool = Field(default=True)


def trim_silence(wav, sr: int, threshold: float = 0.02, pad_ms: int = 60):
    """Strip leading/trailing near-silence from a generated segment. Turbo generates up
    to a 1000-token (~40s) cap, so a chunk that does not cleanly hit EOS comes back with
    a long silent tail that would otherwise be stitched into the final audio."""
    envelope = wav.abs().amax(dim=0)
    peak = envelope.max()
    if peak <= 0:
        return wav

    loud = (envelope > threshold * peak).nonzero()
    if loud.numel() == 0:
        return wav

    pad = int(sr * pad_ms / 1000)
    start = max(0, int(loud[0].item()) - pad)
    end = min(wav.shape[1], int(loud[-1].item()) + pad)
    return wav[:, start:end]


def split_text(text: str, max_chars: int = 250) -> list[str]:
    """Split long text into sentence-grouped chunks. Chatterbox degrades past a few
    sentences per call and its own demo apps cap input at 300 chars, so long-form input
    must be synthesized chunk-by-chunk. Punctuation is left as-is because the library's
    punc_norm() already normalizes it inside generate()."""
    import re

    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []

    # Semicolons and colons are clause breaks the model handles like sentence ends.
    sentences = re.split(r"(?<=[.!?;:])\s+", text)
    chunks: list[str] = []
    current = ""

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        # Fall back to comma breaks, then word boundaries, for overlong sentences.
        while len(sentence) > max_chars:
            head = sentence[:max_chars]
            cut = head.rfind(", ")
            if cut > 0:
                cut += 1
            else:
                cut = head.rfind(" ")
            if cut <= 0:
                cut = max_chars
            chunks.append(sentence[:cut].strip())
            sentence = sentence[cut:].strip()

        if not current:
            current = sentence
        elif len(current) + 1 + len(sentence) <= max_chars:
            current = f"{current} {sentence}"
        else:
            chunks.append(current)
            current = sentence

    if current:
        chunks.append(current)

    return chunks


@app.cls(
    gpu="a10g",
    scaledown_window=60 * 5,
    volumes={"/cache/huggingface": hf_cache},
    secrets=[
        modal.Secret.from_name("hf-token"),
        modal.Secret.from_name("chatterbox-api-key"),
        modal.Secret.from_name("azure-storage"),
    ],
)
@modal.concurrent(max_inputs=10)
class Chatterbox:
    @modal.enter()
    def load_model(self):
        self.model = ChatterboxTurboTTS.from_pretrained(device="cuda")
        blob_service = BlobServiceClient.from_connection_string(
            os.environ["AZURE_STORAGE_CONNECTION_STRING"],
        )
        self.voice_container = blob_service.get_container_client(
            os.environ["AZURE_STORAGE_CONTAINER"],
        )

    def download_voice(self, voice_key: str) -> Path:
        cache_dir = Path("/tmp/chatterbox-voices")
        cache_dir.mkdir(parents=True, exist_ok=True)
        cache_name = hashlib.sha256(voice_key.encode()).hexdigest()
        voice_path = cache_dir / f"{cache_name}{Path(voice_key).suffix or '.wav'}"

        if not voice_path.exists():
            partial_path = voice_path.with_suffix(f"{voice_path.suffix}.part")
            with partial_path.open("wb") as output:
                self.voice_container.download_blob(voice_key).readinto(output)
            partial_path.replace(voice_path)

        return voice_path

    @modal.method()
    def generate(
        self,
        prompt: str,
        voice_key: str,
        temperature: float = 0.8,
        top_p: float = 0.95,
        top_k: int = 1000,
        repetition_penalty: float = 1.2,
        norm_loudness: bool = True,
    ):
        audio_prompt_path = self.download_voice(voice_key)
        chunks = split_text(prompt) or [prompt]

        segments = [
            trim_silence(
                self.model.generate(
                    chunk,
                    audio_prompt_path=str(audio_prompt_path),
                    temperature=temperature,
                    top_p=top_p,
                    top_k=top_k,
                    repetition_penalty=repetition_penalty,
                    norm_loudness=norm_loudness,
                ),
                self.model.sr,
            )
            for chunk in chunks
        ]

        if len(segments) == 1:
            wav = segments[0]
        else:
            # 0.3s of silence between chunks keeps sentence pacing natural.
            gap = segments[0].new_zeros(1, int(0.3 * self.model.sr))
            joined: list = []
            for index, segment in enumerate(segments):
                if index:
                    joined.append(gap)
                joined.append(segment)
            wav = torch.cat(joined, dim=1)

        buffer = io.BytesIO()
        ta.save(buffer, wav, self.model.sr, format="wav")
        buffer.seek(0)
        return buffer.read()


@app.function(secrets=[modal.Secret.from_name("chatterbox-api-key")])
@modal.asgi_app()
def serve():
    web_app = FastAPI(
        title="Chatterbox TTS API",
        description="Text-to-speech with voice cloning",
        docs_url="/docs",
        dependencies=[Depends(verify_api_key)],
    )
    web_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @web_app.post("/generate", responses={200: {"content": {"audio/wav": {}}}})
    def generate_speech(request: TTSRequest):
        try:
            audio_bytes = Chatterbox().generate.remote(
                request.prompt,
                request.voice_key,
                request.temperature,
                request.top_p,
                request.top_k,
                request.repetition_penalty,
                request.norm_loudness,
            )
            return StreamingResponse(
                io.BytesIO(audio_bytes),
                media_type="audio/wav",
            )
        except ResourceNotFoundError:
            raise HTTPException(
                status_code=404,
                detail=f"Voice not found at '{request.voice_key}'",
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate audio: {e}",
            )

    return web_app


@app.local_entrypoint()
def test(
    prompt: str = "Chatterbox running on Modal [chuckle].",
    voice_key: str = "voices/system/default.wav",
    output_path: str = "/tmp/chatterbox-tts/output.wav",
    temperature: float = 0.8,
    top_p: float = 0.95,
    top_k: int = 1000,
    repetition_penalty: float = 1.2,
    norm_loudness: bool = True,
):
    import pathlib

    chatterbox = Chatterbox()
    audio_bytes = chatterbox.generate.remote(
        prompt=prompt,
        voice_key=voice_key,
        temperature=temperature,
        top_p=top_p,
        top_k=top_k,
        repetition_penalty=repetition_penalty,
        norm_loudness=norm_loudness,
    )

    output_file = pathlib.Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_bytes(audio_bytes)
    print(f"Audio saved to {output_file}")