from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.api.cv import router as cv_router
from app.api.matching import router as matching_router
from app.api.scoring_jobs import router as scoring_jobs_router
from app.core.config import get_settings
from app.core.logging_config import configure_logging
from app.services.scoring_queue import scoring_job_queue


@asynccontextmanager
async def lifespan(_: FastAPI):
    await scoring_job_queue.start()
    try:
        yield
    finally:
        await scoring_job_queue.stop()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        lifespan=lifespan,
    )

    @application.get("/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "hr-connect-ai"}

    @application.get("/ready", tags=["health"])
    def readiness():
        missing = []
        if not settings.hrconnect_service_token.strip():
            missing.append("HRCONNECT_SERVICE_TOKEN")
        if not settings.hrconnect_base_url.strip():
            missing.append("HRCONNECT_BASE_URL")
        if missing:
            return JSONResponse(
                status_code=503,
                content={
                    "status": "not_ready",
                    "service": "hr-connect-ai",
                    "missing": missing,
                },
            )
        return {"status": "ready", "service": "hr-connect-ai"}

    application.include_router(matching_router)
    application.include_router(cv_router)
    application.include_router(scoring_jobs_router)
    return application


app = create_app()
