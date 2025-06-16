// Game constants
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
const WORLD_WIDTH = 3000; // Larger world width
const WORLD_HEIGHT = 1200; // Larger world height
const GRAVITY = 0.8;
const GROUND_HEIGHT = 50;
const MOBILE_GROUND_OFFSET = 700; // Significantly increased to ensure horizon appears in the middle
const PLAYER_SIZE = 64;
const BULLET_RANGE = Infinity; // Infinite bullet range
const BULLET_SPEED = 9; // Decreased by 10%
const BULLET_WIDTH = 16;
const BULLET_HEIGHT = 18;
const MAX_BULLETS = 14;
const RELOAD_TIME = 500; // 0.5 seconds in milliseconds

// Game variables
let canvas, ctx;
let player;
let enemies = [];
let keys = {};
let keyCodes = {}; // For language-agnostic controls
let gameOver = false;
let gameWon = false;
let score = 0;
let mouseX = 0;
let mouseY = 0;
let cameraX = 0;
let cameraY = 0;
let clouds = [];
let respawnTimer = 0;

// Mobile controls variables
let isMobile = false;
let joystickActive = false;
let joystickStartX = 0;
let joystickStartY = 0;
let joystickCurrentX = 0;
let joystickCurrentY = 0;
let joystickJump = false; // Flag for joystick-triggered jumps
let shootActive = false;
let reloadActive = false;

// Game objects
class Player {
    constructor() {
        this.width = PLAYER_SIZE;
        this.height = PLAYER_SIZE;
        this.x = 100;
        
        // Position player based on device type
        if (isMobile) {
            // For mobile, position at the middle of the screen
            // We'll set this properly in init() since cameraY isn't available here
            this.y = WORLD_HEIGHT / 2;
        } else {
            this.y = WORLD_HEIGHT - GROUND_HEIGHT - this.height;
        }
        
        this.velX = 0;
        this.velY = 0;
        this.speed = 5;
        this.jumpPower = 15;
        this.isJumping = false;
        this.bullets = [];
        this.bulletCount = MAX_BULLETS;
        this.isReloading = false;
        this.reloadStartTime = 0;
        this.alive = true;
    }

    update() {
        if (!this.alive) return;

        // Horizontal movement
        this.velX = 0;
        // Left movement - A key (65) or Left Arrow (37)
        if (keyCodes[65] || keyCodes[37]) {
            this.velX = -this.speed;
            // Update player direction for enemy spawning
            if (playerLastDirection !== -1) playerLastDirection = -1;
        }
        // Right movement - D key (68) or Right Arrow (39)
        if (keyCodes[68] || keyCodes[39]) {
            this.velX = this.speed;
            // Update player direction for enemy spawning
            if (playerLastDirection !== 1) playerLastDirection = 1;
        }

        // Jumping - W key (87), Up Arrow (38), Space (32), or joystickJump flag
        if ((keyCodes[87] || keyCodes[38] || keyCodes[32] || joystickJump) && !this.isJumping) {
            this.velY = -this.jumpPower;
            this.isJumping = true;
            joystickJump = false; // Reset the jump flag
        }
        
        // Check for auto reload on mobile
        this.checkAutoReload();

        // Apply gravity
        this.velY += GRAVITY;

        // Update position
        this.x += this.velX;
        this.y += this.velY;

        // Check boundaries
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > WORLD_WIDTH) this.x = WORLD_WIDTH - this.width;

        // Ground collision - adjust for mobile
        let groundLevel;
        
        if (isMobile) {
            // Use the middle of the screen for mobile
            groundLevel = cameraY + (CANVAS_HEIGHT / 2);
        } else {
            groundLevel = WORLD_HEIGHT - GROUND_HEIGHT;
        }
            
        if (this.y + this.height > groundLevel) {
            this.y = groundLevel - this.height;
            this.velY = 0;
            this.isJumping = false;
        }

