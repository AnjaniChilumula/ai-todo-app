from fastapi import FastAPI

app = FastAPI(title="AI Todo App API", version="0.1.0")


@app.get("/api/health")
def health() -> dict:
    """Liveness check used by the frontend and by CI."""
    return {"status": "ok"}
