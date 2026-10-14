FROM python:3.11-slim

# Model baked into the image so containers start without downloading it.
ARG EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/home/appuser/.cache/huggingface \
    EMBEDDING_MODEL=${EMBEDDING_MODEL} \
    PORT=8001

WORKDIR /app

RUN useradd --create-home appuser

# CPU-only torch keeps the image several GB smaller than the default CUDA build.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

USER appuser
RUN python -c "import os; from sentence_transformers import SentenceTransformer; SentenceTransformer(os.environ['EMBEDDING_MODEL'])"

COPY --chown=appuser:appuser app ./app

EXPOSE 8001
# Same port as v1, so the backend's Mf03Integration:BaseUrl does not change.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8001}"]
