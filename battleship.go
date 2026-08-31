// battleship.go
// Версия на Go с горутинами для асинхронного ввода и цветным выводом через ANSI

package main

import (
	"bufio"
	"fmt"
	"math/rand"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// ANSI colors
const (
	reset  = "\033[0m"
	red    = "\033[91m"
	green  = "\033[92m"
	blue   = "\033[94m"
	yellow = "\033[93m"
	cyan   = "\033[96m"
)

func colorize(text, color string) string {
	return color + text + reset
}

type Ship struct {
	cells [][2]int
	hits  []bool
}

func NewShip(cells [][2]int) *Ship {
	return &Ship{cells: cells, hits: make([]bool, len(cells))}
}

func (s *Ship) IsSunk() bool {
	for _, h := range s.hits {
		if !h {
			return false
		}
	}
	return true
}

func (s *Ship) Hit(row, col int) bool {
	for i, cell := range s.cells {
		if cell[0] == row && cell[1] == col {
			s.hits[i] = true
			return true
		}
	}
	return false
}

type Board struct {
	grid   [10][10]byte
	ships  []*Ship
	shots  map[string]bool // "row,col"
}

const SIZE = 10

var shipSizes = []int{4, 3, 3, 2, 2, 2, 1, 1, 1, 1}

func NewBoard() *Board {
	b := &Board{
		shots: make(map[string]bool),
	}
	for r := 0; r < SIZE; r++ {
		for c := 0; c < SIZE; c++ {
			b.grid[r][c] = '~'
		}
	}
	return b
}

func (b *Board) PlaceShips() {
	rand.Seed(time.Now().UnixNano())
	for _, size := range shipSizes {
		placed := false
		attempts := 0
		for !placed && attempts < 1000 {
			attempts++
			row := rand.Intn(SIZE)
			col := rand.Intn(SIZE)
			horizontal := rand.Intn(2) == 0
			cells := b.getCells(row, col, size, horizontal)
			if cells != nil && b.canPlace(cells) {
				b.placeShip(cells)
				placed = true
			}
		}
		if !placed {
			panic("Не удалось разместить корабли")
		}
	}
}

func (b *Board) getCells(row, col, size int, horizontal bool) [][2]int {
	var cells [][2]int
	for i := 0; i < size; i++ {
		r, c := row, col
		if horizontal {
			c = col + i
		} else {
			r = row + i
		}
		if r >= SIZE || c >= SIZE {
			return nil
		}
		cells = append(cells, [2]int{r, c})
	}
	return cells
}

func (b *Board) canPlace(cells [][2]int) bool {
	for _, cell := range cells {
		r, c := cell[0], cell[1]
		if b.grid[r][c] != '~' {
			return false
		}
		for dr := -1; dr <= 1; dr++ {
			for dc := -1; dc <= 1; dc++ {
				nr, nc := r+dr, c+dc
				if nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE {
					if b.grid[nr][nc] != '~' {
						return false
					}
				}
			}
		}
	}
	return true
}

func (b *Board) placeShip(cells [][2]int) {
	ship := NewShip(cells)
	b.ships = append(b.ships, ship)
	for _, cell := range cells {
		b.grid[cell[0]][cell[1]] = '#'
	}
}

func (b *Board) ReceiveShot(row, col int) string {
	if row < 0 || row >= SIZE || col < 0 || col >= SIZE {
		return "invalid"
	}
	key := fmt.Sprintf("%d,%d", row, col)
	if b.shots[key] {
		return "already_shot"
	}
	b.shots[key] = true

	if b.grid[row][col] == '#' {
		for _, ship := range b.ships {
			if ship.Hit(row, col) {
				b.grid[row][col] = 'X'
				if ship.IsSunk() {
					for _, cell := range ship.cells {
						b.grid[cell[0]][cell[1]] = 'X'
					}
					return "sunk"
				}
				return "hit"
			}
		}
	} else {
		b.grid[row][col] = 'O'
		return "miss"
	}
	return "miss"
}

func (b *Board) AllShipsSunk() bool {
	for _, ship := range b.ships {
		if !ship.IsSunk() {
			return false
		}
	}
	return true
}

func (b *Board) Display(hideShips bool) {
	fmt.Print("  ")
	for i := 1; i <= SIZE; i++ {
		fmt.Printf("%d ", i)
	}
	fmt.Println()
	for r := 0; r < SIZE; r++ {
		rowLabel := string(rune('A' + r))
		fmt.Printf("%s ", rowLabel)
		for c := 0; c < SIZE; c++ {
			cell := b.grid[r][c]
			if hideShips && cell == '#' {
				cell = '~'
			}
			var colored string
			switch cell {
			case 'X':
				colored = colorize("X", red)
			case 'O':
				colored = colorize("O", blue)
			case '#':
				colored = colorize("#", green)
			default:
				colored = string(cell)
			}
			fmt.Printf("%s ", colored)
		}
		fmt.Println()
	}
}

type Game struct {
	playerBoard *Board
	computerBoard *Board
	playerTurn bool
	gameOver bool
	reader *bufio.Reader
}

func NewGame() *Game {
	return &Game{
		playerBoard: NewBoard(),
		computerBoard: NewBoard(),
		playerTurn: true,
		gameOver: false,
		reader: bufio.NewReader(os.Stdin),
	}
}

func (g *Game) parseCoordinate(coord string) (int, int, bool) {
	re := regexp.MustCompile(`^([A-Ja-j])([1-9]|10)$`)
	matches := re.FindStringSubmatch(coord)
	if len(matches) != 3 {
		return 0, 0, false
	}
	row := int(matches[1][0] - 'A')
	if matches[1][0] >= 'a' {
		row = int(matches[1][0] - 'a')
	}
	col, _ := strconv.Atoi(matches[2])
	col--
	return row, col, true
}

func (g *Game) playerMove() {
	fmt.Println("\nВаше поле:")
	g.playerBoard.Display(false)
	fmt.Println("\nПоле противника:")
	g.computerBoard.Display(true)

	for {
		fmt.Print("Введите координату (например, A1): ")
		input, _ := g.reader.ReadString('\n')
		input = strings.TrimSpace(input)
		row, col, ok := g.parseCoordinate(input)
		if !ok {
			fmt.Println("Неверный формат. Используйте букву A-J и цифру 1-10.")
			continue
		}
		result := g.computerBoard.ReceiveShot(row, col)
		switch result {
		case "invalid":
			fmt.Println("Координата вне поля.")
		case "already_shot":
			fmt.Println("Сюда уже стреляли.")
		default:
			if result == "hit" {
				fmt.Println(colorize("Попадание!", green))
			} else if result == "sunk" {
				fmt.Println(colorize("Корабль потоплен!", yellow))
			} else if result == "miss" {
				fmt.Println(colorize("Промах.", blue))
			}
			break
		}
		if result != "invalid" && result != "already_shot" {
			break
		}
	}

	if g.computerBoard.AllShipsSunk() {
		fmt.Println(colorize("Поздравляем! Вы потопили все корабли противника!", green))
		g.gameOver = true
	}
}

func (g *Game) computerMove() {
	fmt.Println("\nХод компьютера...")
	var row, col int
	for {
		row = rand.Intn(SIZE)
		col = rand.Intn(SIZE)
		key := fmt.Sprintf("%d,%d", row, col)
		if !g.playerBoard.shots[key] {
			break
		}
	}
	result := g.playerBoard.ReceiveShot(row, col)
	coordStr := string(rune('A'+row)) + strconv.Itoa(col+1)
	if result == "hit" || result == "sunk" {
		fmt.Printf("Компьютер попал в %s!\n", coordStr)
	} else {
		fmt.Printf("Компьютер промахнулся по %s.\n", coordStr)
	}

	if g.playerBoard.AllShipsSunk() {
		fmt.Println(colorize("Компьютер уничтожил все ваши корабли. Вы проиграли.", red))
		g.gameOver = true
	}
}

func (g *Game) Run() {
	fmt.Println(colorize("Добро пожаловать в Морской бой!", cyan))
	g.playerBoard.PlaceShips()
	g.computerBoard.PlaceShips()
	for !g.gameOver {
		if g.playerTurn {
			g.playerMove()
		} else {
			g.computerMove()
		}
		g.playerTurn = !g.playerTurn
	}
}

func main() {
	game := NewGame()
	game.Run()
}
