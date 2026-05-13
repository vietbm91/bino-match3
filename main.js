const config = {
    type: Phaser.WEBGL,
    width: 600,
    height: 700,
    backgroundColor: '#000000',
    scene: { preload: preload, create: create }
};

const game = new Phaser.Game(config);

const GRID_SIZE = 8;
const TILE_SIZE = 60;
const OFFSET_X = 60;
const OFFSET_Y = 100;

let grid = [];
let selectedTile = null;
let isAnimating = false;
let isGameOver = false;

// --- HỆ THỐNG LEVEL & ĐIỂM SỐ ---
let currentLevel = 1;      // Bắt đầu từ Level 1
let score = 0;             // Điểm của màn hiện tại
let moves = 0;             
let targetScore = 0;       
let comboMultiplier = 1;

let scoreText, movesText, targetText, levelText;

function preload() {}

function create() {
    let currentScene = this;
    
    // Thuật toán Tăng độ khó:
    // Level 1: 20 moves. Level 2: 18 moves. Level 3: 16 moves... (Tối thiểu 10 moves)
    moves = Math.max(10, 22 - (currentLevel * 2)); 
    
    // Level 1: 1000 điểm. Level 2: 1500 điểm. Level 3: 2000 điểm...
    targetScore = 1000 + ((currentLevel - 1) * 500); 
    
    score = 0; 
    comboMultiplier = 1; 
    isGameOver = false;
    isAnimating = false;

    // Vẽ Lưới Cyan
    let graphics = this.add.graphics();
    graphics.lineStyle(4, 0x00FFFF, 0.4);
    for (let i = 0; i <= GRID_SIZE; i++) {
        graphics.moveTo(OFFSET_X + i * TILE_SIZE, OFFSET_Y);
        graphics.lineTo(OFFSET_X + i * TILE_SIZE, OFFSET_Y + GRID_SIZE * TILE_SIZE);
        graphics.moveTo(OFFSET_X, OFFSET_Y + i * TILE_SIZE);
        graphics.lineTo(OFFSET_X + GRID_SIZE * TILE_SIZE, OFFSET_Y + i * TILE_SIZE);
    }
    graphics.strokePath();

    // --- GIAO DIỆN CHƠI (UI) ---
    // Hiển thị Level ở chính giữa trên cùng
    levelText = this.add.text(300, 20, 'LEVEL ' + currentLevel, { fontSize: '28px', fill: '#FFFFFF', fontStyle: 'bold' }).setOrigin(0.5);
    
    scoreText = this.add.text(OFFSET_X, 20, 'SCORE: 0', { fontSize: '20px', fill: '#00FFFF', fontStyle: 'bold' }).setOrigin(0, 0.5);
    targetText = this.add.text(OFFSET_X, 50, 'TARGET: ' + targetScore, { fontSize: '16px', fill: '#00FFFF' }).setOrigin(0, 0.5);
    movesText = this.add.text(OFFSET_X + GRID_SIZE * TILE_SIZE, 35, 'MOVES: ' + moves, { fontSize: '28px', fill: '#FF0000', fontStyle: 'bold' }).setOrigin(1, 0.5);

    this.add.text(300, 650, 'BINO MATCH-3: MEDICAL EDITION', { fontSize: '18px', fill: '#FF0000' }).setOrigin(0.5);

    // Sinh kẹo
    for (let row = 0; row < GRID_SIZE; row++) {
        grid[row] = [];
        for (let col = 0; col < GRID_SIZE; col++) {
            spawnTile(currentScene, row, col);
        }
    }
    removeInitialMatches(currentScene);
}

