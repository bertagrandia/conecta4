import re
from groq import AsyncGroq
from .game import Board, get_valid_columns, ai_best_move, drop_piece, check_winner, YELLOW, RED

_client: AsyncGroq | None = None


def _get_client() -> AsyncGroq:
    global _client
    if _client is None:
        from config import settings
        _client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    return _client


def _board_to_text(board: Board) -> str:
    symbols = {0: "·", 1: "R", 2: "A"}
    lines = ["  Columnas: 0  1  2  3  4  5  6"]
    for i, row in enumerate(board):
        lines.append(f"  Fila {i}:   " + "  ".join(symbols[cell] for cell in row))
    return "\n".join(lines)


def _check_immediate(board: Board, player: int, valid_cols: list[int]) -> int | None:
    """Detecta si hay un movimiento ganador inmediato para el jugador dado."""
    for col in valid_cols:
        try:
            new_board, _ = drop_piece(board, col, player)
            if check_winner(new_board):
                return col
        except ValueError:
            pass
    return None


async def groq_best_move(board: Board, ai_player: int = YELLOW) -> tuple[int, str | None]:
    """Returns (column, error_message). error_message is None if Groq succeeded."""
    valid_cols = get_valid_columns(board)
    if not valid_cols:
        return 0, None

    human = RED if ai_player == YELLOW else YELLOW

    # Comprobaciones deterministas antes de llamar a Groq
    win_move = _check_immediate(board, ai_player, valid_cols)
    if win_move is not None:
        return win_move, None

    block_move = _check_immediate(board, human, valid_cols)
    if block_move is not None:
        return block_move, None

    board_text = _board_to_text(board)

    prompt = f"""Eres un motor de Conecta 4. Juegas como A (Amarillo). El humano es R (Rojo).

TABLERO ACTUAL:
{board_text}

REGLAS CLAVE:
- Las fichas caen hasta la celda vacía más baja de la columna.
- Gana quien conecte 4 fichas seguidas en horizontal, vertical o diagonal.
- Fila 5 es la fila inferior (donde caen primero las fichas).

COLUMNAS DISPONIBLES: {valid_cols}

PRIORIDADES (en orden estricto):
1. Si puedes ganar ahora → elige esa columna.
2. Si el rival puede ganar en su próximo turno → bloquéalo.
3. Prefiere la columna central (3) para mayor control.
4. Busca crear amenazas de 3 en línea con espacio para la 4ª.
5. Evita columnas que den al rival un movimiento ganador inmediato encima.

RESPONDE ÚNICAMENTE con el número de columna elegida (0-6). Sin explicación, sin texto extra."""

    try:
        client = _get_client()
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=10,
            temperature=0,
        )
        text = response.choices[0].message.content.strip()
        match = re.search(r"\d", text)
        if match:
            col = int(match.group())
            if col in valid_cols:
                return col, None
        error = f"Groq devolvió columna inválida: '{text}'"
    except Exception as e:
        error = str(e)

    fallback_col = ai_best_move(board, ai_player)
    return fallback_col, error
