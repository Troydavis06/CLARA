# Vertex AI Setup Guide

This guide explains how to configure CLARA to use Google Vertex AI instead of the standard Gemini API.

## Configuration Options

CLARA now supports two ways to use Google's Gemini models:

### Option 1: Vertex AI with Project (Recommended for Production)

Use this if you have a GCP project and want to use Vertex AI:

```env
# .env configuration
VERTEX_PROJECT_ID=your-gcp-project-id
VERTEX_LOCATION=us-central1
GEMINI_MODEL=gemini-2.0-flash-exp
LLM_PROVIDER=gemini
```

**Requirements:**
- GCP project with Vertex AI API enabled
- Authenticated via Application Default Credentials (ADC)
  - Run: `gcloud auth application-default login`
  - Or use a service account key

### Option 2: Gemini API with API Key (Simple Setup)

Use this for quick testing with just an API key:

```env
# .env configuration
VERTEX_API_KEY=AIzaSyAXVGft8tnoAXj-mFb6zjc7_DadLjOWHxE
GEMINI_MODEL=gemini-2.0-flash-exp
LLM_PROVIDER=gemini
```

**Note:** You can also use `GEMINI_API_KEY` instead of `VERTEX_API_KEY` - both work.

## Setup Steps

### For Vertex AI (Option 1)

1. **Enable Vertex AI API** in your GCP project:
   ```bash
   gcloud services enable aiplatform.googleapis.com
   ```

2. **Authenticate** using one of these methods:

   **Method A: Application Default Credentials (for development)**
   ```bash
   gcloud auth application-default login
   ```

   **Method B: Service Account (for production)**
   ```bash
   # Create service account
   gcloud iam service-accounts create clara-vertex-ai
   
   # Grant permissions
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member="serviceAccount:clara-vertex-ai@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/aiplatform.user"
   
   # Create and download key
   gcloud iam service-accounts keys create key.json \
     --iam-account=clara-vertex-ai@YOUR_PROJECT_ID.iam.gserviceaccount.com
   
   # Set environment variable
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"
   ```

3. **Update .env file**:
   ```env
   VERTEX_PROJECT_ID=your-actual-project-id
   VERTEX_LOCATION=us-central1  # or your preferred region
   GEMINI_MODEL=gemini-2.0-flash-exp
   LLM_PROVIDER=gemini
   ```

4. **Test the setup**:
   ```bash
   cd backend
   python -c "from pipeline.llm_utils import generate_with_backoff; print(generate_with_backoff('Say hi', 'You are helpful'))"
   ```

### For API Key (Option 2)

1. **Get your API key** from [Google AI Studio](https://aistudio.google.com/app/apikey)

2. **Update .env file**:
   ```env
   VERTEX_API_KEY=AIzaSyAXVGft8tnoAXj-mFb6zjc7_DadLjOWHxE
   GEMINI_MODEL=gemini-2.0-flash-exp
   LLM_PROVIDER=gemini
   ```

3. **Test the setup**:
   ```bash
   cd backend
   python -c "from pipeline.llm_utils import generate_with_backoff; print(generate_with_backoff('Say hi', 'You are helpful'))"
   ```

## Available Models

- `gemini-2.0-flash-exp` - Latest experimental Gemini 2.0 Flash
- `gemini-1.5-pro` - Gemini 1.5 Pro
- `gemini-1.5-flash` - Gemini 1.5 Flash
- `gemini-1.0-pro` - Gemini 1.0 Pro (legacy)

## Switching Between Providers

You can easily switch between Gemini and Ollama by changing the `LLM_PROVIDER` variable:

```env
# Use Gemini/Vertex AI
LLM_PROVIDER=gemini

# Use local Ollama
LLM_PROVIDER=ollama
OLLAMA_MODEL=llama3.2
```

## Troubleshooting

### "GEMINI_API_KEY not found"
- Make sure you've set either `VERTEX_API_KEY`, `GEMINI_API_KEY`, or `VERTEX_PROJECT_ID`
- Check that the .env file is in the `backend/` directory

### "Permission denied" with Vertex AI
- Ensure your service account has the `roles/aiplatform.user` role
- Verify `GOOGLE_APPLICATION_CREDENTIALS` points to a valid key file

### "Region not supported"
- Try changing `VERTEX_LOCATION` to `us-central1` or another supported region
- Check [Vertex AI locations](https://cloud.google.com/vertex-ai/docs/general/locations)

### Rate limiting
- The system automatically retries with exponential backoff
- Consider upgrading your quota in GCP Console for Vertex AI
- For API keys, check your quota at [Google AI Studio](https://aistudio.google.com/)

## Cost Considerations

- **Vertex AI**: Pay per request/token, may have higher limits
- **Gemini API**: Free tier available, then pay per request
- Check current pricing: https://ai.google.dev/pricing

## Security Best Practices

1. **Never commit API keys** to git - they're in .gitignore
2. **Use service accounts** for production deployments
3. **Rotate keys regularly** 
4. **Limit API key permissions** to only what's needed
5. **Monitor usage** in GCP Console to detect anomalies
