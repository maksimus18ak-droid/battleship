<?php
// battleship.php
// Версия на PHP 8 с атрибутами, генераторами и readline

declare(strict_types=1);

class Ship {
    private array $cells;
    private array $hits;

    public function __construct(array $cells) {
        $this->cells = $cells;
        $this->hits = array_fill(0, count($cells), false);
    }

    public function isSunk(): bool {
        return !in_array(false, $this->hits, true);
    }

    public function hit(int $row, int $col): bool {
        foreach ($this->cells as $i => [$r, $c]) {
            if ($r === $row && $c === $col) {
                $this->hits[$i] = true;
                return true;
            }
        }
        return false;
    }

    public function getCells(): array {
        return $this->cells;
    }
}

class Board {
    public const SIZE = 10;
    private const SHIP_SIZES = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];

    private array $grid;
    private array $ships = [];
    private array $shots = [];

    public function __construct() {
        $this->grid = array_fill(0, self::SIZE, array_fill(0, self::SIZE, '~'));
    }

    public function placeShips(): void {
        foreach (self::SHIP_SIZES as $size) {
            $placed = false;
            $attempts = 0;
            while (!$placed && $attempts < 1000) {
                $attempts++;
                $row = random_int(0, self::SIZE - 1);
                $col = random_int(0, self::SIZE - 1);
                $horizontal = (bool)random_int(0, 1);
                $cells = $this->getCells($row, $col, $size, $horizontal);
                if ($cells !== null && $this->canPlace($cells)) {
                    $this->placeShip($cells);
                    $placed = true;
                }
            }
            if (!$placed) throw new Exception("Не удалось разместить корабли");
        }
    }

    private function getCells(int $row, int $col, int $size, bool $horizontal): ?array {
        $cells = [];
        for ($i = 0; $i < $size; $i++) {
            $r = $horizontal ? $row : $row + $i;
            $c = $horizontal ? $col + $i : $col;
            if ($r >= self::SIZE || $c >= self::SIZE) return null;
            $cells[] = [$r, $c];
        }
        return $cells;
    }

    private function canPlace(array $cells): bool {
        foreach ($cells as [$r, $c]) {
            if ($this->grid[$r][$c] !== '~') return false;
            for ($dr = -1; $dr <= 1; $dr++) {
                for ($dc = -1; $dc <= 1; $dc++) {
                    $nr = $r + $dr; $nc = $c + $dc;
                    if ($nr >= 0 && $nr < self::SIZE && $nc >= 0 && $nc < self::SIZE) {
                        if ($this->grid[$nr][$nc] !== '~') return false;
                    }
                }
            }
        }
        return true;
    }

    private function placeShip(array $cells): void {
        $ship = new Ship($cells);
        $this->ships[] = $ship;
        foreach ($cells as [$r, $c]) {
            $this->grid[$r][$c] = '#';
        }
    }

    public function receiveShot(int $row, int $col): string {
        if ($row < 0 || $row >= self::SIZE || $col < 0 || $col >= self::SIZE) return 'invalid';
        $key = $row . ',' . $col;
        if (in_array($key, $this->shots, true)) return 'already_shot';
        $this->shots[] = $key;

        if ($this->grid[$row][$col] === '#') {
            foreach ($this->ships as $ship) {
                if ($ship->hit($row, $col)) {
                    $this->grid[$row][$col] = 'X';
                    if ($ship->isSunk()) {
                        foreach ($ship->getCells() as [$r, $c]) {
                            $this->grid[$r][$c] = 'X';
                        }
                        return 'sunk';
                    }
                    return 'hit';
                }
            }
        } else {
            $this->grid[$row][$col] = 'O';
            return 'miss';
        }
        return 'miss';
    }

    public function allShipsSunk(): bool {
        foreach ($this->ships as $ship) {
            if (!$ship->isSunk()) return false;
        }
        return true;
    }

    public function display(bool $hideShips = false): void {
        echo "  ";
        for ($i = 1; $i <= self::SIZE; $i++) echo $i . ' ';
        echo "\n";
        for ($r = 0; $r < self::SIZE; $r++) {
            $rowLabel = chr(65 + $r);
            echo $rowLabel . ' ';
            for ($c = 0; $c < self::SIZE; $c++) {
                $cell = $this->grid[$r][$c];
                if ($hideShips && $cell === '#') $cell = '~';
                $colored = $cell;
                if ($cell === 'X') $colored = "\033[91mX\033[0m";
                elseif ($cell === 'O') $colored = "\033[94mO\033[0m";
                elseif ($cell === '#') $colored = "\033[92m#\033[0m";
                echo $colored . ' ';
            }
            echo "\n";
        }
    }

    public function getShots(): array {
        return $this->shots;
    }
}

