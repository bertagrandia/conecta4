from typing import Optional
import copy

ROWS = 6
COLS = 7
EMPTY = 0
RED = 1
YELLOW = 2
BLUE = 3

Board = list[list[int]]


def empty_board() -> Board:
    return [[EMPTY] * COLS for _ in range(ROWS)]


def drop_piece(board: Board, column: int, player: int) -> tuple[Board, int]:
    if column < 0 or column >= COLS:
        raise ValueError("Column out of range")
    for row in range(ROWS - 1, -1, -1):
        if board[row][column] == EMPTY:
            new_board = copy.deepcopy(board)
            new_board[row][column] = player
            return new_board, row
    raise ValueError("Column is full")


def check_winner(board: Board) -> Optional[tuple[int, list[list[int]]]]:
    directions = [(0, 1), (1, 0), (1, 1), (1, -1)]
    for r in range(ROWS):
        for c in range(COLS):
            player = board[r][c]
            if player == EMPTY:
                continue
            for dr, dc in directions:
                cells = [(r + i * dr, c + i * dc) for i in range(4)]
                if all(
                    0 <= nr < ROWS and 0 <= nc < COLS and board[nr][nc] == player
                    for nr, nc in cells
                ):
                    return player, [[nr, nc] for nr, nc in cells]
    return None


def is_draw(board: Board) -> bool:
    return all(board[0][c] != EMPTY for c in range(COLS))


def get_valid_columns(board: Board) -> list[int]:
    return [c for c in range(COLS) if board[0][c] == EMPTY]


# ── Minimax AI ────────────────────────────────────────────────────────────────

_CENTER_COL = COLS // 2
_WINDOW = 4


def _score_window(window: list[int], player: int) -> int:
    opponent = RED if player == YELLOW else YELLOW
    score = 0
    if window.count(player) == 4:
        score += 100
    elif window.count(player) == 3 and window.count(EMPTY) == 1:
        score += 5
    elif window.count(player) == 2 and window.count(EMPTY) == 2:
        score += 2
    if window.count(opponent) == 3 and window.count(EMPTY) == 1:
        score -= 4
    return score


def _score_position(board: Board, player: int) -> int:
    score = 0

    center_array = [board[r][_CENTER_COL] for r in range(ROWS)]
    score += center_array.count(player) * 3

    for r in range(ROWS):
        row_array = board[r]
        for c in range(COLS - 3):
            score += _score_window(row_array[c : c + 4], player)

    for c in range(COLS):
        col_array = [board[r][c] for r in range(ROWS)]
        for r in range(ROWS - 3):
            score += _score_window(col_array[r : r + 4], player)

    for r in range(ROWS - 3):
        for c in range(COLS - 3):
            score += _score_window([board[r + i][c + i] for i in range(4)], player)

    for r in range(3, ROWS):
        for c in range(COLS - 3):
            score += _score_window([board[r - i][c + i] for i in range(4)], player)

    return score


def _is_terminal(board: Board) -> bool:
    return check_winner(board) is not None or is_draw(board)


def minimax(
    board: Board,
    depth: int,
    alpha: float,
    beta: float,
    maximizing: bool,
    ai_player: int,
) -> tuple[Optional[int], float]:
    human = RED if ai_player == YELLOW else YELLOW
    valid_cols = get_valid_columns(board)

    if _is_terminal(board):
        result = check_winner(board)
        if result:
            winner, _ = result
            if winner == ai_player:
                return None, 10_000_000 + depth
            else:
                return None, -(10_000_000 + depth)
        return None, 0.0

    if depth == 0:
        return None, float(_score_position(board, ai_player))

    if maximizing:
        value = float("-inf")
        best_col = valid_cols[0]
        for col in valid_cols:
            new_board, _ = drop_piece(board, col, ai_player)
            _, score = minimax(new_board, depth - 1, alpha, beta, False, ai_player)
            if score > value:
                value = score
                best_col = col
            alpha = max(alpha, value)
            if alpha >= beta:
                break
        return best_col, value
    else:
        value = float("inf")
        best_col = valid_cols[0]
        for col in valid_cols:
            new_board, _ = drop_piece(board, col, human)
            _, score = minimax(new_board, depth - 1, alpha, beta, True, ai_player)
            if score < value:
                value = score
                best_col = col
            beta = min(beta, value)
            if alpha >= beta:
                break
        return best_col, value


def ai_best_move(board: Board, ai_player: int = YELLOW, depth: int = 5) -> int:
    col, _ = minimax(board, depth, float("-inf"), float("inf"), True, ai_player)
    valid = get_valid_columns(board)
    return col if col is not None and col in valid else valid[0]
