# battleship.py
# Версия на Python с dataclasses, type hints, цветным выводом (colorama не используется, используем ANSI-коды)

import random
import sys
import re
from dataclasses import dataclass
from typing import List, Tuple, Optional

# ANSI-цвета для терминала
COLORS = {
    'reset': '\033[0m',
    'red': '\033[91m',
    'green': '\033[92m',
    'blue': '\033[94m',
    'yellow': '\033[93m',
    'cyan': '\033[96m',
}


def colorize(text: str, color: str) -> str:
    return f"{COLORS.get(color, '')}{text}{COLORS['reset']}"


@dataclass
class Ship:
    """Класс корабля."""
    cells: List[Tuple[int, int]]
    hits: List[bool]  # список попаданий по каждой клетке

    def is_sunk(self) -> bool:
        return all(self.hits)

    def hit(self, row: int, col: int) -> bool:
        for i, (r, c) in enumerate(self.cells):
            if r == row and c == col:
                self.hits[i] = True
                return True
        return False


class Board:
    """Игровое поле."""
    SIZE = 10
    SHIP_SIZES = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1]

    def __init__(self):
        self.grid = [['~' for _ in range(self.SIZE)] for _ in range(self.SIZE)]
        self.ships: List[Ship] = []
        self.shots: List[Tuple[int, int]] = []  # все выстрелы по этому полю

    def place_ships(self) -> None:
        """Случайно расставляет корабли."""
        for size in self.SHIP_SIZES:
            placed = False
            attempts = 0
            while not placed and attempts < 1000:
                attempts += 1
                row = random.randint(0, self.SIZE - 1)
                col = random.randint(0, self.SIZE - 1)
                horizontal = random.choice([True, False])
                cells = self._get_cells(row, col, size, horizontal)
                if cells and self._can_place(cells):
                    self._place_ship(cells)
                    placed = True
            if not placed:
                raise RuntimeError("Не удалось разместить корабли")

    def _get_cells(self, row: int, col: int, size: int, horizontal: bool) -> Optional[List[Tuple[int, int]]]:
        cells = []
        for i in range(size):
            r = row if horizontal else row + i
            c = col + i if horizontal else col
            if r >= self.SIZE or c >= self.SIZE:
                return None
            cells.append((r, c))
        return cells

    def _can_place(self, cells: List[Tuple[int, int]]) -> bool:
        for r, c in cells:
            if self.grid[r][c] != '~':
                return False
            # Проверка соседей (чтобы корабли не касались)
            for dr in (-1, 0, 1):
                for dc in (-1, 0, 1):
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < self.SIZE and 0 <= nc < self.SIZE:
                        if self.grid[nr][nc] != '~':
                            return False
        return True

    def _place_ship(self, cells: List[Tuple[int, int]]) -> None:
        ship = Ship(cells, [False] * len(cells))
        self.ships.append(ship)
        for r, c in cells:
            self.grid[r][c] = '#'

    def receive_shot(self, row: int, col: int) -> str:
        """Обрабатывает выстрел по полю. Возвращает 'hit', 'miss', 'sunk', 'invalid'."""
        if not (0 <= row < self.SIZE and 0 <= col < self.SIZE):
            return 'invalid'
        if (row, col) in self.shots:
            return 'already_shot'
        self.shots.append((row, col))
        if self.grid[row][col] == '#':
            # Попадание
            for ship in self.ships:
                if ship.hit(row, col):
                    self.grid[row][col] = 'X'
                    if ship.is_sunk():
                        # Отметить все клетки корабля как X
                        for r, c in ship.cells:
                            self.grid[r][c] = 'X'
                        return 'sunk'
                    return 'hit'
        else:
            self.grid[row][col] = 'O'
            return 'miss'
        return 'miss'  # fallback

    def all_ships_sunk(self) -> bool:
        return all(ship.is_sunk() for ship in self.ships)

    def display(self, hide_ships: bool = False) -> None:
        """Вывод поля."""
        print('  ' + ' '.join(str(i+1) for i in range(self.SIZE)))
        for r in range(self.SIZE):
            row_label = chr(ord('A') + r)
            row_cells = []
            for c in range(self.SIZE):
                cell = self.grid[r][c]
                if hide_ships and cell == '#':
                    cell = '~'
                if cell == 'X':
                    row_cells.append(colorize('X', 'red'))
                elif cell == 'O':
                    row_cells.append(colorize('O', 'blue'))
                elif cell == '#':
                    row_cells.append(colorize('#', 'green'))
                else:
                    row_cells.append(cell)
            print(f"{row_label} " + ' '.join(row_cells))


class BattleshipGame:
    def __init__(self):
        self.player_board = Board()
        self.computer_board = Board()
        self.player_board.place_ships()
        self.computer_board.place_ships()
        self.player_turn = True
        self.game_over = False

    def parse_coordinate(self, coord: str) -> Optional[Tuple[int, int]]:
        """Преобразует 'A1' в (row, col)."""
        match = re.match(r'^([A-Ja-j])([1-9]|10)$', coord)
        if not match:
            return None
        row = ord(match.group(1).upper()) - ord('A')
        col = int(match.group(2)) - 1
        return row, col

    def player_move(self) -> None:
        print("\nВаше поле:")
        self.player_board.display(hide_ships=False)
        print("\nПоле противника:")
        self.computer_board.display(hide_ships=True)

        while True:
            coord = input("Введите координату (например, A1): ").strip()
            parsed = self.parse_coordinate(coord)
            if parsed is None:
                print("Неверный формат. Используйте букву A-J и цифру 1-10.")
                continue
            row, col = parsed
            result = self.computer_board.receive_shot(row, col)
            if result == 'invalid':
                print("Координата вне поля.")
            elif result == 'already_shot':
                print("Сюда уже стреляли.")
            else:
                if result == 'hit':
                    print(colorize("Попадание!", 'green'))
                elif result == 'sunk':
                    print(colorize("Корабль потоплен!", 'yellow'))
                elif result == 'miss':
                    print(colorize("Промах.", 'blue'))
                break

        # Проверка победы
        if self.computer_board.all_ships_sunk():
            print(colorize("Поздравляем! Вы потопили все корабли противника!", 'green'))
            self.game_over = True

    def computer_move(self) -> None:
        print("\nХод компьютера...")
        # Случайный выстрел
        while True:
            row = random.randint(0, Board.SIZE - 1)
            col = random.randint(0, Board.SIZE - 1)
            if (row, col) not in self.player_board.shots:
                break
        result = self.player_board.receive_shot(row, col)
        if result == 'hit' or result == 'sunk':
            print(f"Компьютер попал в {chr(ord('A')+row)}{col+1}!")
        else:
            print(f"Компьютер промахнулся по {chr(ord('A')+row)}{col+1}.")

        if self.player_board.all_ships_sunk():
            print(colorize("Компьютер уничтожил все ваши корабли. Вы проиграли.", 'red'))
            self.game_over = True

    def run(self) -> None:
        print(colorize("Добро пожаловать в Морской бой!", 'cyan'))
        while not self.game_over:
            if self.player_turn:
                self.player_move()
            else:
                self.computer_move()
            self.player_turn = not self.player_turn


if __name__ == '__main__':
    game = BattleshipGame()
    game.run()