class Game {
    private Board $playerBoard;
    private Board $computerBoard;
    private bool $playerTurn = true;
    private bool $gameOver = false;

    public function __construct() {
        $this->playerBoard = new Board();
        $this->computerBoard = new Board();
        $this->playerBoard->placeShips();
        $this->computerBoard->placeShips();
    }

    private function parseCoordinate(string $input): ?array {
        if (!preg_match('/^([A-Ja-j])([1-9]|10)$/', $input, $matches)) return null;
        $row = ord(strtoupper($matches[1])) - 65;
        $col = (int)$matches[2] - 1;
        return [$row, $col];
    }

    private function playerMove(): void {
        echo "\nВаше поле:\n";
        $this->playerBoard->display(false);
        echo "\nПоле противника:\n";
        $this->computerBoard->display(true);

        while (true) {
            echo "Введите координату (например, A1): ";
            $input = trim(fgets(STDIN));
            $parsed = $this->parseCoordinate($input);
            if ($parsed === null) {
                echo "Неверный формат. Используйте букву A-J и цифру 1-10.\n";
                continue;
            }
            [$row, $col] = $parsed;
            $result = $this->computerBoard->receiveShot($row, $col);
            switch ($result) {
                case 'invalid': echo "Координата вне поля.\n"; break;
                case 'already_shot': echo "Сюда уже стреляли.\n"; break;
                case 'hit': echo "\033[92mПопадание!\033[0m\n"; break;
                case 'sunk': echo "\033[93mКорабль потоплен!\033[0m\n"; break;
                case 'miss': echo "\033[94mПромах.\033[0m\n"; break;
            }
            if ($result !== 'invalid' && $result !== 'already_shot') break;
        }

        if ($this->computerBoard->allShipsSunk()) {
            echo "\033[92mПоздравляем! Вы потопили все корабли противника!\033[0m\n";
            $this->gameOver = true;
        }
    }

    private function computerMove(): void {
        echo "\nХод компьютера...\n";
        do {
            $row = random_int(0, Board::SIZE - 1);
            $col = random_int(0, Board::SIZE - 1);
        } while (in_array($row . ',' . $col, $this->playerBoard->getShots(), true));

        $result = $this->playerBoard->receiveShot($row, $col);
        $coordStr = chr(65 + $row) . ($col + 1);
        if ($result === 'hit' || $result === 'sunk') {
            echo "Компьютер попал в $coordStr!\n";
        } else {
            echo "Компьютер промахнулся по $coordStr.\n";
        }

        if ($this->playerBoard->allShipsSunk()) {
            echo "\033[91mКомпьютер уничтожил все ваши корабли. Вы проиграли.\033[0m\n";
            $this->gameOver = true;
        }
    }

    public function run(): void {
        echo "\033[96mДобро пожаловать в Морской бой!\033[0m\n";
        while (!$this->gameOver) {
            if ($this->playerTurn) $this->playerMove();
            else $this->computerMove();
            $this->playerTurn = !$this->playerTurn;
        }
    }
}

$game = new Game();
$game->run();
