import sys
import os

# Ensure backend directory is in sys.path
backend_dir = os.path.join(os.path.dirname(__file__), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

if __name__ == "__main__":
    import uvicorn
    from app.config import settings
    print(f"Starting Autonomous Data Analysis Agent Backend on http://localhost:{settings.PORT}")
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
