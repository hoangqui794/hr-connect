# HR Connect MF-03 AI Matching Service

Standalone FastAPI service for CV ingestion and explainable candidate/job matching. It accepts PDF, DOCX, PNG, JPEG, or structured JSON and never accesses PostgreSQL.

## Decision-support boundary

The service returns evidence and an experimental `MatchScore` only. It never returns `SHORTLIST`, `REJECT`, or `HIRE`, never changes an Application status, and never determines `MatchTier`. ASP.NET Core will map scores to `MatchTierConfig`; a human reviewer makes every recruitment decision. AI failure must route to manual review, not rejection.

## Pipeline

`CV → safe validation → layout-aware PDF/DOCX extraction or OCR → structured CV parsing → deterministic MUST_HAVE/SHOULD_HAVE matching → Sentence-BERT embeddings (`paraphrase-multilingual-MiniLM-L12-v2`, see `EMBEDDING_MODEL_EVALUATION.md`) → chunk-level cosine similarity (CV and JD split into chunks, rescaled) → optional cross-encoder evidence reranking → bounded semantic partial credit for soft requirements → experimental score → deterministic evidence → JSON`

Rule matching and semantic similarity are separate. A high semantic score does not silently turn a missing MUST_HAVE into a deterministic match. Explanations are generated only from observed evidence; no LLM is used.

Each requirement has one evidence state:

- `MATCHED`: sufficient deterministic evidence was found.
- `PARTIAL`: some required evidence was found, but the requirement is not fully proven.
- `NOT_FOUND`: the relevant CV content was read reliably and no evidence was found.
- `UNKNOWN`: the relevant CV content could not be read reliably; this is not treated as candidate absence.

`UNKNOWN` contributes zero deterministic coverage, disables the semantic contribution to the experimental score, and requires manual review. Semantic suggestions are review hints only and never promote an unproven requirement.

## Experimental scoring

The initial weights are `MUST_HAVE=0.50`, `SHOULD_HAVE=0.20`, and `SEMANTIC=0.30`. **EXPERIMENTAL ONLY — NOT AN APPROVED OR FINAL BUSINESS RULE.** They are environment configuration and must total `1.0`. The returned score is `0–100`; `MatchScore != MatchTier`.

## Run locally

Requires Python 3.11+.

```powershell
cd ai-service
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8001
```

- Swagger: <http://localhost:8001/docs>
- Health: <http://localhost:8001/health>
- Integration readiness: <http://localhost:8001/ready>
- Matching: `POST http://localhost:8001/api/v1/match`
- Parse CV: `POST http://localhost:8001/api/v1/cv/parse`
- Parse and match CV: `POST http://localhost:8001/api/v1/match-file`
- Background scoring intake: `POST http://localhost:8001/api/v1/scoring-jobs` (`X-Service-Token` required)

## MF-02 background integration

MF-02 commits the Application and a durable `ai_match_result` row with status `PENDING` in the same database transaction, then returns submission success. A hosted dispatcher sends pending work to this service; the Candidate/Affiliate request does not wait for PDF parsing or matching.

The AI worker then calls HR Connect internal endpoints to obtain a temporary CV download URL and the JD, parses and matches the CV, and posts the result back. The AI service does not connect to PostgreSQL and does not receive R2 credentials.

The callback includes non-PII review metadata: `parseConfidence`, `requiresManualReview`, `warnings`, `diagnostics`, `semanticScore`, `missingRequirements`, `matchingReasons`, and SHA-256 fingerprints of the CV bytes and canonical JD. HR Connect persists that safe envelope in the existing attempt result; raw CV text, presigned URLs, service tokens, email, and phone are excluded from it.

Use the same long random secret in both processes:

```powershell
# Use the same value in both terminals
$env:HRCONNECT_SERVICE_TOKEN="replace-with-a-long-random-secret"
$env:MF03_BASE_URL="http://127.0.0.1:8001"

# Terminal running ai-service
$env:HRCONNECT_SERVICE_TOKEN="replace-with-a-long-random-secret"
$env:HRCONNECT_BASE_URL="https://localhost:7289"
$env:HRCONNECT_VERIFY_SSL="false" # local HTTPS only; use true with a trusted production certificate
```

The internal endpoints are:

- `GET /api/v1/internal/cvs/{cvId}/download-url`
- `GET /api/v1/internal/jobs/{jobId}/jd`
- `POST /api/v1/internal/ai-results`
- `GET /api/v1/internal/ai-results/{applicationId}`

