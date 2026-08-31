// Battleship.java
// Версия на Java с record, enum, Stream API, Scanner

import java.util.*;
import java.util.regex.Pattern;

public class Battleship {

    // ANSI-цвета (поддерживаются не везде, но для красоты)
    private static final String RESET = "\033[0m";
    private static final String RED = "\033[91m";
    private static final String GREEN = "\033[92m";
    private static final String BLUE = "\033[94m";
    private static final String YELLOW = "\033[93m";
    private static final String CYAN = "\033[96m";

    private static String colorize(String text, String color) {
        return color + text + RESET;
    }

    // Класс для координат
    public record Coord(int row, int col) {}

    // Класс корабля
    public static class Ship {
        private final List<Coord> cells;
        private final boolean[] hits;

        public Ship(List<Coord> cells) {
            this.cells = cells;
            this.hits = new boolean[cells.size()];
        }

        public boolean isSunk() {
            for (boolean h : hits) if (!h) return false;
            return true;
        }

        public boolean hit(Coord coord) {
            for (int i = 0; i < cells.size(); i++) {
                if (cells.get(i).equals(coord)) {
                    hits[i] = true;
                    return true;
                }
            }
            return false;
        }

        public List<Coord> getCells() { return cells; }
    }

    // Игровое поле
    public static class Board {
        public static final int SIZE = 10;
        private static final int[] SHIP_SIZES = {4, 3, 3, 2, 2, 2, 1, 1, 1, 1};

        private final char[][] grid = new char[SIZE][SIZE];
        private final List<Ship> ships = new ArrayList<>();
        private final Set<Coord> shots = new HashSet<>();

        public Board() {
            for (int r = 0; r < SIZE; r++) {
                Arrays.fill(grid[r], '~');
            }
        }

        public void placeShips() {
            Random rand = new Random();
            for (int size : SHIP_SIZES) {
                boolean placed = false;
                int attempts = 0;
                while (!placed && attempts < 1000) {
                    attempts++;
                    int row = rand.nextInt(SIZE);
                    int col = rand.nextInt(SIZE);
                    boolean horizontal = rand.nextBoolean();
                    List<Coord> cells = getCells(row, col, size, horizontal);
                    if (cells != null && canPlace(cells)) {
                        placeShip(cells);
                        placed = true;
                    }
                }
                if (!placed) throw new RuntimeException("Не удалось разместить корабли");
            }
        }

        private List<Coord> getCells(int row, int col, int size, boolean horizontal) {
            List<Coord> cells = new ArrayList<>();
            for (int i = 0; i < size; i++) {
                int r = horizontal ? row : row + i;
                int c = horizontal ? col + i : col;
                if (r >= SIZE || c >= SIZE) return null;
                cells.add(new Coord(r, c));
            }
            return cells;
        }

        private boolean canPlace(List<Coord> cells) {
            for (Coord coord : cells) {
                int r = coord.row(), c = coord.col();
                if (grid[r][c] != '~') return false;
                for (int dr = -1; dr <= 1; dr++) {
                    for (int dc = -1; dc <= 1; dc++) {
                        int nr = r + dr, nc = c + dc;
                        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
                            if (grid[nr][nc] != '~') return false;
                        }
                    }
                }
            }
            return true;
        }

        private void placeShip(List<Coord> cells) {
            Ship ship = new Ship(cells);
            ships.add(ship);
            for (Coord coord : cells) {
                grid[coord.row()][coord.col()] = '#';
            }
        }

        public String receiveShot(Coord coord) {
            int r = coord.row(), c = coord.col();
            if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return "invalid";
            if (shots.contains(coord)) return "already_shot";
            shots.add(coord);

            if (grid[r][c] == '#') {
                for (Ship ship : ships) {
                    if (ship.hit(coord)) {
                        grid[r][c] = 'X';
                        if (ship.isSunk()) {
                            for (Coord sc : ship.getCells()) {
                                grid[sc.row()][sc.col()] = 'X';
                            }
                            return "sunk";
                        }
                        return "hit";
                    }
                }
            } else {
                grid[r][c] = 'O';
                return "miss";
            }
            return "miss";
        }