        // Update bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            if (this.bullets[i].update()) {
                this.bullets.splice(i, 1);
            }
        }

        // Handle reloading
        if (this.isReloading && Date.now() - this.reloadStartTime >= RELOAD_TIME) {
            this.bulletCount = MAX_BULLETS;
            this.isReloading = false;
        }
    }

    shoot() {
        if (!this.alive || this.isReloading || this.bulletCount <= 0) return;
        
        // Direction based on player's last direction
        let vx, vy;
        
        // Horizontal direction based on player movement
        if (playerLastDirection === 1) {
            // Shooting right
            vx = BULLET_SPEED;
            vy = 0; // No vertical component
        } else {
            // Shooting left
            vx = -BULLET_SPEED;
            vy = 0; // No vertical component
        }
        
        const bullet = new Bullet(
            this.x + this.width / 2,
            this.y + this.height / 2,
            vx,
            vy,
            true
        );
        
        this.bullets.push(bullet);
        this.bulletCount--;
    }

    reload() {
        if (this.isReloading || this.bulletCount >= MAX_BULLETS) return;
        
        this.isReloading = true;
        this.reloadStartTime = Date.now();
    }
    
    // Auto reload for mobile devices
    checkAutoReload() {
        // Only auto reload on mobile when out of bullets
        if (isMobile && this.bulletCount <= 0 && !this.isReloading) {
            this.reload();
        }
    }

    draw() {
        // Draw player (blue square)
        ctx.fillStyle = 'blue';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Draw tiny pistol based on direction
        ctx.fillStyle = 'black';
        if (playerLastDirection === 1) {
            // Gun pointing right
            ctx.fillRect(this.x + this.width - 10, this.y + this.height / 2 - 5, 15, 10);
        } else {
            // Gun pointing left
            ctx.fillRect(this.x - 5, this.y + this.height / 2 - 5, 15, 10);
        }
        
        // Draw bullets
        for (const bullet of this.bullets) {
            bullet.draw();
        }
    }
}

class Enemy {
    constructor(type) {
        this.width = PLAYER_SIZE;
        this.height = PLAYER_SIZE;
        this.x = Math.random() * (WORLD_WIDTH - 400) + 200;
        
        // Position enemies based on device type
        if (isMobile) {
            // For mobile, position at the middle of the screen
            const middleY = cameraY + (CANVAS_HEIGHT / 2);
            this.y = middleY - this.height;
        } else {
            this.y = WORLD_HEIGHT - GROUND_HEIGHT - this.height;
        }
        
        this.type = type; // 'red', 'green', or 'yellow'
        this.direction = Math.random() > 0.5 ? 1 : -1;
        this.bullets = [];
        this.shootCooldown = Math.random() * 120 + 60; // 1-3 seconds at 60 FPS
        
        // Set speed and points based on type
        if (type === 'red') {
            this.speed = 2;
            this.points = 100;
            this.hasKnife = false;
        } else if (type === 'green') {
            this.speed = 4; // 2x faster than red
            this.points = 75;
            this.hasKnife = false;
        } else if (type === 'yellow') {
            this.speed = 1; // 0.5x faster than red
            this.points = 200;
            this.hasKnife = true;
        }
    }

    update() {
        if (this.hasKnife) {
            // Yellow enemy with knife moves towards player
            if (this.x < player.x) {
                this.x += this.speed;
            } else {
                this.x -= this.speed;
            }
            
            // Yellow enemies should NEVER follow the player vertically
            // They should always stay on the ground
            
            // Always move back to ground level
            let groundLevel;
            
            if (isMobile) {
                // Use the middle of the screen for mobile
                groundLevel = cameraY + (CANVAS_HEIGHT / 2);
            } else {
                groundLevel = WORLD_HEIGHT - GROUND_HEIGHT;
            }
            
            if (this.y + this.height < groundLevel) {
                this.y += this.speed * 2; // Fall back down faster
            }
            
            // Ensure enemy stays on the ground
            if (this.y + this.height > groundLevel) {
                this.y = groundLevel - this.height;
            }
            
            // Check collision with player (knife attack)
            if (checkCollision(this, player)) {
                player.alive = false;
            }
        } else {
            // Red and green enemies move back and forth
            this.x += this.speed * this.direction;
            
            // Change direction if hitting world edge
            if (this.x <= 0 || this.x + this.width >= WORLD_WIDTH) {
                this.direction *= -1;
            }
            
            // Check if enemy is on screen before allowing shooting
            const isOnScreen = 
                this.x + this.width > cameraX && 
                this.x < cameraX + CANVAS_WIDTH && 
                this.y + this.height > cameraY && 
                this.y < cameraY + CANVAS_HEIGHT;
            
            // Shoot at player occasionally, but only if on screen
            this.shootCooldown--;
            if (this.shootCooldown <= 0 && isOnScreen) {
                // Higher chance to shoot if player is in line of sight
                if (Math.abs(this.y - player.y) < 100 && 
                    ((this.direction === 1 && this.x < player.x) || 
                     (this.direction === -1 && this.x > player.x))) {
                    this.shoot();
                    this.shootCooldown = Math.random() * 120 + 60;
                } else if (Math.random() < 0.01) { // Random chance to shoot
                    this.shoot();
                    this.shootCooldown = Math.random() * 120 + 60;
                }
            }
        }
        
        // Update bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            if (this.bullets[i].update()) {
                this.bullets.splice(i, 1);
            }
        }
    }

    shoot() {
        if (this.hasKnife) return; // Knife enemies don't shoot
        
        // Calculate direction towards player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy)); // Avoid division by zero
        
        // Normalize and scale by bullet speed
        const vx = dx / distance * BULLET_SPEED;
        const vy = dy / distance * BULLET_SPEED;
        
        const bullet = new EnemyBullet(
            this.x + this.width / 2,
            this.y + this.height / 2,
            vx,
            vy
        );
        
        this.bullets.push(bullet);
    }

    draw() {
        // Draw enemy
        ctx.fillStyle = this.type;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Draw weapon (gun or knife)
        ctx.fillStyle = 'black';
        if (this.hasKnife) {
            // Draw knife
            ctx.fillRect(
                this.direction < 0 ? this.x - 5 : this.x + this.width,
                this.y + this.height / 2 - 5,
                10,
                10
            );
        } else {
            // Draw gun
            ctx.fillRect(
                this.direction < 0 ? this.x - 15 : this.x + this.width,
                this.y + this.height / 2 - 5,
                15,
                10
            );
        }
        
        // Draw bullets
        for (const bullet of this.bullets) {
            bullet.draw();
        }
    }
}

