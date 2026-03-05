from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.db.database import engine, Base
from app.api.v1.router import api_router

# Import models so SQLAlchemy registers them before creating tables
import app.models.user  # noqa
import app.models.app_project  # noqa


@asynccontextmanager
async def lifespan(app: FastAPI):
    # On startup: create all tables if they don't exist
    Base.metadata.create_all(bind=engine)
    yield
    # On shutdown: nothing needed for now


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
## Turion Network — Backend API

AI-powered platform to build, host and deploy web apps.

### Authentication
Use **Bearer token** in the `Authorization` header:
```
Authorization: Bearer <your_token>
```

Get a token via `POST /auth/register` or `POST /auth/login`.
    """,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS — allow the frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all routes under /v1
app.include_router(api_router, prefix="/v1")
