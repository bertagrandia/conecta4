import asyncio
import json
from typing import Optional
from fastapi import WebSocket
from lobby import Room, RoomStatus, get_room
from game import (
    drop_piece, check_winner, is_draw, empty_board,
    RED, YELLOW, BLUE,
)
from ai_groq import groq_best_move

_room_connections: dict[str, dict[str, WebSocket]] = {}

_COLOR_TO_INT = {"red": RED, "yellow": YELLOW, "blue": BLUE}
_INT_TO_COLOR = {RED: "red", YELLOW: "yellow", BLUE: "blue"}


async def _send(ws: WebSocket, data: dict) -> None:
    try:
        await ws.send_text(json.dumps(data))
    except Exception:
        pass


async def _broadcast(room_code: str, data: dict) -> None:
    for ws in list(_room_connections.get(room_code, {}).values()):
        await _send(ws, data)


def _board_state(room: Room) -> dict:
    return {
        "type": "game_state",
        "board": room.board,
        "current_turn": room.current_turn,
        "status": room.status.value,
        "red_player": room.red_player,
        "yellow_player": room.yellow_player,
        "blue_player": room.blue_player,
        "scores": room.scores,
    }


async def notify_room_state(room_code: str) -> None:
    """Called from REST endpoints to push updated state to all WS connections."""
    room = get_room(room_code)
    if room:
        await _broadcast(room_code, _board_state(room))


async def handle_connect(websocket: WebSocket, room_code: str, username: str) -> None:
    room = get_room(room_code)
    if room is None:
        await websocket.close(code=4004, reason="Room not found")
        return

    all_players = {
        room.red_player, room.yellow_player, room.blue_player,
        room.creator, room.opponent,
    }
    if username not in all_players:
        await websocket.close(code=4003, reason="Not a member of this room")
        return

    if room_code not in _room_connections:
        _room_connections[room_code] = {}

    _room_connections[room_code][username] = websocket
    # Send current state to this player
    await _send(websocket, _board_state(room))

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await _send(websocket, {"type": "error", "message": "Invalid JSON"})
                continue

            # Handle each message in its own try so errors don't kill the connection
            try:
                msg_type = msg.get("type")
                if msg_type == "move":
                    await _handle_move(room, username, msg.get("column"), room_code)
                elif msg_type == "rematch":
                    await _handle_rematch(room, username, room_code)
                elif msg_type == "surrender":
                    await _handle_surrender(room, username, room_code)
                else:
                    await _send(websocket, {"type": "error", "message": "Unknown message type"})
            except Exception as e:
                await _send(websocket, {"type": "error", "message": f"Server error: {str(e)}"})

    except Exception:
        pass
    finally:
        _room_connections.get(room_code, {}).pop(username, None)
        room = get_room(room_code)
        if room and room.status == RoomStatus.playing:
            await _broadcast(room_code, {"type": "player_disconnected", "username": username})


async def _handle_move(room: Room, username: str, column: Optional[int], room_code: str) -> None:
    ws = _room_connections.get(room_code, {}).get(username)

    if room.status != RoomStatus.playing:
        if ws:
            await _send(ws, {"type": "error", "message": "Game is not in progress"})
        return

    player_color = _get_player_color(room, username)
    if player_color is None:
        if ws:
            await _send(ws, {"type": "error", "message": "You are not a player in this game"})
        return

    if room.current_turn != player_color:
        if ws:
            await _send(ws, {"type": "error", "message": "It is not your turn"})
        return

    if column is None or not isinstance(column, int):
        if ws:
            await _send(ws, {"type": "error", "message": "Invalid column"})
        return

    player_int = _COLOR_TO_INT[player_color]
    try:
        new_board, row = drop_piece(room.board, column, player_int)
    except ValueError as e:
        if ws:
            await _send(ws, {"type": "error", "message": str(e)})
        return

    room.board = new_board

    result = check_winner(room.board)
    if result:
        winner_int, winning_cells = result
        winner_color = _INT_TO_COLOR[winner_int]
        room.status = RoomStatus.finished
        winner_name = _player_name_by_color(room, winner_color)
        if winner_name and winner_name in room.scores:
            room.scores[winner_name] += 1
        await _broadcast(room_code, {
            "type": "game_over",
            "board": room.board,
            "winner": winner_color,
            "winning_cells": winning_cells,
            "scores": room.scores,
        })
        return

    if is_draw(room.board):
        room.status = RoomStatus.finished
        await _broadcast(room_code, {
            "type": "game_over",
            "board": room.board,
            "winner": "draw",
            "winning_cells": [],
            "scores": room.scores,
        })
        return

    # Advance turn only after confirming the game continues
    room.current_turn = room.next_turn()

    await _broadcast(room_code, {
        "type": "move_result",
        "board": room.board,
        "column": column,
        "row": row,
        "player": player_color,
        "current_turn": room.current_turn,
        "red_player": room.red_player,
        "yellow_player": room.yellow_player,
        "blue_player": room.blue_player,
        "scores": room.scores,
    })

    if room.ai_mode and room.current_turn == "yellow":
        asyncio.create_task(_ai_move(room, room_code))


async def _ai_move(room: Room, room_code: str) -> None:
    await asyncio.sleep(0.6)
    if room.status != RoomStatus.playing or room.current_turn != "yellow":
        return

    col, groq_error = await groq_best_move(room.board, YELLOW)
    if groq_error:
        await _broadcast(room_code, {"type": "ai_fallback", "error": groq_error})

    new_board, row = drop_piece(room.board, col, YELLOW)
    room.board = new_board

    result = check_winner(room.board)
    if result:
        winner_int, winning_cells = result
        winner_color = _INT_TO_COLOR[winner_int]
        room.status = RoomStatus.finished
        winner_name = _player_name_by_color(room, winner_color)
        if winner_name and winner_name in room.scores:
            room.scores[winner_name] += 1
        await _broadcast(room_code, {
            "type": "game_over",
            "board": room.board,
            "winner": winner_color,
            "winning_cells": winning_cells,
            "scores": room.scores,
        })
        return

    if is_draw(room.board):
        room.status = RoomStatus.finished
        await _broadcast(room_code, {
            "type": "game_over",
            "board": room.board,
            "winner": "draw",
            "winning_cells": [],
            "scores": room.scores,
        })
        return

    room.current_turn = room.next_turn()

    await _broadcast(room_code, {
        "type": "move_result",
        "board": room.board,
        "column": col,
        "row": row,
        "player": "yellow",
        "current_turn": room.current_turn,
        "red_player": room.red_player,
        "yellow_player": room.yellow_player,
        "blue_player": room.blue_player,
        "scores": room.scores,
    })


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
    order = room.turn_order
    idx = order.index(player_color)
    winner_color = order[(idx + 1) % len(order)]
    room.status = RoomStatus.finished
    winner_name = _player_name_by_color(room, winner_color)
    if winner_name and winner_name in room.scores:
        room.scores[winner_name] += 1
    await _broadcast(room_code, {
        "type": "game_over",
        "board": room.board,
        "winner": winner_color,
        "winning_cells": [],
        "scores": room.scores,
        "reason": "surrender",
    })


def _get_player_color(room: Room, username: str) -> Optional[str]:
    if room.red_player == username:
        return "red"
    if room.yellow_player == username:
        return "yellow"
    if room.blue_player == username:
        return "blue"
    return None


def _player_name_by_color(room: Room, color: str) -> Optional[str]:
    return {
        "red": room.red_player,
        "yellow": room.yellow_player,
        "blue": room.blue_player,
    }.get(color)