function spawnTile(scene, row, col) {
    let x = OFFSET_X + col * TILE_SIZE + TILE_SIZE / 2;
    let y = OFFSET_Y + row * TILE_SIZE + TILE_SIZE / 2;
    let shapeType = Phaser.Math.Between(0, 3);
    let tile;
    let size = TILE_SIZE * 0.6;

    switch(shapeType) {
        case 0: tile = scene.add.rectangle(x, y, size, size, 0xFF0000).setOrigin(0.5); break;
        case 1: tile = scene.add.circle(x, y, size / 2, 0xFF0000); break;
        case 2: tile = scene.add.triangle(x, y, size / 2, 0, 0, size, size, size, 0xFF0000).setOrigin(0.5); break;
        case 3: tile = scene.add.rectangle(x, y, size * 0.75, size * 0.75, 0xFF0000).setOrigin(0.5); tile.angle = 45; break;
    }

    tile.setBlendMode(Phaser.BlendModes.SCREEN);
    tile.setData('row', row); tile.setData('col', col); tile.setData('type', shapeType);
    grid[row][col] = tile;

    tile.setInteractive({ useHandCursor: true });
    let startX, startY;

    tile.on('pointerdown', function(pointer) {
        if (isAnimating || isGameOver) return; 
        startX = pointer.x; startY = pointer.y;
    });

    tile.on('pointerup', function(pointer) {
        if (isAnimating || isGameOver) return;
        let deltaX = pointer.x - startX, deltaY = pointer.y - startY;
        let clickedTile = this;

        if (Math.abs(deltaX) > 20 || Math.abs(deltaY) > 20) {
            let r = clickedTile.getData('row'), c = clickedTile.getData('col');
            if (Math.abs(deltaX) > Math.abs(deltaY)) { deltaX > 0 ? c++ : c--; } else { deltaY > 0 ? r++ : r--; }
            if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) swapTiles(clickedTile, grid[r][c], scene);
        } else {
            if (selectedTile === clickedTile) {
                clickedTile.setAlpha(1); selectedTile = null;
            } else if (selectedTile) {
                let r1 = selectedTile.getData('row'), c1 = selectedTile.getData('col');
                let r2 = clickedTile.getData('row'), c2 = clickedTile.getData('col');
                if (Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1) {
                    swapTiles(selectedTile, clickedTile, scene);
                    selectedTile.setAlpha(1); selectedTile = null;
                } else {
                    selectedTile.setAlpha(1); selectedTile = clickedTile; selectedTile.setAlpha(0.5);
                }
            } else {
                selectedTile = clickedTile; selectedTile.setAlpha(0.5);
            }
        }
    });
}

function swapTiles(t1, t2, scene, isReverse = false) {
    isAnimating = true;
    if (!isReverse) comboMultiplier = 1;

    let r1 = t1.getData('row'), c1 = t1.getData('col');
    let r2 = t2.getData('row'), c2 = t2.getData('col');

    grid[r1][c1] = t2; grid[r2][c2] = t1;
    t1.setData('row', r2); t1.setData('col', c2);
    t2.setData('row', r1); t2.setData('col', c1);

    let tgtX1 = OFFSET_X + c2 * TILE_SIZE + TILE_SIZE / 2, tgtY1 = OFFSET_Y + r2 * TILE_SIZE + TILE_SIZE / 2;
    let tgtX2 = OFFSET_X + c1 * TILE_SIZE + TILE_SIZE / 2, tgtY2 = OFFSET_Y + r1 * TILE_SIZE + TILE_SIZE / 2;

    scene.tweens.add({ targets: t1, x: tgtX1, y: tgtY1, duration: 200 });
    scene.tweens.add({ targets: t2, x: tgtX2, y: tgtY2, duration: 200, onComplete: () => {
        if (!isReverse) {
            let matches = getMatches();
            if (matches.length > 0) {
                moves--;
                movesText.setText('MOVES: ' + moves);
                processMatches(matches, scene);
            } else {
                swapTiles(t1, t2, scene, true);
            }
        } else {
            isAnimating = false;
        }
    }});
}

function getMatches() {
    let matched = new Set();
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE - 2; c++) {
            let t1 = grid[r][c], t2 = grid[r][c+1], t3 = grid[r][c+2];
            if (t1 && t2 && t3 && t1.getData('type') === t2.getData('type') && t2.getData('type') === t3.getData('type')) {
                matched.add(t1); matched.add(t2); matched.add(t3);
            }
        }
    }
    for (let c = 0; c < GRID_SIZE; c++) {
        for (let r = 0; r < GRID_SIZE - 2; r++) {
            let t1 = grid[r][c], t2 = grid[r+1][c], t3 = grid[r+2][c];
            if (t1 && t2 && t3 && t1.getData('type') === t2.getData('type') && t2.getData('type') === t3.getData('type')) {
                matched.add(t1); matched.add(t2); matched.add(t3);
            }
        }
    }
    return Array.from(matched);
}

