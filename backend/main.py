import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.database import engine, Base
from app.controllers import (
    admin_controller,
    device_controller,
    video_controller,
    fence_controller,
    alarm_controller,
    call_controller,
    dashboard_controller,
)
from app.utils.logger import get_logger

# Initialize Logger
logger = get_logger("Main")

# Create Database Tables (Quick setup for dev)
Base.metadata.create_all(bind=engine)


app = FastAPI()
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")
app.add_middleware(
    CORSMiddleware,
    # allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  # 你的前端地址
    allow_origin_regex='.*',  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],  # 允许 GET/POST/PUT/DELETE/OPTIONS 等
    allow_headers=["*"],
)

# Include Routers
app.include_router(admin_controller.router)
app.include_router(device_controller.router)
app.include_router(video_controller.router)
app.include_router(fence_controller.router)
app.include_router(alarm_controller.router)
app.include_router(call_controller.router)
app.include_router(dashboard_controller.router)

@app.get("/")
def root():
    logger.info("Root endpoint accessed")
    return {"message": "Smart Helmet Platform API is running"}


if __name__ == "__main__":
    import uvicorn
    import os
    from dotenv import load_dotenv

    load_dotenv()
    
    host = os.getenv("BACKEND_HOST", "127.0.0.1")
    port = int(os.getenv("BACKEND_PORT", 8000))
    
    uvicorn.run(app, host=host, port=port)