class Bullet {
    constructor(x, y, vx, vy, isPlayerBullet) {
        this.x = x;
        this.y = y;
        this.width = BULLET_WIDTH;
        this.height = BULLET_HEIGHT;
        this.vx = vx;
        this.vy = vy;
        this.distanceTraveled = 0;
        this.isPlayerBullet = isPlayerBullet;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.distanceTraveled += Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        
        // Remove bullets that go off world
        if (this.x < 0 || this.x > WORLD_WIDTH || this.y < 0 || this.y > WORLD_HEIGHT) {
            return true; // Signal for removal
        }
        return false;
    }

    draw() {
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
    }
}

class EnemyBullet {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.width = BULLET_WIDTH;
        this.height = BULLET_HEIGHT;
        this.vx = vx;
        this.vy = vy;
        this.distanceTraveled = 0;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.distanceTraveled += Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        
        // Remove bullets that go off world
        if (this.x < 0 || this.x > WORLD_WIDTH || this.y < 0 || this.y > WORLD_HEIGHT) {
            return true; // Signal for removal
        }
        return false;
    }

    draw() {
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
    }
}

// Cloud functions
function createClouds() {
    // Create 20 clouds at random positions
    for (let i = 0; i < 20; i++) {
        clouds.push({
            x: Math.random() * WORLD_WIDTH,
            y: Math.random() * (WORLD_HEIGHT - GROUND_HEIGHT - 200),
            width: Math.random() * 200 + 100,
            height: Math.random() * 60 + 40,
            speed: Math.random() * 0.5 + 0.1,
            opacity: Math.random() * 0.5 + 0.3
        });
    }
}

function updateClouds() {
    for (const cloud of clouds) {
        // Move clouds slowly to the right
        cloud.x += cloud.speed;
        
        // If cloud moves off the right edge, wrap around to the left
        if (cloud.x > WORLD_WIDTH) {
            cloud.x = -cloud.width;
            cloud.y = Math.random() * (WORLD_HEIGHT - GROUND_HEIGHT - 200);
        }
    }
}