All require `X-Service-Token`. A timed-out `PROCESSING` job is returned to the dispatch path so a stopped AI process does not permanently lose the scoring request. The presigned storage download is made without this header so the service token is never sent to Cloudflare R2.

The first real matching request may download and load the configured `EMBEDDING_MODEL` (the Docker image bakes it in). The first OCR request may download EasyOCR's Vietnamese/English models. Both model families are lazily loaded and cached. Model files and Hugging Face caches are excluded from Git.

## Logging and audit

The service writes structured JSON logs to stdout. Scoring events carry `requestId`, `applicationId`, `cvId`, `jobId`, and `attemptNo` so they can be correlated with HR Connect's `ai_match_result` and `audit_log` records. Configure verbosity with `LOG_LEVEL`.

Logs intentionally omit CV text, structured CV content, presigned download URLs, and service tokens. HR Connect owns durable status/result persistence and business audit records; the standalone AI service does not write directly to PostgreSQL.

## Internal structure

- `app/api`: thin FastAPI transport layer.
- `app/clients`: outbound HR Connect HTTP boundary.
- `app/core/dependencies.py`: shared cached parser/model factories.
- `app/services/scoring_queue.py`: bounded in-process work queue.
- `app/services/scoring_orchestrator.py`: one-job parse, match, and callback workflow.
- `app/services/scoring_worker.py`: compatibility imports for older callers; new code should import the queue or orchestrator directly.

The in-process queue is suitable for local and initial standalone operation. HR Connect remains the durable owner of `PENDING`/`PROCESSING` work and can redispatch timed-out jobs. A production deployment with multiple AI processes will require a shared durable queue.

`/api/v1/cv/parse` uses multipart form data with a `file` field. `/api/v1/match-file` uses a `file` field plus a `metadata` JSON string containing `requestId`, `applicationId`, `attemptNo`, and `job`.

Files are processed for the request only and are not persisted by this standalone service. Default safeguards limit uploads to 10 MB, PDFs to 20 pages, images to 40 million pixels, DOCX archive expansion to 50 MB, and extracted text to 100,000 characters. The service validates file signatures instead of trusting the filename or declared content type.

Digital PDFs are read as positioned text blocks. The parser detects common one-column and two-column/sidebar layouts, reconstructs reading order per column, and exposes `document.layout`. Structured parsing searches contact and language evidence globally, supports numeric and English/Vietnamese month ranges, and returns `parseConfidence`, `requiresManualReview`, and machine-readable warnings. Low-confidence fields remain `null` instead of being guessed.

MF-03 does not calculate Qualified/Counted CV, Service Fee, Commission, Attribution, shortlist, reject, offer, or placement. Those remain HR Connect business workflows and human decisions.

## Tests

```powershell
pytest
```

Tests inject deterministic fake embeddings and OCR, so the test suite does not download embedding or EasyOCR models. Structured extraction is deliberately conservative: uncertain values remain null and every extracted record carries evidence/confidence. Phase 1 reconstructs digital PDF layouts; OCR bounding-box layout reconstruction and highly graphical/table-driven CVs remain follow-up work and may require human review.

## Measuring accuracy

`evaluation/README.md` explains how to score HR-labelled cases (`tools/evaluate_scoring.py`), calibrate weights
(`--calibrate`), and compare stored scores with real HR decisions (`evaluation/hr_feedback.sql` + `tools/hr_feedback_report.py`).
Accepted phrasings for soft requirements live in `app/data/capability_lexicon.json`.

## Deploy to Render

`render.yaml` at the repository root is a Render Blueprint for this service (Docker, `rootDir: ai-service`, health check `/health`).

1. Render dashboard → **New → Blueprint** → choose this repository.
2. Fill the two secrets: `HRCONNECT_BASE_URL` (public URL of the HR Connect backend) and `HRCONNECT_SERVICE_TOKEN`.
3. On the backend set `Mf03Integration__BaseUrl=https://<ai-service>.onrender.com` and `Mf03Integration__ServiceToken` to the same token.

Use at least the **standard** (2 GB) plan: the service peaks around 1.4 GB RAM with MiniLM, so free/starter instances run out of memory. The backend must be publicly reachable, because the AI service calls it back for scoring jobs. The container listens on Render's `PORT` (default 8001).
