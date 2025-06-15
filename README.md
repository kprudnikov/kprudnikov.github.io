# 2D Platformer Game

A simple 2D platformer game created with Pygame based on the requirements.

## Game Features

- Main character: 64x64 pixel blue square with a tiny pistol
- Three types of enemies:
  - Red squares (standard enemies)
  - Green squares (2x faster than red)
  - Yellow squares with knives (0.5x faster than red, melee attack)
- Scoring system:
  - Red enemy: 100 points
  - Green enemy: 75 points
  - Yellow enemy: 200 points

## Controls

- **W**: Jump
- **A**: Move left
- **D**: Move right
- **Space**: Shoot
- **R**: Reload (takes 5 seconds)
- **Escape**: Quit game

## Requirements

- Python 3.x
- Pygame 2.5.2

## Installation

1. Install the required dependencies:

```
pip install -r requirements.txt
```

2. Run the game:

```
python game.py
```

## Game Rules

- You have 14 bullets before needing to reload
- Bullets have a 100 pixel range
- If an enemy bullet hits you, it's game over
- Destroy all enemies to win
- Yellow knife enemies need to touch you to deal damage