function drawClouds() {
    ctx.save();
    for (const cloud of clouds) {
        ctx.fillStyle = `rgba(255, 255, 255, ${cloud.opacity})`;
        ctx.beginPath();
        ctx.ellipse(cloud.x, cloud.y, cloud.width / 2, cloud.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Add some additional smaller ellipses to make the cloud look more fluffy
        ctx.beginPath();
        ctx.ellipse(cloud.x + cloud.width * 0.2, cloud.y - cloud.height * 0.1, cloud.width * 0.3, cloud.height * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.ellipse(cloud.x - cloud.width * 0.2, cloud.y + cloud.height * 0.1, cloud.width * 0.25, cloud.height * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

// Track the player's last direction for enemy spawning
let playerLastDirection = 1; // 1 for right, -1 for left

function handleEnemyRespawn() {
    // Increment respawn timer
    respawnTimer++;
    
    // Every 300 frames (about 5 seconds at 60fps), spawn a new enemy if there are fewer than 15
    if (respawnTimer >= 300 && enemies.length < 15) {
        respawnTimer = 0;
        
        // FORCE ENEMIES TO ONLY SPAWN IN VISIBLE AREA IN FRONT OF PLAYER
        // Calculate the visible area boundaries based on camera position
        const visibleLeft = cameraX;
        const visibleRight = cameraX + CANVAS_WIDTH;
        
        // Determine which side to spawn on based on player position in the visible area
        const playerCenterX = player.x + player.width / 2;
        const screenCenterX = cameraX + CANVAS_WIDTH / 2;
        
        // Spawn enemies on the side the player is FACING, not the side they're on
        // If player is facing right, spawn on right side of screen
        // If player is facing left, spawn on left side of screen
        let spawnX;
        
        // Update player's last direction if they're moving
        if (player.velX > 0) {
            playerLastDirection = 1; // Right
        } else if (player.velX < 0) {
            playerLastDirection = -1; // Left
        }
        // If player.velX is 0, we keep the last direction
        
        if (playerLastDirection === 1) {
            // Player is facing RIGHT, spawn on right side of screen
            spawnX = visibleRight + 100; // 100px outside right edge of screen
        } else {
            // Player is facing LEFT, spawn on left side of screen
            spawnX = visibleLeft - PLAYER_SIZE - 100; // 100px outside left edge of screen
        }
        
        // Determine which type of enemy to spawn based on random chance
        const rand = Math.random();
        let enemyType;
        
        if (rand < 0.6) {
            enemyType = 'red';
        } else if (rand < 0.9) {
            enemyType = 'green';
        } else {
            enemyType = 'yellow';
        }
        
        // Create the enemy
        const enemy = new Enemy(enemyType);
        
        // Always spawn on the ground - adjust for mobile
        if (isMobile) {
            // For mobile, spawn at the middle of the screen
            const middleY = cameraY + (CANVAS_HEIGHT / 2);
            enemy.y = middleY - enemy.height;
        } else {
            enemy.y = WORLD_HEIGHT - GROUND_HEIGHT - enemy.height;
        }
        
        // Set enemy position
        enemy.x = spawnX;
        
        // Add to enemies array
        enemies.push(enemy);
        
        console.log(`Spawned ${enemyType} enemy at x: ${enemy.x}, player at x: ${player.x}, camera: ${cameraX}-${visibleRight}`);
    }
}

// Helper functions
function checkCollision(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width &&
           obj1.x + obj1.width > obj2.x &&
           obj1.y < obj2.y + obj2.height &&
           obj1.y + obj1.height > obj2.y;
}

// Create a global array to store all enemy bullets
let allEnemyBullets = [];

function checkBulletCollisions() {
    // Check player bullets with enemies
    for (let i = player.bullets.length - 1; i >= 0; i--) {
        const bullet = player.bullets[i];
        
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            
            if (checkCollision(bullet, enemy)) {
                // Collision detected
                player.bullets.splice(i, 1);
                score += enemy.points;
                
                // Transfer enemy bullets to global array before removing enemy
                for (const enemyBullet of enemy.bullets) {
                    allEnemyBullets.push(enemyBullet);
                }
                enemy.bullets = []; // Clear enemy bullets to avoid duplicates
                
                // Remove the enemy
                enemies.splice(j, 1);
                break;
            }
        }
    }
    
    // Check enemy bullets with player (from active enemies)
    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        
        for (let j = enemy.bullets.length - 1; j >= 0; j--) {
            const bullet = enemy.bullets[j];
            
            if (checkCollision(bullet, player)) {
                // Collision detected
                enemy.bullets.splice(j, 1);
                player.alive = false;
                break;
            }
        }
    }
    
    // Check global enemy bullets with player
    for (let j = allEnemyBullets.length - 1; j >= 0; j--) {
        const bullet = allEnemyBullets[j];
        
        // Update bullet
        if (bullet.update()) {
            // Remove if off-screen
            allEnemyBullets.splice(j, 1);
            continue;
        }
        
        if (checkCollision(bullet, player)) {
            // Collision detected
            allEnemyBullets.splice(j, 1);
            player.alive = false;
        }
    }
}

function drawHUD() {
    ctx.fillStyle = 'black';
    ctx.font = '20px Arial';
    
    // Draw bullet counter
    let bulletText = `Bullets: ${player.bulletCount}/${MAX_BULLETS}`;
    if (player.isReloading) {
        const reloadTimeLeft = ((RELOAD_TIME - (Date.now() - player.reloadStartTime)) / 1000).toFixed(1);
        bulletText += ` (Reloading: ${reloadTimeLeft}s)`;
    }
    ctx.fillText(bulletText, 10, 30);
    
    // Draw enemies left counter
    const enemiesText = `Enemies: ${enemies.length}`;
    const enemiesTextWidth = ctx.measureText(enemiesText).width;
    ctx.fillText(enemiesText, CANVAS_WIDTH - enemiesTextWidth - 10, 30);
    
    // Draw score
    const scoreText = `Score: ${score}`;
    const scoreTextWidth = ctx.measureText(scoreText).width;
    ctx.fillText(scoreText, CANVAS_WIDTH / 2 - scoreTextWidth / 2, 30);
    
    // Draw instructions box in top right corner
    drawInstructionsBox();
}

// Helper function to draw rounded rectangles
function drawRoundedRect(ctx, x, y, width, height, radius, fill) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    
    if (fill) {
        ctx.fill();
    }
}

function drawInstructionsBox() {
    // Position the box in the top right corner, under the enemies count
    const boxX = CANVAS_WIDTH - 250;
    const boxY = 40;
    const boxWidth = 240;
    const boxHeight = 170;
    
    // Draw semi-transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, 10, true);
    
    // Draw border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, 10, false);
    ctx.stroke();
    
    // Draw instructions text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('CONTROLS:', boxX + 10, boxY + 25);
    
    ctx.font = '14px Arial';
    
    // Different instructions based on device
    let instructions;
    if (isMobile) {
        instructions = [
            'Left joystick - Move left/right',
            'Flick joystick UP - Jump',
            'SHOOT button - Shoot',
            'Auto-reload when empty',
            '',
            'Defeat enemies to score points!',
            'Watch out for yellow enemies!'
        ];
    } else {
        instructions = [
            'A/D - Move left/right',
            'SPACE - Jump',
            'ENTER - Shoot',
            'R - Reload weapon',
            '',
            'Defeat enemies to score points!',
            'Watch out for yellow enemies!'
        ];
    }
    
    instructions.forEach((text, index) => {
        ctx.fillText(text, boxX + 10, boxY + 50 + (index * 18));
    });
}

function showGameOver() {
    const gameOverElement = document.getElementById('gameOver');
    const gameOverTextElement = document.getElementById('gameOverText');
    const finalScoreElement = document.getElementById('finalScore');
    
    gameOverElement.style.display = 'flex';
    
    if (gameWon) {
        gameOverTextElement.textContent = 'YOU WIN!';
    } else {
        gameOverTextElement.textContent = 'GAME OVER';
    }
    
    finalScoreElement.textContent = `Score: ${score}`;
    
    // Add instructions to the game over screen
    const instructionsElement = document.getElementById('gameInstructions');
    if (!instructionsElement) {
        const instructions = document.createElement('p');
        instructions.id = 'gameInstructions';
        instructions.innerHTML = `
            <strong>CONTROLS:</strong><br>
            A/D - Move left/right<br>
            SPACE - Jump<br>
            ENTER - Shoot<br>
            R - Reload weapon<br><br>
            Defeat enemies to score points!<br>
            Watch out for yellow enemies with knives!
        `;
        instructions.style.color = 'white';
        instructions.style.textAlign = 'center';
        instructions.style.marginTop = '10px';
        instructions.style.fontSize = '14px';
        instructions.style.maxWidth = '300px';
        
        // Insert before the restart button
        const restartButton = document.getElementById('restartButton');
        gameOverElement.insertBefore(instructions, restartButton);
    }
}

function restartGame() {
    // Hide game over screen
    document.getElementById('gameOver').style.display = 'none';
    
    // Reset game variables
    player = new Player();
    enemies = [];
    gameOver = false;
    gameWon = false;
    score = 0;
    keys = {};
    keyCodes = {}; // Reset key states
    
    // Create enemies
    createEnemies();
    
    // Start game loop
    requestAnimationFrame(gameLoop);
}

function createEnemies() {
    // Add red enemies (5) - more enemies for the larger world
    for (let i = 0; i < 5; i++) {
        const enemy = new Enemy('red');
        // Ensure enemies are on the ground
        enemy.y = WORLD_HEIGHT - GROUND_HEIGHT - enemy.height;
        enemies.push(enemy);
    }
    
    // Add green enemies (3) - more enemies for the larger world
    for (let i = 0; i < 3; i++) {
        const enemy = new Enemy('green');
        // Ensure enemies are on the ground
        enemy.y = WORLD_HEIGHT - GROUND_HEIGHT - enemy.height;
        enemies.push(enemy);
    }
    
    // Add yellow enemies (2) - more enemies for the larger world
    for (let i = 0; i < 2; i++) {
        const yellowEnemy = new Enemy('yellow');
        // Ensure enemies are on the ground
        yellowEnemy.y = WORLD_HEIGHT - GROUND_HEIGHT - yellowEnemy.height;
        enemies.push(yellowEnemy);
    }
}

function init() {
    // Get canvas and context
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // Create player
    player = new Player();
    
    // Create enemies
    createEnemies();
    
    // Create clouds
    createClouds();
    
    // Detect if user is on mobile device
    detectMobileDevice();
    
    // Set up event listeners
    window.addEventListener('keydown', function(e) {
        keys[e.key.toLowerCase()] = true;
        keyCodes[e.keyCode] = true; // Store key code for language-agnostic controls
        
        // Space is for jumping (handled in player.update)
        
        // Shoot with Enter (keyCode 13)
        if (e.keyCode === 13) {
            player.shoot();
        }
        
        // Reload with R (keyCode 82)
        if (e.keyCode === 82) {
            player.reload();
        }
    });
    
    // Track mouse position
    canvas.addEventListener('mousemove', function(e) {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
    });
    
    // No longer shooting on mouse click
    canvas.addEventListener('mousedown', function(e) {
        // Mouse click functionality removed
    });
    
    window.addEventListener('keyup', function(e) {
        keys[e.key.toLowerCase()] = false;
        keyCodes[e.keyCode] = false; // Update key code state
    });
    
    // Set up mobile controls
    setupMobileControls();
    
    // Handle orientation changes
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
    
    // Set up restart button
    document.getElementById('restartButton').addEventListener('click', restartGame);
    
    // Set up fullscreen button
    const fullscreenButton = document.getElementById('fullscreenButton');
    if (fullscreenButton) {
        fullscreenButton.addEventListener('click', toggleFullscreen);
    }
    
    // Listen for fullscreen changes to update button appearance
    document.addEventListener('fullscreenchange', updateFullscreenButtonState);
    document.addEventListener('webkitfullscreenchange', updateFullscreenButtonState);
    document.addEventListener('mozfullscreenchange', updateFullscreenButtonState);
    document.addEventListener('MSFullscreenChange', updateFullscreenButtonState);
    
    // Start game loop
    requestAnimationFrame(gameLoop);
}

function updateCamera() {
    // Center camera on player with some bounds checking
    cameraX = player.x + player.width / 2 - CANVAS_WIDTH / 2;
    cameraY = player.y + player.height / 2 - CANVAS_HEIGHT / 2;
    
    // Keep camera within world bounds
    cameraX = Math.max(0, Math.min(cameraX, WORLD_WIDTH - CANVAS_WIDTH));
    cameraY = Math.max(0, Math.min(cameraY, WORLD_HEIGHT - CANVAS_HEIGHT));
}

// Mobile controls functions
function detectMobileDevice() {
    // Check if the device is a mobile device
    isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
               (window.innerWidth <= 1024 && 'ontouchstart' in window);
    
    // Show/hide mobile controls based on detection
    const mobileControls = document.getElementById('mobileControls');
    if (mobileControls) {
        mobileControls.style.display = isMobile ? 'block' : 'none';
    }
    
    // Check orientation on mobile
    if (isMobile) {
        handleOrientationChange();
        
        // Reposition player and enemies for mobile
        if (player) {
            // Position player at the middle of the screen minus their height
            const middleY = CANVAS_HEIGHT / 2;
            player.y = middleY - player.height;
        }
        
        // Reposition enemies
        for (const enemy of enemies) {
            // Position enemies at the middle of the screen minus their height
            const middleY = CANVAS_HEIGHT / 2;
            enemy.y = middleY - enemy.height;
        }
    }
}

function handleOrientationChange() {
    if (!isMobile) return;
    
    const orientationWarning = document.getElementById('orientationWarning');
    if (window.innerHeight > window.innerWidth) {
        // Portrait mode
        if (orientationWarning) orientationWarning.style.display = 'flex';
    } else {
        // Landscape mode
        if (orientationWarning) orientationWarning.style.display = 'none';
    }
}

// Store original canvas dimensions
let originalCanvasWidth = CANVAS_WIDTH;
let originalCanvasHeight = CANVAS_HEIGHT;

// Fullscreen functionality
function toggleFullscreen() {
    const gameContainer = document.querySelector('.game-container');
    
    if (!document.fullscreenElement && 
        !document.mozFullScreenElement && 
        !document.webkitFullscreenElement && 
        !document.msFullscreenElement) {
        // Enter fullscreen
        if (gameContainer.requestFullscreen) {
            gameContainer.requestFullscreen();
        } else if (gameContainer.mozRequestFullScreen) { // Firefox
            gameContainer.mozRequestFullScreen();
        } else if (gameContainer.webkitRequestFullscreen) { // Chrome, Safari and Opera
            gameContainer.webkitRequestFullscreen();
        } else if (gameContainer.msRequestFullscreen) { // IE/Edge
            gameContainer.msRequestFullscreen();
        }
    } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.mozCancelFullScreen) { // Firefox
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) { // Chrome, Safari and Opera
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) { // IE/Edge
            document.msExitFullscreen();
        }
    }
}

