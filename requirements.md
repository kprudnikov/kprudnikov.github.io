you are creating a 2D platformer game using javascript.

Main character:
a 64x64 pixel blue square with a tiny pistol


MOVEMENT:
- w - jump
- a - move left
- d - move right
- space - shoot 

pistol:
- bullet - 100 pixel range, 
- after shooting 14  times - reload with R key (reload takes 5 seconds)
- bullet speed - 50 pixels per second
- bullet size - 16x18 pixels
- bullet color - red
- bullet shape - rectangle

enemies:
- 64x64 pixel red square with a tiny gun (AI controlled)
- 64x64 pixel green square with a tiny gun (AI controlled, 2x faster then red)
- 64x64 pixel yellow square with a tiny knife (AI controlled, 0.5x faster then red, needs to touch you to deal damage to you )
 if bullet touches enemy - enemy is destroyed
 if bullet from enemy touches you - you are destroyed
 right top is a counter of bullets and enemies left
 if you are destroyed - game over pop up message, press the button to restart
 to win, destroy all enemies, 
 red enemy - 100 points
 green enemy - 75 points
 yellow enemy - 200 points
 
