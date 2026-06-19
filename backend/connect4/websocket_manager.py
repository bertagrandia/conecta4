import asyncio
import json
from typing import Optional
from fastapi import WebSocket
from .lobby import Room, RoomStatus, get_room
from .game import drop_piece, check_winner, is_draw, empty_board, RED, YELLOW, BLUE
from .ai_groq import groq_best_move

_room_connections: dict[str, dict[str, WebSocket]] = {}
# room_code → set of player colors currently disconnected mid-game
_disconnected: dict[str, set[str]] = {}

# ── Helpers ───────────────────────────────────────────────────────────────────

async def _send(ws: WebSocket, data: dict) -> None:
    try:
        await ws.send_text(json.dumps(data))
    except Exception:
        pass


async def _broadcast(room_code: str, data: dict) -> None:
    for ws in list(_room_connections.get(room_code, {}).values()):
        await _send(ws, data)


def _color_to_int(color: str) -> int:
    return RED if color == "red" else (YELLOW if color == "yellow" else BLUE)


def _int_to_color(value: int) -> str:
    return "red" if value == RED else ("yellow" if value == YELLOW else "blue")


def _get_player_color(room: Room, username: str) -> Optional[str]:
    if room.red_player == username:    return "red"
    if room.yellow_player == username: return "yellow"
    if room.blue_player == username:   return "blue"
    return None


def _active_colors(room: Room, room_code: str) -> list[str]:
    """Ordered list of colors still in the game (present and not disconnected)."""
    disc = _disconnected.get(room_code, set())
    order = ["red", "yellow", "blue"]
    present = {"red": room.red_player, "yellow": room.yellow_player, "blue": room.blue_player}
    return [c for c in order if present[c] and c not in disc]


def _next_turn(room: Room, room_code: str, current_color: str) -> str:
    active = _active_colors(room, room_code)
    if not active:
        return current_color
    if current_color not in active:
        return active[0]
    idx = active.index(current_color)
    return active[(idx + 1) % len(active)]


def _player_name(room: Room, color: str) -> Optional[str]:
    return {"red": room.red_player, "yellow": room.yellow_player, "blue": room.blue_player}.get(color)


def _board_state(room: Room, room_code: str = "") -> dict:
    disc = list(_disconnected.get(room_code, set()))
    players = [c for c in ["red", "yellow", "blue"]
               if {"red": room.red_player, "yellow": room.yellow_player, "blue": room.blue_player}[c]]
    return {
        "type": "game_state",
        "board": room.board,
        "current_turn": room.current_turn,
        "status": room.status.value,
        "red_player": room.red_player,
        "yellow_player": room.yellow_player,
        "blue_player": room.blue_player,
        "scores": room.scores,
        "players": players,
        "disconnected_colors": disc,
    }


# ── Public helper called by lobby.py auto-start tasks ────────────────────────

async def notify_game_started(room_code: str) -> None:
    room = get_room(room_code)
    if room:
        await _broadcast(room_code, _board_state(room, room_code))
        # Trigger AI first move if it's AI's turn (e.g. AI as yellow and red goes first → not needed yet)
        _maybe_trigger_ai(room, room_code)


# ── Connect / main loop ───────────────────────────────────────────────────────

async def handle_connect(websocket: WebSocket, room_code: str, username: str) -> None:
    room = get_room(room_code)
    if room is None:
        await websocket.close(code=4004, reason="Room not found")
        return

    all_players = {room.red_player, room.yellow_player, room.blue_player, room.creator, room.opponent}
    if username not in all_players:
        await websocket.close(code=4003, reason="Not a member of this room")
        return

    if room_code not in _room_connections:
        _room_connections[room_code] = {}

    _room_connections[room_code][username] = websocket

    # If player was marked as disconnected (reconnect), remove from set
    color = _get_player_color(room, username)
    if color and room_code in _disconnected:
        _disconnected[room_code].discard(color)

    # Broadcast updated state to all (so everyone sees the new player count / reconnect)
    await _broadcast(room_code, _board_state(room, room_code))

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await _send(websocket, {"type": "error", "message": "Invalid JSON"})
                continue

            msg_type = msg.get("type")
            if msg_type == "move":
                await _handle_move(room, username, msg.get("column"), room_code)
            elif msg_type == "rematch":
                await _handle_rematch(room, username, room_code)
            elif msg_type == "surrender":
                await _handle_surrender(room, username, room_code)
            else:
                await _send(websocket, {"type": "error", "message": "Unknown message type"})
    except Exception:
        pass
    finally:
        _room_connections.get(room_code, {}).pop(username, None)
        room = get_room(room_code)
        if room and room.status == RoomStatus.playing:
            await _handle_disconnect(room, username, room_code)


