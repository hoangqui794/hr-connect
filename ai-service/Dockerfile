FROM python:3.11-slim

# Model baked into the image so containers start without downloading it.
# Override with --build-arg EMBEDDING_MODEL=... and set the same EMBEDDING_MODEL at runtime.
ARG EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/home/appuser/.cache/huggingface \
    EMBEDDING_MODEL=${EMBEDDING_MODEL} \
    PORT=8001

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home appuser

# CPU-only torch keeps the image several GB smaller than the default CUDA build.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

USER appuser
RUN python -c "import os; from sentence_transformers import SentenceTransformer; SentenceTransformer(os.environ['EMBEDDING_MODEL'])"

COPY --chown=appuser:appuser app ./app

EXPOSE 8001
# Render injects PORT; locally it falls back to 8001.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8001}"]
