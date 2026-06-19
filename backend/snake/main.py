from connect4.auth import decode_token, get_current_user
from fastapi import Depends, FastAPI, Query, WebSocket

from .room_manager import create_private_room, get_room_or_404, list_public_rooms
from .websocket_handler import handle_connect

app = FastAPI(title="Snake Arena API")


# ── Rooms ─────────────────────────────────────────────────────────────────────

@app.get("/rooms")
async def list_rooms_endpoint(current_user: str = Depends(get_current_user)):
    return list_public_rooms()


@app.post("/rooms/create")
async def create_room_endpoint(current_user: str = Depends(get_current_user)):
    room = create_private_room(current_user)
    return room.to_summary()


@app.get("/rooms/{room_id}")
async def get_room_endpoint(room_id: str, current_user: str = Depends(get_current_user)):
    room = get_room_or_404(room_id)
    return room.to_summary()


# ── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_id: str,
    token: str = Query(...),
):
    await websocket.accept()
    username = decode_token(token)
    if username is None:
        await websocket.close(code=4001, reason="Invalid token")
        return
    await handle_connect(websocket, room_id, username)