# ── Move handling ─────────────────────────────────────────────────────────────

async def _handle_move(room: Room, username: str, column: Optional[int], room_code: str) -> None:
    ws = _room_connections.get(room_code, {}).get(username)

    if room.status != RoomStatus.playing:
        if ws: await _send(ws, {"type": "error", "message": "Game is not in progress"})
        return

    player_color = _get_player_color(room, username)
    if player_color is None:
        if ws: await _send(ws, {"type": "error", "message": "You are not a player in this game"})
        return

    if room.current_turn != player_color:
        if ws: await _send(ws, {"type": "error", "message": "It is not your turn"})
        return

    if column is None or not isinstance(column, int):
        if ws: await _send(ws, {"type": "error", "message": "Invalid column"})
        return

    player_int = _color_to_int(player_color)
    try:
        new_board, row = drop_piece(room.board, column, player_int)
    except ValueError as e:
        if ws: await _send(ws, {"type": "error", "message": str(e)})
        return

    room.board = new_board
    room.current_turn = _next_turn(room, room_code, player_color)

    result = check_winner(room.board)
    if result:
        winner_int, winning_cells = result
        winner_color = _int_to_color(winner_int)
        room.status = RoomStatus.finished
        winner_name = _player_name(room, winner_color)
        if winner_name and winner_name in room.scores:
            room.scores[winner_name] += 1
        await _broadcast(room_code, {
            "type": "game_over", "board": room.board,
            "winner": winner_color, "winning_cells": winning_cells, "scores": room.scores,
        })
        return

    if is_draw(room.board):
        room.status = RoomStatus.finished
        await _broadcast(room_code, {
            "type": "game_over", "board": room.board,
            "winner": "draw", "winning_cells": [], "scores": room.scores,
        })
        return

    await _broadcast(room_code, {
        "type": "move_result", "board": room.board,
        "column": column, "row": row, "player": player_color,
        "current_turn": room.current_turn, "scores": room.scores,
    })

    _maybe_trigger_ai(room, room_code)


def _maybe_trigger_ai(room: Room, room_code: str) -> None:
    if not room.ai_mode or room.status != RoomStatus.playing:
        return
    ai_color = "blue" if room.blue_player == "AI" else "yellow"
    if room.current_turn == ai_color:
        asyncio.create_task(_ai_move(room, room_code))


async def _ai_move(room: Room, room_code: str) -> None:
    await asyncio.sleep(0.6)
    ai_color = "blue" if room.blue_player == "AI" else "yellow"
    ai_int   = BLUE   if ai_color == "blue"       else YELLOW

    if room.status != RoomStatus.playing or room.current_turn != ai_color:
        return

    col, groq_error = await groq_best_move(room.board, ai_int)
    if groq_error:
        await _broadcast(room_code, {"type": "ai_fallback", "error": groq_error})

    new_board, row = drop_piece(room.board, col, ai_int)
    room.board = new_board
    room.current_turn = _next_turn(room, room_code, ai_color)

    result = check_winner(room.board)
    if result:
        winner_int, winning_cells = result
        winner_color = _int_to_color(winner_int)
        room.status = RoomStatus.finished
        winner_name = _player_name(room, winner_color)
        if winner_name and winner_name in room.scores:
            room.scores[winner_name] += 1
        await _broadcast(room_code, {
            "type": "game_over", "board": room.board,
            "winner": winner_color, "winning_cells": winning_cells, "scores": room.scores,
        })
        return

    if is_draw(room.board):
        room.status = RoomStatus.finished
        await _broadcast(room_code, {
            "type": "game_over", "board": room.board,
            "winner": "draw", "winning_cells": [], "scores": room.scores,
        })
        return

    await _broadcast(room_code, {
        "type": "move_result", "board": room.board,
        "column": col, "row": row, "player": ai_color,
        "current_turn": room.current_turn, "scores": room.scores,
    })