function updateFullscreenButtonState() {
    const fullscreenButton = document.getElementById('fullscreenButton');
    const canvas = document.getElementById('gameCanvas');
    
    if (document.fullscreenElement || 
        document.mozFullScreenElement || 
        document.webkitFullscreenElement || 
        document.msFullscreenElement) {
        // In fullscreen mode
        fullscreenButton.classList.add('active');
        
        // Resize canvas to fill the screen
        resizeCanvas();
    } else {
        // Not in fullscreen mode
        fullscreenButton.classList.remove('active');
        
        // Reset canvas to original size
        canvas.width = originalCanvasWidth;
        canvas.height = originalCanvasHeight;
    }
}

function resizeCanvas() {
    const canvas = document.getElementById('gameCanvas');
    
    // Get the actual screen dimensions
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    // Update canvas size
    canvas.width = screenWidth;
    canvas.height = screenHeight;
    
    // Update viewport constants for rendering
    CANVAS_WIDTH = screenWidth;
    CANVAS_HEIGHT = screenHeight;
}

// Listen for window resize events
window.addEventListener('resize', function() {
    if (document.fullscreenElement || 
        document.mozFullScreenElement || 
        document.webkitFullscreenElement || 
        document.msFullscreenElement) {
        // Only resize if in fullscreen mode
        resizeCanvas();
    }
});

