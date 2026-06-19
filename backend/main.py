from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from connect4.config import settings as connect4_settings
from connect4.main import app as connect4_app
from battleship.main import app as battleship_app

app = FastAPI(title="Games Hub API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=connect4_settings.get_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/connect4", connect4_app)
app.mount("/battleship", battleship_app)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
