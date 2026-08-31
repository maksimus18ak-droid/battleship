// battleship.js
// Версия на JavaScript с использованием readline, классов, async/await

const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Цвета для терминала (ANSI)
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[91m',
    green: '\x1b[92m',
    blue: '\x1b[94m',
    yellow: '\x1b[93m',
    cyan: '\x1b[96m'
};

function colorize(text, color) {
    return `${colors[color] || ''}${text}${colors.reset}`;
}

class Ship {
    constructor(cells) {
        this.cells = cells; // массив [row, col]
        this.hits = new Array(cells.length).fill(false);
    }

    isSunk() {
        return this.hits.every(h => h);
    }

    hit(row, col) {
        for (let i = 0; i < this.cells.length; i++) {
            const [r, c] = this.cells[i];
            if (r === row && c === col) {
                this.hits[i] = true;
                return true;
            }
        }
        return false;
    }
}

class Board {
    static SIZE = 10;
    static SHIP_SIZES = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];

    constructor() {
        this.grid = Array.from({ length: Board.SIZE }, () => Array(Board.SIZE).fill('~'));
        this.ships = [];
        this.shots = new Set(); // строки "row,col"
    }

    placeShips() {
        for (const size of Board.SHIP_SIZES) {
            let placed = false;
            let attempts = 0;
            while (!placed && attempts < 1000) {
                attempts++;
                const row = Math.floor(Math.random() * Board.SIZE);
                const col = Math.floor(Math.random() * Board.SIZE);
                const horizontal = Math.random() < 0.5;
                const cells = this._getCells(row, col, size, horizontal);
                if (cells && this._canPlace(cells)) {
                    this._placeShip(cells);
                    placed = true;
                }
            }
            if (!placed) throw new Error('Не удалось разместить корабли');
        }
    }

    _getCells(row, col, size, horizontal) {
        const cells = [];
        for (let i = 0; i < size; i++) {
            const r = horizontal ? row : row + i;
            const c = horizontal ? col + i : col;
            if (r >= Board.SIZE || c >= Board.SIZE) return null;
            cells.push([r, c]);
        }
        return cells;
    }

    _canPlace(cells) {
        for (const [r, c] of cells) {
            if (this.grid[r][c] !== '~') return false;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = r + dr, nc = c + dc;
                    if (nr >= 0 && nr < Board.SIZE && nc >= 0 && nc < Board.SIZE) {
                        if (this.grid[nr][nc] !== '~') return false;
                    }
                }
            }
        }
        return true;
    }

    _placeShip(cells) {
        const ship = new Ship(cells);
        this.ships.push(ship);
        for (const [r, c] of cells) {
            this.grid[r][c] = '#';
        }
    }

    receiveShot(row, col) {
        if (row < 0 || row >= Board.SIZE || col < 0 || col >= Board.SIZE) return 'invalid';
        const key = `${row},${col}`;
        if (this.shots.has(key)) return 'already_shot';
        this.shots.add(key);

        if (this.grid[row][col] === '#') {
            for (const ship of this.ships) {
                if (ship.hit(row, col)) {
                    this.grid[row][col] = 'X';
                    if (ship.isSunk()) {
                        for (const [r, c] of ship.cells) {
                            this.grid[r][c] = 'X';
                        }
                        return 'sunk';
                    }
                    return 'hit';
                }
            }
        } else {
            this.grid[row][col] = 'O';
            return 'miss';
        }
        return 'miss';
    }

    allShipsSunk() {
        return this.ships.every(ship => ship.isSunk());
    }

    display(hideShips = false) {
        console.log('  ' + Array.from({ length: Board.SIZE }, (_, i) => i + 1).join(' '));
        for (let r = 0; r < Board.SIZE; r++) {
            const rowLabel = String.fromCharCode(65 + r);
            let rowCells = [];
            for (let c = 0; c < Board.SIZE; c++) {
                let cell = this.grid[r][c];
                if (hideShips && cell === '#') cell = '~';
                let colored = cell;
                if (cell === 'X') colored = colorize('X', 'red');
                else if (cell === 'O') colored = colorize('O', 'blue');
                else if (cell === '#') colored = colorize('#', 'green');
                rowCells.push(colored);
            }
            console.log(rowLabel + ' ' + rowCells.join(' '));
        }
    }
}

class BattleshipGame {
    constructor() {
        this.playerBoard = new Board();
        this.computerBoard = new Board();
        this.playerBoard.placeShips();
        this.computerBoard.placeShips();
        this.playerTurn = true;
        this.gameOver = false;
    }

    parseCoordinate(coord) {
        const match = coord.match(/^([A-Ja-j])([1-9]|10)$/);
        if (!match) return null;
        const row = match[1].toUpperCase().charCodeAt(0) - 65;
        const col = parseInt(match[2], 10) - 1;
        return [row, col];
    }

    async playerMove() {
        console.log('\nВаше поле:');
        this.playerBoard.display(false);
        console.log('\nПоле противника:');
        this.computerBoard.display(true);

        while (true) {
            const coord = await this._question('Введите координату (например, A1): ');
            const parsed = this.parseCoordinate(coord.trim());
            if (!parsed) {
                console.log('Неверный формат. Используйте букву A-J и цифру 1-10.');
                continue;
            }
            const [row, col] = parsed;
            const result = this.computerBoard.receiveShot(row, col);
            if (result === 'invalid') {
                console.log('Координата вне поля.');
            } else if (result === 'already_shot') {
                console.log('Сюда уже стреляли.');
            } else {
                if (result === 'hit') console.log(colorize('Попадание!', 'green'));
                else if (result === 'sunk') console.log(colorize('Корабль потоплен!', 'yellow'));
                else if (result === 'miss') console.log(colorize('Промах.', 'blue'));
                break;
            }
        }

        if (this.computerBoard.allShipsSunk()) {
            console.log(colorize('Поздравляем! Вы потопили все корабли противника!', 'green'));
            this.gameOver = true;
        }
    }

    computerMove() {
        console.log('\nХод компьютера...');
        let row, col;
        do {
            row = Math.floor(Math.random() * Board.SIZE);
            col = Math.floor(Math.random() * Board.SIZE);
        } while (this.playerBoard.shots.has(`${row},${col}`));
        const result = this.playerBoard.receiveShot(row, col);
        const coordStr = String.fromCharCode(65 + row) + (col + 1);
        if (result === 'hit' || result === 'sunk') {
            console.log(`Компьютер попал в ${coordStr}!`);
        } else {
            console.log(`Компьютер промахнулся по ${coordStr}.`);
        }

        if (this.playerBoard.allShipsSunk()) {
            console.log(colorize('Компьютер уничтожил все ваши корабли. Вы проиграли.', 'red'));
            this.gameOver = true;
        }
    }

    _question(prompt) {
        return new Promise(resolve => rl.question(prompt, resolve));
    }

    async run() {
        console.log(colorize('Добро пожаловать в Морской бой!', 'cyan'));
        while (!this.gameOver) {
            if (this.playerTurn) {
                await this.playerMove();
            } else {
                this.computerMove();
            }
            this.playerTurn = !this.playerTurn;
        }
        rl.close();
    }
}

const game = new BattleshipGame();
game.run().catch(console.error);
