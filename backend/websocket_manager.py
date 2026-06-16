import asyncio
import json
from typing import Optional
from fastapi import WebSocket
from lobby import Room, RoomStatus, get_room, delete_room
from game import (
    drop_piece,
    check_winner,
    is_draw,
    empty_board,
    ai_best_move,
    RED,
    YELLOW,
)

_room_connections: dict[str, dict[str, WebSocket]] = {}


async def _send(ws: WebSocket, data: dict) -> None:
    try:
        await ws.send_text(json.dumps(data))
    except Exception:
        pass


async def _broadcast(room_code: str, data: dict) -> None:
    connections = _room_connections.get(room_code, {})
    for ws in list(connections.values()):
        await _send(ws, data)


def _board_state(room: Room) -> dict:
    return {
        "type": "game_state",
        "board": room.board,
        "current_turn": room.current_turn,
        "status": room.status.value,
        "red_player": room.red_player,
        "yellow_player": room.yellow_player,
        "scores": room.scores,
    }


async def handle_connect(websocket: WebSocket, room_code: str, username: str) -> None:
    room = get_room(room_code)
    if room is None:
        await websocket.close(code=4004, reason="Room not found")
        return

    if room_code not in _room_connections:
        _room_connections[room_code] = {}

    if username not in (room.red_player, room.yellow_player, room.creator, room.opponent):
        await websocket.close(code=4003, reason="Not a member of this room")
        return

    _room_connections[room_code][username] = websocket
    await _send(websocket, _board_state(room))

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
            await _broadcast(
                room_code,
                {"type": "player_disconnected", "username": username},
            )


async def _handle_move(room: Room, username: str, column: Optional[int], room_code: str) -> None:
    if room.status != RoomStatus.playing:
        connections = _room_connections.get(room_code, {})
        ws = connections.get(username)
        if ws:
            await _send(ws, {"type": "error", "message": "Game is not in progress"})
        return

    player_color = _get_player_color(room, username)
    if player_color is None:
        connections = _room_connections.get(room_code, {})
        ws = connections.get(username)
        if ws:
            await _send(ws, {"type": "error", "message": "You are not a player in this game"})
        return

    if room.current_turn != player_color:
        connections = _room_connections.get(room_code, {})
        ws = connections.get(username)
        if ws:
            await _send(ws, {"type": "error", "message": "It is not your turn"})
        return

    if column is None or not isinstance(column, int):
        connections = _room_connections.get(room_code, {})
        ws = connections.get(username)
        if ws:
            await _send(ws, {"type": "error", "message": "Invalid column"})
        return

    player_int = RED if player_color == "red" else YELLOW
    try:
        new_board, row = drop_piece(room.board, column, player_int)
    except ValueError as e:
        connections = _room_connections.get(room_code, {})
        ws = connections.get(username)
        if ws:
            await _send(ws, {"type": "error", "message": str(e)})
        return

    room.board = new_board
    next_turn = "yellow" if player_color == "red" else "red"
    room.current_turn = next_turn

    result = check_winner(room.board)
    if result:
        winner_int, winning_cells = result
        winner_color = "red" if winner_int == RED else "yellow"
        room.status = RoomStatus.finished
        winner_name = room.red_player if winner_color == "red" else room.yellow_player
        if winner_name and winner_name in room.scores:
            room.scores[winner_name] += 1
        await _broadcast(
            room_code,
            {
                "type": "game_over",
                "board": room.board,
                "winner": winner_color,
                "winning_cells": winning_cells,
                "scores": room.scores,
            },
        )
        return

    if is_draw(room.board):
        room.status = RoomStatus.finished
        await _broadcast(
            room_code,
            {
                "type": "game_over",
                "board": room.board,
                "winner": "draw",
                "winning_cells": [],
                "scores": room.scores,
            },
        )
        return

    await _broadcast(
        room_code,
        {
            "type": "move_result",
            "board": room.board,
            "column": column,
            "row": row,
            "player": player_color,
            "current_turn": room.current_turn,
            "scores": room.scores,
        },
    )

    if room.ai_mode and room.current_turn == "yellow":
        asyncio.create_task(_ai_move(room, room_code))


async def _ai_move(room: Room, room_code: str) -> None:
    await asyncio.sleep(0.6)
    if room.status != RoomStatus.playing or room.current_turn != "yellow":
        return
    col = ai_best_move(room.board, YELLOW, depth=5)
    new_board, row = drop_piece(room.board, col, YELLOW)
    room.board = new_board
    room.current_turn = "red"

    result = check_winner(room.board)
    if result:
        winner_int, winning_cells = result
        winner_color = "red" if winner_int == RED else "yellow"
        room.status = RoomStatus.finished
        winner_name = room.red_player if winner_color == "red" else "AI"
        if winner_name and winner_name in room.scores:
            room.scores[winner_name] += 1
        await _broadcast(
            room_code,
            {
                "type": "game_over",
                "board": room.board,
                "winner": winner_color,
                "winning_cells": winning_cells,
                "scores": room.scores,
            },
        )
        return

    if is_draw(room.board):
        room.status = RoomStatus.finished
        await _broadcast(
            room_code,
            {
                "type": "game_over",
                "board": room.board,
                "winner": "draw",
                "winning_cells": [],
                "scores": room.scores,
            },
        )
        return

    await _broadcast(
        room_code,
        {
            "type": "move_result",
            "board": room.board,
            "column": col,
            "row": row,
            "player": "yellow",
            "current_turn": "red",
            "scores": room.scores,
        },
    )


async def _handle_rematch(room: Room, username: str, room_code: str) -> None:
    if room.status != RoomStatus.finished:
        return
    room.board = empty_board()
    room.current_turn = "red"
    room.status = RoomStatus.playing
    await _broadcast(room_code, _board_state(room))


async def _handle_surrender(room: Room, username: str, room_code: str) -> None:
    if room.status != RoomStatus.playing:
        return
    player_color = _get_player_color(room, username)
    if player_color is None:
        return
    winner_color = "yellow" if player_color == "red" else "red"
    room.status = RoomStatus.finished
    winner_name = room.red_player if winner_color == "red" else room.yellow_player
    if winner_name and winner_name in room.scores:
        room.scores[winner_name] += 1
    await _broadcast(
        room_code,
        {
            "type": "game_over",
            "board": room.board,
            "winner": winner_color,
            "winning_cells": [],
            "scores": room.scores,
            "reason": "surrender",
        },
    )


def _get_player_color(room: Room, username: str) -> Optional[str]:
    if room.red_player == username:
        return "red"
    if room.yellow_player == username:
        return "yellow"
    return None
