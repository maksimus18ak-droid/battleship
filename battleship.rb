# battleship.rb
# Версия на Ruby с метапрограммированием, блоками, цветным выводом

# ANSI colors
COLORS = {
  reset: "\e[0m",
  red: "\e[91m",
  green: "\e[92m",
  blue: "\e[94m",
  yellow: "\e[93m",
  cyan: "\e[96m"
}

def colorize(text, color)
  "#{COLORS[color]}#{text}#{COLORS[:reset]}"
end

class Ship
  attr_reader :cells

  def initialize(cells)
    @cells = cells
    @hits = Array.new(cells.size, false)
  end

  def sunk?
    @hits.all?
  end

  def hit?(row, col)
    @cells.each_with_index do |(r, c), i|
      if r == row && c == col
        @hits[i] = true
        return true
      end
    end
    false
  end
end

class Board
  SIZE = 10
  SHIP_SIZES = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1]

  attr_reader :shots

  def initialize
    @grid = Array.new(SIZE) { Array.new(SIZE, '~') }
    @ships = []
    @shots = Set.new
  end

  def place_ships
    SHIP_SIZES.each do |size|
      placed = false
      attempts = 0
      until placed || attempts >= 1000
        attempts += 1
        row = rand(SIZE)
        col = rand(SIZE)
        horizontal = [true, false].sample
        cells = get_cells(row, col, size, horizontal)
        if cells && can_place?(cells)
          place_ship(cells)
          placed = true
        end
      end
      raise "Не удалось разместить корабли" unless placed
    end
  end

  private

  def get_cells(row, col, size, horizontal)
    cells = []
    size.times do |i|
      r = horizontal ? row : row + i
      c = horizontal ? col + i : col
      return nil if r >= SIZE || c >= SIZE
      cells << [r, c]
    end
    cells
  end

  def can_place?(cells)
    cells.all? do |r, c|
      return false unless @grid[r][c] == '~'
      (-1..1).all? do |dr|
        (-1..1).all? do |dc|
          nr = r + dr
          nc = c + dc
          next true if nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE
          @grid[nr][nc] == '~'
        end
      end
    end
  end

  def place_ship(cells)
    ship = Ship.new(cells)
    @ships << ship
    cells.each { |r, c| @grid[r][c] = '#' }
  end

  public

  def receive_shot(row, col)
    return 'invalid' if row < 0 || row >= SIZE || col < 0 || col >= SIZE
    return 'already_shot' if @shots.include?([row, col])
    @shots.add([row, col])

    if @grid[row][col] == '#'
      @ships.each do |ship|
        if ship.hit?(row, col)
          @grid[row][col] = 'X'
          if ship.sunk?
            ship.cells.each { |r, c| @grid[r][c] = 'X' }
            return 'sunk'
          end
          return 'hit'
        end
      end
    else
      @grid[row][col] = 'O'
      return 'miss'
    end
    'miss'
  end

  def all_ships_sunk?
    @ships.all?(&:sunk?)
  end

  def display(hide_ships: false)
    print '  '
    (1..SIZE).each { |i| print "#{i} " }
    puts
    SIZE.times do |r|
      row_label = ('A'.ord + r).chr
      print "#{row_label} "
      SIZE.times do |c|
        cell = @grid[r][c]
        cell = '~' if hide_ships && cell == '#'
        colored = case cell
                  when 'X' then colorize('X', :red)
                  when 'O' then colorize('O', :blue)
                  when '#' then colorize('#', :green)
                  else cell
                  end
        print "#{colored} "
      end
      puts
    end
  end
end

class Game
  def initialize
    @player_board = Board.new
    @computer_board = Board.new
    @player_board.place_ships
    @computer_board.place_ships
    @player_turn = true
    @game_over = false
  end

  def parse_coordinate(input)
    match = input.match(/^([A-Ja-j])([1-9]|10)$/)
    return nil unless match
    row = match[1].upcase.ord - 'A'.ord
    col = match[2].to_i - 1
    [row, col]
  end

  def player_move
    puts "\nВаше поле:"
    @player_board.display(hide_ships: false)
    puts "\nПоле противника:"
    @computer_board.display(hide_ships: true)

    loop do
      print "Введите координату (например, A1): "
      input = gets.chomp.strip
      parsed = parse_coordinate(input)
      unless parsed
        puts "Неверный формат. Используйте букву A-J и цифру 1-10."
        next
      end
      row, col = parsed
      result = @computer_board.receive_shot(row, col)
      case result
      when 'invalid' then puts "Координата вне поля."
      when 'already_shot' then puts "Сюда уже стреляли."
      when 'hit' then puts colorize("Попадание!", :green)
      when 'sunk' then puts colorize("Корабль потоплен!", :yellow)
      when 'miss' then puts colorize("Промах.", :blue)
      end
      break unless ['invalid', 'already_shot'].include?(result)
    end

    if @computer_board.all_ships_sunk?
      puts colorize("Поздравляем! Вы потопили все корабли противника!", :green)
      @game_over = true
    end
  end

  def computer_move
    puts "\nХод компьютера..."
    loop do
      row = rand(Board::SIZE)
      col = rand(Board::SIZE)
      unless @player_board.shots.include?([row, col])
        result = @player_board.receive_shot(row, col)
        coord_str = ('A'.ord + row).chr + (col + 1).to_s
        if ['hit', 'sunk'].include?(result)
          puts "Компьютер попал в #{coord_str}!"
        else
          puts "Компьютер промахнулся по #{coord_str}."
        end
        break
      end
    end

    if @player_board.all_ships_sunk?
      puts colorize("Компьютер уничтожил все ваши корабли. Вы проиграли.", :red)
      @game_over = true
    end
  end

  def run
    puts colorize("Добро пожаловать в Морской бой!", :cyan)
    until @game_over
      if @player_turn
        player_move
      else
        computer_move
      end
      @player_turn = !@player_turn
    end
  end
end

Game.new.run