# ── Disconnect handling ────────────────────────────────────────────────────────

async def _handle_disconnect(room: Room, username: str, room_code: str) -> None:
    color = _get_player_color(room, username)
    total = sum(1 for p in [room.red_player, room.yellow_player, room.blue_player] if p)

    if total <= 2:
        # Classic 2-player: disconnect ends the game
        room.status = RoomStatus.finished
        await _broadcast(room_code, {
            "type": "player_disconnected",
            "username": username,
            "color": color,
            "continues": False,
        })
        return

    # 3-player: mark as disconnected and continue
    if room_code not in _disconnected:
        _disconnected[room_code] = set()
    if color:
        _disconnected[room_code].add(color)

    active = _active_colors(room, room_code)

    if len(active) <= 1:
        room.status = RoomStatus.finished
        await _broadcast(room_code, {
            "type": "player_disconnected",
            "username": username,
            "color": color,
            "continues": False,
        })
        return

    # Advance turn if it was the disconnected player's turn
    if room.current_turn == color:
        room.current_turn = _next_turn(room, room_code, color)

    await _broadcast(room_code, {
        "type": "player_disconnected",
        "username": username,
        "color": color,
        "continues": True,
        "current_turn": room.current_turn,
        "disconnected_colors": list(_disconnected.get(room_code, set())),
    })

    # Trigger AI if it's now AI's turn after the skip
    _maybe_trigger_ai(room, room_code)


# ── Rematch / Surrender ───────────────────────────────────────────────────────

async def _handle_rematch(room: Room, username: str, room_code: str) -> None:
    if room.status != RoomStatus.finished:
        return
    room.board = empty_board()
    room.current_turn = "red"
    room.status = RoomStatus.playing
    _disconnected.pop(room_code, None)
    await _broadcast(room_code, _board_state(room, room_code))
    _maybe_trigger_ai(room, room_code)


async def _handle_surrender(room: Room, username: str, room_code: str) -> None:
    if room.status != RoomStatus.playing:
        return
    player_color = _get_player_color(room, username)
    if player_color is None:
        return

    total = sum(1 for p in [room.red_player, room.yellow_player, room.blue_player] if p)

    if total <= 2:
        # 2-player: opponent wins
        winner_color = "yellow" if player_color == "red" else "red"
        room.status = RoomStatus.finished
        winner_name = _player_name(room, winner_color)
        if winner_name and winner_name in room.scores:
            room.scores[winner_name] += 1
        await _broadcast(room_code, {
            "type": "game_over", "board": room.board,
            "winner": winner_color, "winning_cells": [], "scores": room.scores, "reason": "surrender",
        })
    else:
        # 3-player: surrendered player leaves, game continues with remaining 2
        if room_code not in _disconnected:
            _disconnected[room_code] = set()
        _disconnected[room_code].add(player_color)

        active = _active_colors(room, room_code)

        if len(active) <= 1:
            room.status = RoomStatus.finished
            await _broadcast(room_code, {
                "type": "game_over", "board": room.board,
                "winner": active[0] if active else "draw",
                "winning_cells": [], "scores": room.scores, "reason": "surrender",
            })
            return

        if room.current_turn == player_color:
            room.current_turn = _next_turn(room, room_code, player_color)

        await _broadcast(room_code, {
            "type": "player_disconnected",
            "username": username,
            "color": player_color,
            "continues": True,
            "current_turn": room.current_turn,
            "disconnected_colors": list(_disconnected.get(room_code, set())),
            "reason": "surrender",
        })
        _maybe_trigger_ai(room, room_code)
