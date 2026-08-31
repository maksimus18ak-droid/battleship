// battleship.ts
// Версия на TypeScript с строгой типизацией, декораторами (экспериментальными) и async/await

import * as readline from 'readline';

// Декоратор для логирования
function logMethod(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const original = descriptor.value;
    descriptor.value = function (...args: any[]) {
        console.log(`[LOG] ${propertyKey} вызван с`, args);
        return original.apply(this, args);
    };
    return descriptor;
}

// ANSI colors
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[91m',
    green: '\x1b[92m',
    blue: '\x1b[94m',
    yellow: '\x1b[93m',
    cyan: '\x1b[96m'
};

function colorize(text: string, color: keyof typeof colors): string {
    return `${colors[color]}${text}${colors.reset}`;
}

type Coord = [number, number]; // [row, col]

class Ship {
    constructor(public readonly cells: Coord[], private hits: boolean[] = new Array(cells.length).fill(false)) {}

    isSunk(): boolean {
        return this.hits.every(h => h);
    }

    hit(row: number, col: number): boolean {
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
    static readonly SIZE = 10;
    private static readonly SHIP_SIZES = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];

    private grid: string[][] = Array.from({ length: Board.SIZE }, () => Array(Board.SIZE).fill('~'));
    private ships: Ship[] = [];
    private shots: Set<string> = new Set(); // "row,col"

    placeShips(): void {
        for (const size of Board.SHIP_SIZES) {
            let placed = false;
            let attempts = 0;
            while (!placed && attempts < 1000) {
                attempts++;
                const row = Math.floor(Math.random() * Board.SIZE);
                const col = Math.floor(Math.random() * Board.SIZE);
                const horizontal = Math.random() < 0.5;
                const cells = this.getCells(row, col, size, horizontal);
                if (cells && this.canPlace(cells)) {
                    this.placeShip(cells);
                    placed = true;
                }
            }
            if (!placed) throw new Error('Не удалось разместить корабли');
        }
    }

    private getCells(row: number, col: number, size: number, horizontal: boolean): Coord[] | null {
        const cells: Coord[] = [];
        for (let i = 0; i < size; i++) {
            const r = horizontal ? row : row + i;
            const c = horizontal ? col + i : col;
            if (r >= Board.SIZE || c >= Board.SIZE) return null;
            cells.push([r, c]);
        }
        return cells;
    }

    private canPlace(cells: Coord[]): boolean {
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

    private placeShip(cells: Coord[]): void {
        const ship = new Ship(cells);
        this.ships.push(ship);
        for (const [r, c] of cells) {
            this.grid[r][c] = '#';
        }
    }

    receiveShot(row: number, col: number): 'hit' | 'miss' | 'sunk' | 'invalid' | 'already_shot' {
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

    allShipsSunk(): boolean {
        return this.ships.every(s => s.isSunk());
    }

    display(hideShips: boolean = false): void {
        console.log('  ' + Array.from({ length: Board.SIZE }, (_, i) => i + 1).join(' '));
        for (let r = 0; r < Board.SIZE; r++) {
            const rowLabel = String.fromCharCode(65 + r);
            let rowCells: string[] = [];
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

    getShots(): Set<string> {
        return this.shots;
    }
}

class Game {
    private playerBoard = new Board();
    private computerBoard = new Board();
    private playerTurn = true;
    private gameOver = false;
    private rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    constructor() {
        this.playerBoard.placeShips();
        this.computerBoard.placeShips();
    }

    private parseCoordinate(coord: string): Coord | null {
        const match = coord.match(/^([A-Ja-j])([1-9]|10)$/);
        if (!match) return null;
        const row = match[1].toUpperCase().charCodeAt(0) - 65;
        const col = parseInt(match[2], 10) - 1;
        return [row, col];
    }

    @logMethod
    private async playerMove(): Promise<void> {
        console.log('\nВаше поле:');
        this.playerBoard.display(false);
        console.log('\nПоле противника:');
        this.computerBoard.display(true);

        while (true) {
            const answer = await this.question('Введите координату (например, A1): ');
            const parsed = this.parseCoordinate(answer.trim());
            if (!parsed) {
                console.log('Неверный формат. Используйте букву A-J и цифру 1-10.');
                continue;
            }
            const [row, col] = parsed;
            const result = this.computerBoard.receiveShot(row, col);
            switch (result) {
                case 'invalid': console.log('Координата вне поля.'); break;
                case 'already_shot': console.log('Сюда уже стреляли.'); break;
                case 'hit': console.log(colorize('Попадание!', 'green')); break;
                case 'sunk': console.log(colorize('Корабль потоплен!', 'yellow')); break;
                case 'miss': console.log(colorize('Промах.', 'blue')); break;
            }
            if (result !== 'invalid' && result !== 'already_shot') break;
        }

        if (this.computerBoard.allShipsSunk()) {
            console.log(colorize('Поздравляем! Вы потопили все корабли противника!', 'green'));
            this.gameOver = true;
        }
    }

    @logMethod
    private computerMove(): void {
        console.log('\nХод компьютера...');
        let row: number, col: number;
        do {
            row = Math.floor(Math.random() * Board.SIZE);
            col = Math.floor(Math.random() * Board.SIZE);
        } while (this.playerBoard.getShots().has(`${row},${col}`));

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

    private question(prompt: string): Promise<string> {
        return new Promise(resolve => this.rl.question(prompt, resolve));
    }

    async run(): Promise<void> {
        console.log(colorize('Добро пожаловать в Морской бой!', 'cyan'));
        while (!this.gameOver) {
            if (this.playerTurn) {
                await this.playerMove();
            } else {
                this.computerMove();
            }
            this.playerTurn = !this.playerTurn;
        }
        this.rl.close();
    }
}

const game = new Game();
game.run().catch(console.error);
