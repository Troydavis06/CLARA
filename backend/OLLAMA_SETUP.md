# Ollama Setup for Local LLM

CLARA now supports both **Gemini (cloud API)** and **Ollama (local LLM)** backends.

## Quick Setup

### 1. Install Ollama
Download from: https://ollama.ai/download

### 2. Pull Llama 3.2 Model
```bash
ollama pull llama3.2
```

This downloads ~2GB model weights. First run may take a few minutes.

### 3. Configure Backend
Edit `backend/.env`:
```env
# Switch from Gemini to Ollama
LLM_PROVIDER=ollama
OLLAMA_MODEL=llama3.2
```

### 4. Restart Backend
```bash
cd backend
python -m uvicorn main:app --reload
```

## Switching Back to Gemini

Edit `backend/.env`:
```env
LLM_PROVIDER=gemini
```

Restart the backend server.

## Available Models

You can use any Ollama model:
- `llama3.2` (3B params, fast, ~2GB)
- `llama3.1` (8B params, better quality, ~4.7GB)
- `mistral` (7B params, ~4GB)
- `codellama` (7B params, ~3.8GB)

Just update `OLLAMA_MODEL` in `.env` and ensure the model is pulled.

## Performance Notes

- **CPU inference**: Slow (10-60s per response depending on hardware)
- **GPU inference**: Much faster (1-5s per response with NVIDIA GPU)
- Ollama automatically uses GPU if available
- For demo/testing, use the pre-generated golden files (Demo Mode checkbox) to bypass LLM calls entirely

## Troubleshooting

**"Model not found"**: Run `ollama pull <model>` first
**Slow responses**: Expected on CPU - upgrade to GPU or use smaller model
**Connection refused**: Ensure Ollama service is running (`ollama serve`)
