import pygame
import sys
import time
import random

# Initialize Pygame
pygame.init()

# Screen dimensions
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
BLUE = (0, 0, 255)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
YELLOW = (255, 255, 0)

# Create the screen
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("2D Platformer")

# Clock for controlling the frame rate
clock = pygame.time.Clock()

# Font for text
font = pygame.font.SysFont(None, 36)

class Player:
    def __init__(self):
        self.width = 64
        self.height = 64
        self.x = 100
        self.y = SCREEN_HEIGHT - self.height - 50  # Start above ground
        self.vel_x = 0
        self.vel_y = 0
        self.is_jumping = False
        self.on_ground = True
        self.bullets = []
        self.bullet_count = 14
        self.reloading = False
        self.reload_start_time = 0
        self.alive = True
        self.score = 0
        
    def move(self, keys):
        if not self.alive:
            return
            
        # Horizontal movement
        self.vel_x = 0
        if keys[pygame.K_a]:  # Move left
            self.vel_x = -5
        if keys[pygame.K_d]:  # Move right
            self.vel_x = 5
            
        # Jumping
        if keys[pygame.K_w] and self.on_ground:
            self.vel_y = -15
            self.on_ground = False
            self.is_jumping = True
            
        # Apply gravity
        self.vel_y += 0.8
        
        # Update position
        self.x += self.vel_x
        self.y += self.vel_y
        
        # Check boundaries
        if self.x < 0:
            self.x = 0
        if self.x > SCREEN_WIDTH - self.width:
            self.x = SCREEN_WIDTH - self.width
            
        # Ground collision
        if self.y > SCREEN_HEIGHT - self.height - 50:  # 50 pixels above bottom for ground
            self.y = SCREEN_HEIGHT - self.height - 50
            self.vel_y = 0
            self.on_ground = True
            self.is_jumping = False
            
    def shoot(self):
        if not self.alive or self.reloading:
            return
            
        if self.bullet_count > 0:
            bullet = Bullet(self.x + self.width // 2, self.y + self.height // 2, 50, 100, True)  # 50 px/s speed, 100 px range
            self.bullets.append(bullet)
            self.bullet_count -= 1
            
    def reload(self):
        if not self.alive or self.reloading or self.bullet_count == 14:
            return
            
        self.reloading = True
        self.reload_start_time = time.time()
        
    def update_reload(self):
        if self.reloading and time.time() - self.reload_start_time >= 5:  # 5 seconds reload time
            self.bullet_count = 14
            self.reloading = False
            
    def update_bullets(self):
        for bullet in self.bullets[:]:
            bullet.update()
            if bullet.distance_traveled >= bullet.max_range:
                self.bullets.remove(bullet)
                
    def draw(self, screen):
        # Draw player
        pygame.draw.rect(screen, BLUE, (self.x, self.y, self.width, self.height))
        
        # Draw tiny pistol
        pygame.draw.rect(screen, BLACK, (self.x + self.width - 10, self.y + self.height // 2 - 5, 15, 10))
        
        # Draw bullets
        for bullet in self.bullets:
            bullet.draw(screen)
            
class Enemy:
    def __init__(self, x, y, color, speed_factor=1.0, has_knife=False):
        self.width = 64
        self.height = 64
        self.x = x
        self.y = y
        self.color = color
        self.speed = 2 * speed_factor
        self.bullets = []
        self.shoot_cooldown = 0
        self.has_knife = has_knife
        self.direction = 1 if random.random() > 0.5 else -1  # Random initial direction
        
        # Points based on enemy type
        if color == RED:
            self.points = 100
        elif color == GREEN:
            self.points = 75
        elif color == YELLOW:
            self.points = 200
            
    def update(self, player):
        # Move enemy
        if self.has_knife:
            # Yellow enemy with knife moves towards player
            if self.x < player.x:
                self.x += self.speed
            elif self.x > player.x:
                self.x -= self.speed
                
            if self.y < player.y:
                self.y += self.speed
            elif self.y > player.y:
                self.y -= self.speed
                
            # Check collision with player (knife attack)
            if (abs(self.x - player.x) < self.width and 
                abs(self.y - player.y) < self.height):
                player.alive = False
        else:
            # Red and green enemies move back and forth
            self.x += self.speed * self.direction
            
            # Change direction if hitting screen edge
            if self.x <= 0 or self.x >= SCREEN_WIDTH - self.width:
                self.direction *= -1
                
            # Shoot at player occasionally
            if self.shoot_cooldown <= 0:
                # Higher chance to shoot if player is in line of sight
                if (abs(self.y - player.y) < 100 and 
                    ((self.direction == 1 and self.x < player.x) or 
                     (self.direction == -1 and self.x > player.x))):
                    self.shoot(player)
                    self.shoot_cooldown = random.randint(60, 120)  # 1-2 seconds at 60 FPS
                elif random.random() < 0.01:  # Random chance to shoot
                    self.shoot(player)
                    self.shoot_cooldown = random.randint(60, 120)
            else:
                self.shoot_cooldown -= 1
                
        # Update bullets
        for bullet in self.bullets[:]:
            bullet.update()
            if bullet.distance_traveled >= bullet.max_range:
                self.bullets.remove(bullet)
                
    def shoot(self, player):
        if self.has_knife:
            return  # Knife enemies don't shoot
            
        # Calculate direction towards player
        dx = player.x - self.x
        dy = player.y - self.y
        distance = max(1, (dx**2 + dy**2)**0.5)  # Avoid division by zero
        
        # Normalize and scale by bullet speed
        dx = dx / distance * 50
        dy = dy / distance * 50
        
        bullet = EnemyBullet(self.x + self.width // 2, self.y + self.height // 2, dx, dy, 100)
        self.bullets.append(bullet)
        
    def draw(self, screen):
        # Draw enemy
        pygame.draw.rect(screen, self.color, (self.x, self.y, self.width, self.height))
        
        # Draw weapon (gun or knife)
        if self.has_knife:
            # Draw knife
            pygame.draw.rect(screen, BLACK, (self.x - 5 if self.direction < 0 else self.x + self.width, 
                                           self.y + self.height // 2 - 5, 10, 10))
        else:
            # Draw gun
            pygame.draw.rect(screen, BLACK, (self.x - 15 if self.direction < 0 else self.x + self.width, 
                                           self.y + self.height // 2 - 5, 15, 10))
            
class Bullet:
    def __init__(self, x, y, speed, max_range, is_player_bullet=True):
        self.x = x
        self.y = y
        self.width = 16
        self.height = 18
        self.speed = speed
        self.max_range = max_range
        self.distance_traveled = 0
        self.is_player_bullet = is_player_bullet
        
    def update(self):
        self.x += self.speed
        self.distance_traveled += abs(self.speed)
        
    def draw(self, screen):
        pygame.draw.rect(screen, RED, (self.x, self.y, self.width, self.height))
        
class EnemyBullet:
    def __init__(self, x, y, dx, dy, max_range):
        self.x = x
        self.y = y
        self.width = 16
        self.height = 18
        self.dx = dx
        self.dy = dy
        self.max_range = max_range
        self.distance_traveled = 0
        
    def update(self):
        self.x += self.dx
        self.y += self.dy
        self.distance_traveled += (self.dx**2 + self.dy**2)**0.5
        
    def draw(self, screen):
        pygame.draw.rect(screen, RED, (self.x, self.y, self.width, self.height))

def check_collisions(player, enemies):
    # Check player bullets with enemies
    for bullet in player.bullets[:]:
        for enemy in enemies[:]:
            if (bullet.x < enemy.x + enemy.width and
                bullet.x + bullet.width > enemy.x and
                bullet.y < enemy.y + enemy.height and
                bullet.y + bullet.height > enemy.y):
                # Collision detected
                player.bullets.remove(bullet)
                player.score += enemy.points
                enemies.remove(enemy)
                break
                
    # Check enemy bullets with player
    for enemy in enemies:
        for bullet in enemy.bullets[:]:
            if (bullet.x < player.x + player.width and
                bullet.x + bullet.width > player.x and
                bullet.y < player.y + player.height and
                bullet.y + bullet.height > player.y):
                # Collision detected
                enemy.bullets.remove(bullet)
                player.alive = False
                break

def draw_hud(screen, player, enemies_left):
    # Draw bullet counter
    bullet_text = f"Bullets: {player.bullet_count}/14"
    if player.reloading:
        reload_time_left = max(0, 5 - (time.time() - player.reload_start_time))
        bullet_text += f" (Reloading: {reload_time_left:.1f}s)"
    bullet_surface = font.render(bullet_text, True, WHITE)
    screen.blit(bullet_surface, (10, 10))
    
    # Draw enemies left counter
    enemies_text = f"Enemies: {enemies_left}"
    enemies_surface = font.render(enemies_text, True, WHITE)
    screen.blit(enemies_surface, (SCREEN_WIDTH - enemies_surface.get_width() - 10, 10))
    
    # Draw score
    score_text = f"Score: {player.score}"
    score_surface = font.render(score_text, True, WHITE)
    screen.blit(score_surface, (SCREEN_WIDTH // 2 - score_surface.get_width() // 2, 10))

def show_game_over(screen, player_won, score):
    overlay = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT))
    overlay.set_alpha(180)
    overlay.fill(BLACK)
    screen.blit(overlay, (0, 0))
    
    if player_won:
        message = f"YOU WIN! Score: {score}"
    else:
        message = f"GAME OVER! Score: {score}"
        
    text_surface = font.render(message, True, WHITE)
    restart_surface = font.render("Press SPACE to restart", True, WHITE)
    
    screen.blit(text_surface, (SCREEN_WIDTH // 2 - text_surface.get_width() // 2, 
                             SCREEN_HEIGHT // 2 - text_surface.get_height() // 2))
    screen.blit(restart_surface, (SCREEN_WIDTH // 2 - restart_surface.get_width() // 2, 
                                SCREEN_HEIGHT // 2 + 50))
    
    pygame.display.flip()
    
    waiting_for_key = True
    while waiting_for_key:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_SPACE:
                    waiting_for_key = False
                if event.key == pygame.K_ESCAPE:
                    pygame.quit()
                    sys.exit()

def main():
    # Create player
    player = Player()
    
    # Create enemies
    enemies = []
    
    # Add red enemies (3)
    for i in range(3):
        enemies.append(Enemy(random.randint(200, SCREEN_WIDTH - 100), 
                            SCREEN_HEIGHT - 114 - random.randint(0, 200), 
                            RED))
    
    # Add green enemies (2)
    for i in range(2):
        enemies.append(Enemy(random.randint(200, SCREEN_WIDTH - 100), 
                            SCREEN_HEIGHT - 114 - random.randint(0, 200), 
                            GREEN, 2.0))  # 2x faster
    
    # Add yellow enemies (1)
    enemies.append(Enemy(random.randint(200, SCREEN_WIDTH - 100), 
                        SCREEN_HEIGHT - 114 - random.randint(0, 200), 
                        YELLOW, 0.5, True))  # 0.5x speed, has knife
    
    # Game loop
    running = True
    while running:
        # Handle events
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    running = False
                if event.key == pygame.K_SPACE and player.alive:
                    player.shoot()
                if event.key == pygame.K_r and player.alive:
                    player.reload()
        
        # Get keyboard state
        keys = pygame.key.get_pressed()
        
        # Update player
        player.move(keys)
        player.update_reload()
        player.update_bullets()
        
        # Update enemies
        for enemy in enemies:
            enemy.update(player)
        
        # Check collisions
        check_collisions(player, enemies)
        
        # Clear the screen
        screen.fill(BLACK)
        
        # Draw ground
        pygame.draw.rect(screen, WHITE, (0, SCREEN_HEIGHT - 50, SCREEN_WIDTH, 50))
        
        # Draw player
        player.draw(screen)
        
        # Draw enemies and their bullets
        for enemy in enemies:
            enemy.draw(screen)
            for bullet in enemy.bullets:
                bullet.draw(screen)
        
        # Draw HUD
        draw_hud(screen, player, len(enemies))
        
        # Check win/lose conditions
        if not player.alive:
            pygame.display.flip()
            show_game_over(screen, False, player.score)
            return main()  # Restart game
            
        if len(enemies) == 0:
            pygame.display.flip()
            show_game_over(screen, True, player.score)
            return main()  # Restart game
        
        # Update the display
        pygame.display.flip()
        
        # Cap the frame rate
        clock.tick(60)

if __name__ == "__main__":
    main()
    pygame.quit()
    sys.exit()
