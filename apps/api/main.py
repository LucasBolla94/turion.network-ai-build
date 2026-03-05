from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.db.database import engine, Base
from app.api.v1.router import api_router

import app.models.user               # noqa
import app.models.app_project        # noqa
import app.models.builder            # noqa
import app.models.app_file           # noqa
import app.models.password_reset     # noqa
import app.models.email_verification # noqa
import app.models.usage_log          # noqa


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine, checkfirst=True)
    except Exception:
        pass  # tables already created by another worker
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
## Turion Network — Backend API

AI-powered platform to build, host and deploy web apps.

### Authentication
```
Authorization: Bearer <your_token>
```
Get a token via `POST /auth/register` or `POST /auth/login`.
    """,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/v1")
