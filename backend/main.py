from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, status
from fastapi.middleware.cors import CORSMiddleware
from datetime import timedelta

from config import settings
from models import UserRegister, UserLogin, Token, RoomCreate
from auth import (
    create_user,
    authenticate_user,
    create_access_token,
    get_current_user,
    decode_token,
)
from lobby import create_room, get_room, join_room, enable_ai_mode
from websocket_manager import handle_connect, notify_room_state

app = FastAPI(title="Conecta 4 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/auth/register", response_model=Token)
async def register(body: UserRegister):
    user = create_user(body.username, body.password)
    token = create_access_token(
        {"sub": user.username},
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return Token(access_token=token)


@app.post("/auth/login", response_model=Token)
async def login(body: UserLogin):
    user = authenticate_user(body.username, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    token = create_access_token(
        {"sub": user.username},
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return Token(access_token=token)


# ── Rooms ─────────────────────────────────────────────────────────────────────

@app.post("/rooms/create")
async def create_room_endpoint(
    body: RoomCreate = RoomCreate(),
    current_user: str = Depends(get_current_user),
):
    room = create_room(current_user, ai_mode=body.ai_mode)
    return room.to_dict()


@app.post("/rooms/join/{code}")
async def join_room_endpoint(code: str, current_user: str = Depends(get_current_user)):
    room = join_room(code.upper(), current_user)
    # If blue player just joined, immediately notify existing WS connections
    if room.blue_player == current_user:
        await notify_room_state(code.upper())
    return room.to_dict()


@app.post("/rooms/{code}/ai")
async def enable_ai_endpoint(code: str, current_user: str = Depends(get_current_user)):
    room = enable_ai_mode(code.upper(), current_user)
    return room.to_dict()


@app.get("/rooms/{code}")
async def get_room_endpoint(code: str, current_user: str = Depends(get_current_user)):
    room = get_room(code.upper())
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    return room.to_dict()


# ── AI Status ────────────────────────────────────────────────────────────────

@app.get("/ai/status")
async def ai_status():
    from game import empty_board
    from ai_groq import groq_best_move
    try:
        board = empty_board()
        col = await groq_best_move(board)
        return {"status": "ok", "provider": "groq", "test_column": col}
    except Exception as e:
        return {"status": "fallback", "provider": "minimax", "error": str(e)}


# ── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws/{room_code}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_code: str,
    token: str = Query(...),
):
    await websocket.accept()
    username = decode_token(token)
    if username is None:
        await websocket.close(code=4001, reason="Invalid token")
        return
    await handle_connect(websocket, room_code.upper(), username)
