import re
from groq import AsyncGroq
from game import Board, get_valid_columns, ai_best_move, YELLOW

_client: AsyncGroq | None = None


def _get_client() -> AsyncGroq:
    global _client
    if _client is None:
        from config import settings
        _client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    return _client


def _board_to_text(board: Board) -> str:
    symbols = {0: "·", 1: "R", 2: "A"}
    lines = []
    for row in board:
        lines.append("  ".join(symbols[cell] for cell in row))
    lines.append("  ".join(str(i) for i in range(7)))
    return "\n".join(lines)


async def groq_best_move(board: Board, ai_player: int = YELLOW) -> tuple[int, str | None]:
    """Returns (column, error_message). error_message is None if Groq succeeded."""
    valid_cols = get_valid_columns(board)
    if not valid_cols:
        return 0, None

    board_text = _board_to_text(board)
    prompt = f"""Eres un experto en Conecta 4. Juegas como A (Amarillo). El humano juega como R (Rojo).

Tablero (· = vacío, R = Rojo/humano, A = Amarillo/tú):
{board_text}

Filas: 0 es la de arriba, 5 es la de abajo. Las fichas caen hacia abajo.
Columnas disponibles: {valid_cols}

Razona brevemente y elige la columna óptima para ganar o bloquear al rival.
Responde SOLO con el número de columna (un único dígito entre 0 y 6)."""

    try:
        client = _get_client()
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=50,
            temperature=0.1,
        )
        text = response.choices[0].message.content.strip()
        match = re.search(r"\d", text)
        if match:
            col = int(match.group())
            if col in valid_cols:
                return col, None
        error = f"Groq devolvió una columna inválida: '{text}'"
    except Exception as e:
        error = str(e)

    fallback_col = ai_best_move(board, ai_player)
    return fallback_col, error
