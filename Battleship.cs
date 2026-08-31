// Battleship.cs
// Версия на C# с record, top-level statements, LINQ

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

// ANSI colors
public static class Colors
{
    public const string Reset = "\x1b[0m";
    public const string Red = "\x1b[91m";
    public const string Green = "\x1b[92m";
    public const string Blue = "\x1b[94m";
    public const string Yellow = "\x1b[93m";
    public const string Cyan = "\x1b[96m";

    public static string Colorize(string text, string color) => color + text + Reset;
}

public record Coord(int Row, int Col);

public class Ship
{
    public List<Coord> Cells { get; }
    private bool[] Hits { get; }

    public Ship(List<Coord> cells)
    {
        Cells = cells;
        Hits = new bool[cells.Count];
    }

    public bool IsSunk() => Hits.All(h => h);

    public bool Hit(Coord coord)
    {
        for (int i = 0; i < Cells.Count; i++)
        {
            if (Cells[i] == coord)
            {
                Hits[i] = true;
                return true;
            }
        }
        return false;
    }
}

public class Board
{
    public const int Size = 10;
    private static readonly int[] ShipSizes = { 4, 3, 3, 2, 2, 2, 1, 1, 1, 1 };

    private readonly char[,] grid = new char[Size, Size];
    private readonly List<Ship> ships = new();
    private readonly HashSet<Coord> shots = new();

    public Board()
    {
        for (int r = 0; r < Size; r++)
            for (int c = 0; c < Size; c++)
                grid[r, c] = '~';
    }

    public void PlaceShips()
    {
        Random rand = new();
        foreach (int size in ShipSizes)
        {
            bool placed = false;
            int attempts = 0;
            while (!placed && attempts < 1000)
            {
                attempts++;
                int row = rand.Next(Size);
                int col = rand.Next(Size);
                bool horizontal = rand.Next(2) == 0;
                var cells = GetCells(row, col, size, horizontal);
                if (cells != null && CanPlace(cells))
                {
                    PlaceShip(cells);
                    placed = true;
                }
            }
            if (!placed) throw new Exception("Не удалось разместить корабли");
        }
    }

    private List<Coord>? GetCells(int row, int col, int size, bool horizontal)
    {
        var cells = new List<Coord>();
        for (int i = 0; i < size; i++)
        {
            int r = horizontal ? row : row + i;
            int c = horizontal ? col + i : col;
            if (r >= Size || c >= Size) return null;
            cells.Add(new Coord(r, c));
        }
        return cells;
    }

    private bool CanPlace(List<Coord> cells)
    {
        foreach (var coord in cells)
        {
            int r = coord.Row, c = coord.Col;
            if (grid[r, c] != '~') return false;
            for (int dr = -1; dr <= 1; dr++)
                for (int dc = -1; dc <= 1; dc++)
                {
                    int nr = r + dr, nc = c + dc;
                    if (nr >= 0 && nr < Size && nc >= 0 && nc < Size)
                        if (grid[nr, nc] != '~') return false;
                }
        }
        return true;
    }

    private void PlaceShip(List<Coord> cells)
    {
        var ship = new Ship(cells);
        ships.Add(ship);
        foreach (var coord in cells)
            grid[coord.Row, coord.Col] = '#';
    }

    public string ReceiveShot(Coord coord)
    {
        int r = coord.Row, c = coord.Col;
        if (r < 0 || r >= Size || c < 0 || c >= Size) return "invalid";
        if (shots.Contains(coord)) return "already_shot";
        shots.Add(coord);

        if (grid[r, c] == '#')
        {
            foreach (var ship in ships)
            {
                if (ship.Hit(coord))
                {
                    grid[r, c] = 'X';
                    if (ship.IsSunk())
                    {
                        foreach (var sc in ship.Cells)
                            grid[sc.Row, sc.Col] = 'X';
                        return "sunk";
                    }
                    return "hit";
                }
            }
        }
        else
        {
            grid[r, c] = 'O';
            return "miss";
        }
        return "miss";
    }

    public bool AllShipsSunk() => ships.All(s => s.IsSunk());