        public boolean allShipsSunk() {
            return ships.stream().allMatch(Ship::isSunk);
        }

        public void display(boolean hideShips) {
            System.out.print("  ");
            for (int i = 1; i <= SIZE; i++) System.out.print(i + " ");
            System.out.println();
            for (int r = 0; r < SIZE; r++) {
                char rowLabel = (char) ('A' + r);
                System.out.print(rowLabel + " ");
                for (int c = 0; c < SIZE; c++) {
                    char cell = grid[r][c];
                    if (hideShips && cell == '#') cell = '~';
                    String colored;
                    switch (cell) {
                        case 'X': colored = colorize("X", RED); break;
                        case 'O': colored = colorize("O", BLUE); break;
                        case '#': colored = colorize("#", GREEN); break;
                        default: colored = String.valueOf(cell);
                    }
                    System.out.print(colored + " ");
                }
                System.out.println();
            }
        }

        public Set<Coord> getShots() { return shots; }
    }

    // Игра
    public static class Game {
        private final Board playerBoard = new Board();
        private final Board computerBoard = new Board();
        private boolean playerTurn = true;
        private boolean gameOver = false;
        private final Scanner scanner = new Scanner(System.in);

        public Game() {
            playerBoard.placeShips();
            computerBoard.placeShips();
        }

        private Coord parseCoordinate(String input) {
            Pattern pattern = Pattern.compile("^([A-Ja-j])([1-9]|10)$");
            var matcher = pattern.matcher(input);
            if (!matcher.matches()) return null;
            int row = matcher.group(1).toUpperCase().charAt(0) - 'A';
            int col = Integer.parseInt(matcher.group(2)) - 1;
            return new Coord(row, col);
        }

        private void playerMove() {
            System.out.println("\nВаше поле:");
            playerBoard.display(false);
            System.out.println("\nПоле противника:");
            computerBoard.display(true);

            while (true) {
                System.out.print("Введите координату (например, A1): ");
                String input = scanner.nextLine().trim();
                Coord coord = parseCoordinate(input);
                if (coord == null) {
                    System.out.println("Неверный формат. Используйте букву A-J и цифру 1-10.");
                    continue;
                }
                String result = computerBoard.receiveShot(coord);
                switch (result) {
                    case "invalid": System.out.println("Координата вне поля."); break;
                    case "already_shot": System.out.println("Сюда уже стреляли."); break;
                    case "hit": System.out.println(colorize("Попадание!", GREEN)); break;
                    case "sunk": System.out.println(colorize("Корабль потоплен!", YELLOW)); break;
                    case "miss": System.out.println(colorize("Промах.", BLUE)); break;
                }
                if (!result.equals("invalid") && !result.equals("already_shot")) break;
            }

            if (computerBoard.allShipsSunk()) {
                System.out.println(colorize("Поздравляем! Вы потопили все корабли противника!", GREEN));
                gameOver = true;
            }
        }

        private void computerMove() {
            System.out.println("\nХод компьютера...");
            Random rand = new Random();
            Coord coord;
            do {
                int row = rand.nextInt(Board.SIZE);
                int col = rand.nextInt(Board.SIZE);
                coord = new Coord(row, col);
            } while (playerBoard.getShots().contains(coord));

            String result = playerBoard.receiveShot(coord);
            char rowChar = (char) ('A' + coord.row());
            String coordStr = rowChar + String.valueOf(coord.col() + 1);
            if (result.equals("hit") || result.equals("sunk")) {
                System.out.println("Компьютер попал в " + coordStr + "!");
            } else {
                System.out.println("Компьютер промахнулся по " + coordStr + ".");
            }

            if (playerBoard.allShipsSunk()) {
                System.out.println(colorize("Компьютер уничтожил все ваши корабли. Вы проиграли.", RED));
                gameOver = true;
            }
        }

        public void run() {
            System.out.println(colorize("Добро пожаловать в Морской бой!", CYAN));
            while (!gameOver) {
                if (playerTurn) playerMove();
                else computerMove();
                playerTurn = !playerTurn;
            }
        }
    }

    public static void main(String[] args) {
        new Game().run();
    }
}