function processMatches(matches, scene) {
    let pointsGained = matches.length * 10 * comboMultiplier;
    score += pointsGained;
    scoreText.setText('SCORE: ' + score);

    let centerX = 0, centerY = 0;
    matches.forEach(t => { centerX += t.x; centerY += t.y; });
    centerX /= matches.length; centerY /= matches.length;

    let floatText = scene.add.text(centerX, centerY, '+' + pointsGained + (comboMultiplier > 1 ? ' (x'+comboMultiplier+')' : ''), { fontSize: '24px', fill: '#00FFFF', fontStyle: 'bold' }).setOrigin(0.5);
    scene.tweens.add({
        targets: floatText, y: centerY - 50, alpha: 0, duration: 1000,
        onComplete: () => floatText.destroy()
    });

    scene.tweens.add({
        targets: matches, scaleX: 0, scaleY: 0, duration: 200,
        onComplete: () => {
            matches.forEach(t => { grid[t.getData('row')][t.getData('col')] = null; t.destroy(); });
            applyGravity(scene);
        }
    });

    comboMultiplier++;
}

function applyGravity(scene) {
    let longestTween = 0;
    for (let c = 0; c < GRID_SIZE; c++) {
        let emptySpaces = 0;
        for (let r = GRID_SIZE - 1; r >= 0; r--) {
            if (grid[r][c] === null) { emptySpaces++; } 
            else if (emptySpaces > 0) {
                let tile = grid[r][c]; grid[r + emptySpaces][c] = tile; grid[r][c] = null;
                tile.setData('row', r + emptySpaces);
                let tgtY = OFFSET_Y + (r + emptySpaces) * TILE_SIZE + TILE_SIZE / 2;
                scene.tweens.add({ targets: tile, y: tgtY, duration: 300, ease: 'Bounce.easeOut' });
                longestTween = 300;
            }
        }
    }
    setTimeout(() => refillGrid(scene), longestTween + 50);
}

function refillGrid(scene) {
    for (let c = 0; c < GRID_SIZE; c++) {
        for (let r = 0; r < GRID_SIZE; r++) {
            if (grid[r][c] === null) {
                spawnTile(scene, r, c);
                let tile = grid[r][c]; tile.y = OFFSET_Y - TILE_SIZE; 
                let tgtY = OFFSET_Y + r * TILE_SIZE + TILE_SIZE / 2;
                scene.tweens.add({ targets: tile, y: tgtY, duration: 400, ease: 'Bounce.easeOut' });
            }
        }
    }
    setTimeout(() => {
        let newMatches = getMatches();
        if (newMatches.length > 0) {
            processMatches(newMatches, scene); 
        } else {
            checkGameOver(scene); 
        }
    }, 450);
}

// --- KIỂM TRA THẮNG / THUA & LÊN CẤP ---
function checkGameOver(scene) {
    if (score >= targetScore) {
        isGameOver = true;
        showEndScreen(scene, "LEVEL " + currentLevel + " CLEARED!", '#00FF00', true); // Thắng
    } else if (moves <= 0) {
        isGameOver = true;
        showEndScreen(scene, "OUT OF MOVES!\nGAME OVER", '#FF0000', false); // Thua
    } else {
        isAnimating = false; 
    }
}

function showEndScreen(scene, message, color, isWin) {
    let overlay = scene.add.rectangle(300, 350, 600, 700, 0x000000).setAlpha(0);
    scene.tweens.add({ targets: overlay, alpha: 0.8, duration: 500 });

    let text = scene.add.text(300, 350, message, { fontSize: '36px', fill: color, fontStyle: 'bold', align: 'center' }).setOrigin(0.5);
    text.setAlpha(0);
    scene.tweens.add({ targets: text, alpha: 1, duration: 500, delay: 300 });

    // Nút bấm tùy thuộc vào Thắng hay Thua
    let btnText = isWin ? '[ NEXT LEVEL ]' : '[ PLAY AGAIN ]';
    let btnColor = isWin ? '#FFFF00' : '#FFFFFF'; // Nếu thắng, nút màu vàng rực rỡ
    
    let restartBtn = scene.add.text(300, 450, btnText, { fontSize: '24px', fill: btnColor, fontStyle: 'bold' }).setOrigin(0.5);
    restartBtn.setInteractive({ useHandCursor: true });
    
    // Hiệu ứng nhấp nháy cho nút bấm
    scene.tweens.add({ targets: restartBtn, alpha: 0.5, duration: 800, yoyo: true, repeat: -1 });

    restartBtn.on('pointerdown', () => { 
        if (isWin) {
            currentLevel++; // Tăng Level
        } else {
            currentLevel = 1; // Thua thì cày lại từ đầu
        }
        scene.scene.restart(); // Khởi động lại game với thông số Level mới
    });
}

function removeInitialMatches(scene) {
    let matches = getMatches();
    while (matches.length > 0) {
        matches.forEach(t => { let r = t.getData('row'), c = t.getData('col'); t.destroy(); spawnTile(scene, r, c); });
        matches = getMatches();
    }
}