    public void Display(bool hideShips)
    {
        Console.Write("  ");
        for (int i = 1; i <= Size; i++) Console.Write($"{i} ");
        Console.WriteLine();
        for (int r = 0; r < Size; r++)
        {
            char rowLabel = (char)('A' + r);
            Console.Write($"{rowLabel} ");
            for (int c = 0; c < Size; c++)
            {
                char cell = grid[r, c];
                if (hideShips && cell == '#') cell = '~';
                string colored = cell switch
                {
                    'X' => Colors.Colorize("X", Colors.Red),
                    'O' => Colors.Colorize("O", Colors.Blue),
                    '#' => Colors.Colorize("#", Colors.Green),
                    _ => cell.ToString()
                };
                Console.Write($"{colored} ");
            }
            Console.WriteLine();
        }
    }

    public HashSet<Coord> Shots => shots;
}

public class Game
{
    private readonly Board playerBoard = new();
    private readonly Board computerBoard = new();
    private bool playerTurn = true;
    private bool gameOver = false;

    public Game()
    {
        playerBoard.PlaceShips();
        computerBoard.PlaceShips();
    }

    private Coord? ParseCoordinate(string input)
    {
        var match = Regex.Match(input, @"^([A-Ja-j])([1-9]|10)$");
        if (!match.Success) return null;
        int row = char.ToUpper(match.Groups[1].Value[0]) - 'A';
        int col = int.Parse(match.Groups[2].Value) - 1;
        return new Coord(row, col);
    }

    private void PlayerMove()
    {
        Console.WriteLine("\nВаше поле:");
        playerBoard.Display(false);
        Console.WriteLine("\nПоле противника:");
        computerBoard.Display(true);

        while (true)
        {
            Console.Write("Введите координату (например, A1): ");
            string? input = Console.ReadLine()?.Trim();
            if (string.IsNullOrEmpty(input)) continue;
            var coord = ParseCoordinate(input);
            if (coord == null)
            {
                Console.WriteLine("Неверный формат. Используйте букву A-J и цифру 1-10.");
                continue;
            }
            string result = computerBoard.ReceiveShot(coord);
            switch (result)
            {
                case "invalid": Console.WriteLine("Координата вне поля."); break;
                case "already_shot": Console.WriteLine("Сюда уже стреляли."); break;
                case "hit": Console.WriteLine(Colors.Colorize("Попадание!", Colors.Green)); break;
                case "sunk": Console.WriteLine(Colors.Colorize("Корабль потоплен!", Colors.Yellow)); break;
                case "miss": Console.WriteLine(Colors.Colorize("Промах.", Colors.Blue)); break;
            }
            if (result != "invalid" && result != "already_shot") break;
        }

        if (computerBoard.AllShipsSunk())
        {
            Console.WriteLine(Colors.Colorize("Поздравляем! Вы потопили все корабли противника!", Colors.Green));
            gameOver = true;
        }
    }

    private void ComputerMove()
    {
        Console.WriteLine("\nХод компьютера...");
        Random rand = new();
        Coord coord;
        do
        {
            int row = rand.Next(Board.Size);
            int col = rand.Next(Board.Size);
            coord = new Coord(row, col);
        } while (playerBoard.Shots.Contains(coord));

        string result = playerBoard.ReceiveShot(coord);
        char rowChar = (char)('A' + coord.Row);
        string coordStr = $"{rowChar}{coord.Col + 1}";
        if (result == "hit" || result == "sunk")
            Console.WriteLine($"Компьютер попал в {coordStr}!");
        else
            Console.WriteLine($"Компьютер промахнулся по {coordStr}.");

        if (playerBoard.AllShipsSunk())
        {
            Console.WriteLine(Colors.Colorize("Компьютер уничтожил все ваши корабли. Вы проиграли.", Colors.Red));
            gameOver = true;
        }
    }

    public void Run()
    {
        Console.WriteLine(Colors.Colorize("Добро пожаловать в Морской бой!", Colors.Cyan));
        while (!gameOver)
        {
            if (playerTurn) PlayerMove();
            else ComputerMove();
            playerTurn = !playerTurn;
        }
    }
}

// Top-level entry point
new Game().Run();