function setupMobileControls() {
    // Joystick controls
    const joystickContainer = document.getElementById('joystickContainer');
    const joystick = document.getElementById('joystick');
    
    if (joystickContainer && joystick) {
        // Touch start - initialize joystick position
        joystickContainer.addEventListener('touchstart', function(e) {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = joystickContainer.getBoundingClientRect();
            
            joystickStartX = rect.left + rect.width / 2;
            joystickStartY = rect.top + rect.height / 2;
            joystickCurrentX = touch.clientX;
            joystickCurrentY = touch.clientY;
            
            // Calculate joystick position within container
            const deltaX = touch.clientX - joystickStartX;
            const deltaY = touch.clientY - joystickStartY;
            const distance = Math.min(rect.width / 2 - joystick.offsetWidth / 2, Math.sqrt(deltaX * deltaX + deltaY * deltaY));
            const angle = Math.atan2(deltaY, deltaX);
            
            const newX = distance * Math.cos(angle);
            const newY = distance * Math.sin(angle);
            
            joystick.style.transform = `translate(${newX}px, ${newY}px)`;
            joystickActive = true;
            
            // Set movement based on joystick position
            if (deltaX < -10) {
                keyCodes[37] = true; // Left arrow
                keyCodes[39] = false; // Right arrow
                playerLastDirection = -1;
            } else if (deltaX > 10) {
                keyCodes[39] = true; // Right arrow
                keyCodes[37] = false; // Left arrow
                playerLastDirection = 1;
            } else {
                keyCodes[37] = false;
                keyCodes[39] = false;
            }
            
            // Check for upward movement (jump)
            if (deltaY < -30) { // Require significant upward movement
                joystickJump = true;
            }
        });
        
        // Touch move - update joystick position
        joystickContainer.addEventListener('touchmove', function(e) {
            if (!joystickActive) return;
            e.preventDefault();
            
            const touch = e.touches[0];
            const rect = joystickContainer.getBoundingClientRect();
            
            joystickCurrentX = touch.clientX;
            joystickCurrentY = touch.clientY;
            
            // Calculate joystick position within container
            const deltaX = touch.clientX - joystickStartX;
            const deltaY = touch.clientY - joystickStartY;
            const distance = Math.min(rect.width / 2 - joystick.offsetWidth / 2, Math.sqrt(deltaX * deltaX + deltaY * deltaY));
            const angle = Math.atan2(deltaY, deltaX);
            
            const newX = distance * Math.cos(angle);
            const newY = distance * Math.sin(angle);
            
            joystick.style.transform = `translate(${newX}px, ${newY}px)`;
            
            // Set movement based on joystick position
            if (deltaX < -10) {
                keyCodes[37] = true; // Left arrow
                keyCodes[39] = false; // Right arrow
                playerLastDirection = -1;
            } else if (deltaX > 10) {
                keyCodes[39] = true; // Right arrow
                keyCodes[37] = false; // Left arrow
                playerLastDirection = 1;
            } else {
                keyCodes[37] = false;
                keyCodes[39] = false;
            }
            
            // Check for upward movement (jump)
            if (deltaY < -30) { // Require significant upward movement
                joystickJump = true;
            }
        });
        
        // Touch end - reset joystick
        joystickContainer.addEventListener('touchend', function(e) {
            e.preventDefault();
            joystick.style.transform = 'translate(0px, 0px)';
            joystickActive = false;
            
            // Reset movement keys
            keyCodes[37] = false; // Left arrow
            keyCodes[39] = false; // Right arrow
        });
    }
    
    // Jump functionality is now handled by the joystick
    
    // Shoot button
    const shootButton = document.getElementById('shootButton');
    if (shootButton) {
        shootButton.addEventListener('touchstart', function(e) {
            e.preventDefault();
            shootActive = true;
            player.shoot();
            shootButton.classList.add('active');
        });
        
        shootButton.addEventListener('touchend', function(e) {
            e.preventDefault();
            shootActive = false;
            shootButton.classList.remove('active');
        });
    }
    
    // Reload button
    const reloadButton = document.getElementById('reloadButton');
    if (reloadButton) {
        reloadButton.addEventListener('touchstart', function(e) {
            e.preventDefault();
            reloadActive = true;
            player.reload();
            reloadButton.classList.add('active');
        });
        
        reloadButton.addEventListener('touchend', function(e) {
            e.preventDefault();
            reloadActive = false;
            reloadButton.classList.remove('active');
        });
    }
}

// Initialize global enemy bullets array
allEnemyBullets = [];

function gameLoop() {
    // Update camera position
    updateCamera();
    
    // Update clouds
    updateClouds();
    
    // Handle enemy respawning
    handleEnemyRespawn();
    
    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Save the current transformation matrix
    ctx.save();
    
    // Translate everything by the camera position
    ctx.translate(-cameraX, -cameraY);
    
    // Draw background (larger than canvas to cover the entire world)
    ctx.fillStyle = 'lightblue';
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    
    // Draw clouds
    drawClouds();
    
    // Draw ground (larger than canvas to cover the entire world)
    // For mobile, draw ground at the middle of the screen
    ctx.fillStyle = 'black';
    if (isMobile) {
        // Force the ground to be at the middle of the visible canvas
        const middleOfScreen = cameraY + (CANVAS_HEIGHT / 2);
        ctx.fillRect(0, middleOfScreen, WORLD_WIDTH, GROUND_HEIGHT);
    } else {
        ctx.fillRect(0, WORLD_HEIGHT - GROUND_HEIGHT, WORLD_WIDTH, GROUND_HEIGHT);
    }
    
    // Update player
    player.update();
    
    // Update enemies
    for (const enemy of enemies) {
        enemy.update();
    }
    
    // Check collisions
    checkBulletCollisions();
    
    // Draw player
    player.draw();
    
    // Draw enemies
    for (const enemy of enemies) {
        enemy.draw();
    }
    
    // Draw global enemy bullets
    for (const bullet of allEnemyBullets) {
        bullet.draw();
    }
    
    // Restore the transformation matrix to draw HUD elements without translation
    ctx.restore();
    
    // Draw HUD
    drawHUD();
    
    // Draw cursor crosshair (adjusted for camera position)
    const worldMouseX = mouseX + cameraX;
    const worldMouseY = mouseY + cameraY;
    
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mouseX - 10, mouseY);
    ctx.lineTo(mouseX + 10, mouseY);
    ctx.moveTo(mouseX, mouseY - 10);
    ctx.lineTo(mouseX, mouseY + 10);
    ctx.stroke();
    
    // Check lose condition
    if (!player.alive && !gameOver) {
        gameOver = true;
        gameWon = false;
        showGameOver();
        return;
    }
    
    // No win condition anymore - enemies will respawn
    
    // Continue game loop
    if (!gameOver) {
        requestAnimationFrame(gameLoop);
    }
}

// Start the game when the page loads
window.addEventListener('load', init);
