import { GameState, EntityType, Entity, Arrow, Particle, Point, Vector } from './types';

export const GRAVITY = 0.25;
export const GROUND_Y = 500;
export const PLAYER_X = 500;
export const VIRTUAL_WIDTH = 1000;
export const VIRTUAL_HEIGHT = 600;
export const ARROW_SPEED_FACTOR = 15;
export const SLOW_MO_DURATION = 1000; // ms

export const createInitialState = (): GameState => ({
  player: {
    id: 'player',
    type: EntityType.PLAYER,
    pos: { x: PLAYER_X, y: GROUND_Y - 60 },
    vel: { x: 0, y: 0 },
    health: 100,
    maxHealth: 100,
    width: 30,
    height: 60,
    isDead: false,
    lastShotTime: 0,
    lastHitTime: 0,
    shieldHealth: 0,
    aimAngle: 0,
    charge: 0,
  },
  enemies: [],
  platforms: [
    { id: 'p1', pos: { x: 100, y: 350 }, width: 150 },
    { id: 'p2', pos: { x: 750, y: 350 }, width: 150 },
    { id: 'p3', pos: { x: 250, y: 200 }, width: 150 },
    { id: 'p4', pos: { x: 600, y: 200 }, width: 150 },
  ],
  arrows: [],
  healthKits: [],
  particles: [],
  score: 0,
  highScore: parseInt(localStorage.getItem('archery_highscore') || '0'),
  combo: 0,
  maxCombo: 0,
  lastKillTime: 0,
  isGameOver: false,
  isPaused: false,
  wave: 1,
  difficulty: 1,
  screenShake: 0,
  slowMoFactor: 1,
  floatingTexts: [],
});

export const updateGameState = (state: GameState, deltaTime: number): GameState => {
  if (state.isGameOver || state.isPaused) return state;

  const dt = deltaTime * state.slowMoFactor;
  const now = Date.now();
  
  // Deep clone state for immutability
  const newState: GameState = {
    ...state,
    player: { ...state.player },
    enemies: state.enemies.map(e => ({ ...e })),
    arrows: state.arrows.map(a => ({ ...a })),
    healthKits: state.healthKits.map(h => ({ ...h })),
    particles: state.particles.map(p => ({ ...p })),
    floatingTexts: state.floatingTexts.map(t => ({ ...t })),
    platforms: [...state.platforms],
  };

  // Update Slow-Mo
  if (newState.slowMoFactor < 1) {
    newState.slowMoFactor += 0.02;
    if (newState.slowMoFactor > 1) newState.slowMoFactor = 1;
  }

  // Update Screen Shake
  if (newState.screenShake > 0) {
    newState.screenShake -= 0.5;
  }

  // Update Health Kits (Cleanup collected)
  newState.healthKits = newState.healthKits.filter(kit => !kit.isCollected);

  // Update Arrows
  newState.arrows = newState.arrows.filter(arrow => !arrow.isStuck).map(arrow => {
    const nextPos = {
      x: arrow.pos.x + arrow.vel.x * dt,
      y: arrow.pos.y + arrow.vel.y * dt
    };

    const nextVel = {
      x: arrow.vel.x,
      y: arrow.vel.y + GRAVITY * dt
    };

    const nextAngle = Math.atan2(nextVel.y, nextVel.x);

    // Segment-based collision detection to prevent skipping
    const steps = 3;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const checkPos = {
        x: arrow.pos.x + (nextPos.x - arrow.pos.x) * t,
        y: arrow.pos.y + (nextPos.y - arrow.pos.y) * t
      };

      // Check collision with ground
      if (checkPos.y > GROUND_Y) {
        if (arrow.isFireball) {
          spawnExplosion(newState.particles, { x: checkPos.x, y: GROUND_Y });
          newState.screenShake = 15;
          
          // Area damage to player
          const dx = checkPos.x - newState.player.pos.x;
          const dy = GROUND_Y - (newState.player.pos.y + 30);
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 80) {
            newState.player.health -= arrow.damage;
            newState.player.lastHitTime = now;
            spawnBlood(newState.particles, newState.player.pos);
            
            if (newState.player.health <= 0) {
              newState.player.isDead = true;
              newState.isGameOver = true;
              if (newState.score > newState.highScore) {
                newState.highScore = newState.score;
                localStorage.setItem('archery_highscore', newState.highScore.toString());
              }
            }
          }
          return { ...arrow, pos: { x: checkPos.x, y: GROUND_Y }, isStuck: true };
        }
        return { ...arrow, pos: { x: checkPos.x, y: GROUND_Y }, isStuck: true };
      }

      // Check collision with health kits (if player arrow)
      if (arrow.ownerId === 'player') {
        for (const kit of newState.healthKits) {
          if (kit.isCollected) continue;
          const dx = checkPos.x - kit.pos.x;
          const dy = checkPos.y - kit.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 25) {
            kit.isCollected = true;
            newState.player.health = Math.min(newState.player.maxHealth, newState.player.health + kit.healAmount);
            // Visual feedback
            for (let i = 0; i < 15; i++) {
              newState.particles.push({
                pos: { ...kit.pos },
                vel: { x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 6 },
                life: 40,
                maxLife: 40,
                color: '#34c759',
                size: 4
              });
            }
            // Arrow gets "consumed" or stuck
            return { ...arrow, pos: checkPos, isStuck: true, stuckInId: kit.id };
          }
        }
      }

      // Check collision with enemies (if player arrow)
      if (arrow.ownerId === 'player') {
        for (const enemy of newState.enemies) {
          if (enemy.isDead) continue;
          if (checkCollision(checkPos, enemy)) {
            const isFacingLeft = enemy.pos.x > newState.player.pos.x;
            const isHitFromFront = isFacingLeft ? (checkPos.x < enemy.pos.x + 5) : (checkPos.x > enemy.pos.x - 5);
            
            // Shield logic: Breaks in 2 shots
            if (enemy.type === EntityType.ENEMY_SHIELD_SPEARMAN && enemy.shieldHealth > 0 && isHitFromFront) {
              enemy.shieldHealth -= 1;
              enemy.lastHitTime = now;
              
              if (enemy.shieldHealth === 0) {
                // Shield Shatter Effect
                for (let i = 0; i < 20; i++) {
                  newState.particles.push({
                    pos: { x: checkPos.x, y: checkPos.y },
                    vel: { 
                      x: (isFacingLeft ? -1 : 1) * (Math.random() * 6 + 2), 
                      y: (Math.random() - 0.5) * 10 
                    },
                    life: 40 + Math.random() * 20,
                    maxLife: 60,
                    color: i % 2 === 0 ? '#d1d1d6' : '#86868b',
                    size: 2 + Math.random() * 4
                  });
                }
                newState.screenShake = 10;
              } else {
                // Normal shield hit effect
                newState.particles.push({
                  pos: { ...checkPos },
                  vel: { x: isFacingLeft ? -2 : 2, y: -2 },
                  life: 20,
                  maxLife: 20,
                  color: '#86868b',
                  size: 2
                });
              }
              return { ...arrow, pos: checkPos, isStuck: true, stuckInId: enemy.id, stuckOffset: { x: checkPos.x - enemy.pos.x, y: checkPos.y - enemy.pos.y } };
            }

            const isHeadshot = checkPos.y < enemy.pos.y + 12;
            
            if (isHeadshot) {
              enemy.health = 0; // 1 shot kill for headshot
            } else {
              enemy.health -= arrow.damage; // 2 shots kill for body (health 50)
            }
            
            enemy.lastHitTime = now;
            
            if (enemy.health <= 0) {
              enemy.isDead = true;
              const baseScore = isHeadshot ? 150 : 100;
              const comboBonus = Math.floor(baseScore * (newState.combo * 0.1));
              newState.score += baseScore + comboBonus;
              
              if (isHeadshot) {
                newState.floatingTexts.push({
                  id: Math.random().toString(36).substr(2, 9),
                  text: "HEADSHOT!",
                  pos: { x: enemy.pos.x, y: enemy.pos.y - 20 },
                  life: 1000,
                  color: '#ff3b30'
                });
              }
              
              if (newState.combo > 2) {
                newState.floatingTexts.push({
                  id: Math.random().toString(36).substr(2, 9),
                  text: `${newState.combo}x COMBO`,
                  pos: { x: enemy.pos.x, y: enemy.pos.y - 40 },
                  life: 1000,
                  color: '#0071e3'
                });
              }

              newState.combo += 1;
              newState.maxCombo = Math.max(newState.maxCombo, newState.combo);
              newState.lastKillTime = now;
              newState.screenShake = 5;
              newState.slowMoFactor = 0.3;
              spawnBlood(newState.particles, checkPos);

              // 20% chance to drop a health kit
              if (Math.random() < 0.2) {
                newState.healthKits.push({
                  id: Math.random().toString(36).substr(2, 9),
                  pos: { x: enemy.pos.x, y: GROUND_Y - 20 },
                  healAmount: 25,
                  isCollected: false
                });
              }
            }

            return { 
              ...arrow, 
              pos: checkPos, 
              isStuck: true, 
              stuckInId: enemy.id, 
              stuckOffset: { x: checkPos.x - enemy.pos.x, y: checkPos.y - enemy.pos.y } 
            };
          }
        }
      } else {
        // Check collision with player (if enemy arrow)
        const isFireballHit = arrow.isFireball && (
          Math.sqrt(
            Math.pow(checkPos.x - newState.player.pos.x, 2) + 
            Math.pow(checkPos.y - (newState.player.pos.y + 30), 2)
          ) < 30
        );

        if (checkCollision(checkPos, newState.player) || isFireballHit) {
          if (arrow.isFireball) {
            spawnExplosion(newState.particles, checkPos);
            newState.screenShake = 20;
            newState.player.health -= arrow.damage;
          } else {
            const isHeadshot = checkPos.y < newState.player.pos.y + 12;
            
            if (isHeadshot) {
              newState.player.health = 0; // 1 shot kill for headshot
            } else {
              newState.player.health -= arrow.damage; // 4 shots kill for body (health 100)
            }
          }
          
          newState.player.lastHitTime = now;
          newState.screenShake = Math.max(newState.screenShake, 10);
          spawnBlood(newState.particles, checkPos);
          
          if (newState.player.health <= 0) {
            newState.player.isDead = true;
            newState.isGameOver = true;
            if (newState.score > newState.highScore) {
              newState.highScore = newState.score;
              localStorage.setItem('archery_highscore', newState.highScore.toString());
            }
          }

          return { 
            ...arrow, 
            pos: checkPos, 
            isStuck: true, 
            stuckInId: 'player', 
            stuckOffset: { x: checkPos.x - newState.player.pos.x, y: checkPos.y - newState.player.pos.y } 
          };
        }
      }
    }

    return { ...arrow, pos: nextPos, vel: nextVel, angle: nextAngle };
  });

  // Update Enemies
  newState.enemies = newState.enemies.filter(enemy => !enemy.isDead).map(enemy => {
    // Enemy AI
    const now = Date.now();
    const targetX = newState.player.pos.x;
    // Platform enemies aim significantly lower to avoid constant headshots
    const isOnPlatform = newState.platforms.some(p => 
      enemy.pos.y < GROUND_Y - 100 && 
      enemy.pos.x >= p.pos.x && 
      enemy.pos.x <= p.pos.x + p.width
    );
    // Aim at legs/feet for platform enemies, center for others
    const targetY = newState.player.pos.y + (isOnPlatform ? 50 : 35); 
    const dx = targetX - enemy.pos.x;
    const dy = targetY - (enemy.pos.y + 20); // Relative to bow position
    const distToPlayer = Math.abs(dx);
    const totalDist = Math.sqrt(dx * dx + dy * dy);

    if (enemy.type === EntityType.ENEMY_ARCHER || enemy.type === EntityType.ENEMY_SPREAD_ARCHER) {
      // Stay at distance and shoot
      const idNum = parseInt(enemy.id, 36) || 0;
      const rangeMin = 200 + (idNum % 100);
      const rangeMax = 450 + (idNum % 150);

      if (distToPlayer > rangeMax) {
        const moveDir = dx > 0 ? 1 : -1;
        const nextX = enemy.pos.x + moveDir * 1.5 * dt;
        
        // If on platform, don't walk off
        if (isOnPlatform) {
          const platform = newState.platforms.find(p => 
            enemy.pos.x >= p.pos.x && enemy.pos.x <= p.pos.x + p.width
          );
          if (platform && nextX >= platform.pos.x && nextX <= platform.pos.x + platform.width) {
            enemy.pos.x = nextX;
          }
        } else {
          enemy.pos.x = nextX;
        }
      } else if (distToPlayer < rangeMin) {
        const moveDir = dx > 0 ? -1 : 1;
        const nextX = enemy.pos.x + moveDir * dt;
        
        if (isOnPlatform) {
          const platform = newState.platforms.find(p => 
            enemy.pos.x >= p.pos.x && enemy.pos.x <= p.pos.x + p.width
          );
          if (platform && nextX >= platform.pos.x && nextX <= platform.pos.x + platform.width) {
            enemy.pos.x = nextX;
          }
        } else {
          enemy.pos.x = nextX;
        }
      }

      const shootInterval = (enemy.type === EntityType.ENEMY_SPREAD_ARCHER ? 3000 : 2200) / newState.difficulty;
      const isOnScreen = enemy.pos.x > -50 && enemy.pos.x < 1200;
      
      if (isOnScreen) {
        // Charging logic
        if (now - enemy.lastShotTime > shootInterval) {
          enemy.charge += 0.02 * dt;
          
          if (enemy.charge >= 1) {
            // Gravity compensation: aim higher as distance increases
            const speed = ARROW_SPEED_FACTOR * 1.1;
            const time = totalDist / speed;
            const gravityComp = 0.5 * GRAVITY * time * time;
            
            // Intentional miss logic: some shots land slightly around the player
            let finalTargetY = targetY;
            let finalTargetX = targetX;
            
            if (Math.random() < 0.7) { // 70% chance to intentionally miss
              const missDirection = dx > 0 ? 1 : -1;
              // Randomly aim significantly ahead or behind
              const sideBias = Math.random() > 0.5 ? 1.5 : -1; 
              finalTargetX += missDirection * (40 + Math.random() * 100) * sideBias;
              finalTargetY += (Math.random() - 0.5) * 120;
            }

            const finalDx = finalTargetX - enemy.pos.x;
            const finalDy = finalTargetY - (enemy.pos.y + 20);
            
            const baseAngle = Math.atan2(finalDy - gravityComp, finalDx);
            const arrowCount = enemy.type === EntityType.ENEMY_SPREAD_ARCHER ? 3 : 1;
            
            for (let i = 0; i < arrowCount; i++) {
              const spread = arrowCount > 1 ? (i - 1) * 0.2 : 0;
              // Increased spread to reduce precision significantly
              const inaccuracyBase = isOnPlatform ? 0.25 : 0.15;
              const inaccuracy = (Math.random() - 0.5) * inaccuracyBase; 
              const angle = baseAngle + spread + inaccuracy;
              
              newState.arrows.push({
                id: Math.random().toString(36).substr(2, 9),
                pos: { x: enemy.pos.x, y: enemy.pos.y + 20 },
                vel: {
                  x: Math.cos(angle) * ARROW_SPEED_FACTOR * 1.1,
                  y: Math.sin(angle) * ARROW_SPEED_FACTOR * 1.1
                },
                angle: angle,
                ownerId: enemy.id,
                isStuck: false,
                damage: 26
              });
            }
            enemy.lastShotTime = now;
            enemy.charge = 0;
          }
        }
      }
    } else if (enemy.type === EntityType.ENEMY_SPEARMAN || enemy.type === EntityType.ENEMY_SHIELD_SPEARMAN) {
      // Spearman AI: Advance and attack
      const attackRange = 60;
      const isClose = distToPlayer < attackRange;
      const attackCooldown = 1500 / newState.difficulty;
      
      if (isClose) {
        // Attack logic
        if (now - enemy.lastShotTime > attackCooldown) {
          newState.player.health -= 26; // 4 shots to kill player (health 100)
          newState.player.lastHitTime = now;
          newState.screenShake = 12;
          enemy.lastShotTime = now;
          
          if (newState.player.health <= 0) {
            newState.player.isDead = true;
            newState.isGameOver = true;
          }
        }
        // Stay close but don't overlap perfectly
        if (distToPlayer < 40) {
          enemy.pos.x += (dx > 0 ? -1 : 1) * 1.5 * dt;
        }
      } else {
        // Advance towards player
        const speed = (enemy.type === EntityType.ENEMY_SHIELD_SPEARMAN ? 1.2 : 2.2) * newState.difficulty;
        enemy.pos.x += (dx > 0 ? 1 : -1) * speed * dt;
      }
    } else if (enemy.type === EntityType.ENEMY_FLYING_BOMBER) {
      // Fly and drop arrows
      enemy.pos.x += (dx > 0 ? 1 : -1) * 2.5 * dt;
      const targetY = 100 + Math.sin(now / 500) * 60;
      enemy.pos.y += (targetY - enemy.pos.y) * 0.05 * dt;

      if (now - enemy.lastShotTime > 2500 / newState.difficulty) {
        // Gravity compensation for flying bomber
        const speed = ARROW_SPEED_FACTOR * 0.9;
        const time = totalDist / speed;
        const gravityComp = 0.5 * GRAVITY * time * time;
        
        // Intentional miss logic
        let finalTargetY = targetY;
        let finalTargetX = targetX;
        
        if (Math.random() < 0.6) {
          const missDirection = dx > 0 ? 1 : -1;
          const sideBias = Math.random() > 0.5 ? 1.5 : -1;
          finalTargetX += missDirection * (50 + Math.random() * 120) * sideBias;
          finalTargetY += (Math.random() - 0.5) * 100;
        }

        const finalDx = finalTargetX - enemy.pos.x;
        const finalDy = finalTargetY - (enemy.pos.y + 20);

        const angle = Math.atan2(finalDy - gravityComp, finalDx) + (Math.random() - 0.5) * 0.2;
        newState.arrows.push({
          id: Math.random().toString(36).substr(2, 9),
          pos: { x: enemy.pos.x, y: enemy.pos.y + 20 },
          vel: {
            x: Math.cos(angle) * ARROW_SPEED_FACTOR * 0.9,
            y: Math.sin(angle) * ARROW_SPEED_FACTOR * 0.9
          },
          angle: angle,
          ownerId: enemy.id,
          isStuck: false,
          damage: 26,
          isFireball: true
        });
        enemy.lastShotTime = now;
      }
    }

    return enemy;
  });

  // Spawn Health Kits (Periodic if health is low)
  if (newState.player.health < 50 && newState.healthKits.length < 2) {
    // Very low chance per frame to spawn a kit if health is low
    if (Math.random() < 0.002) {
      newState.healthKits.push({
        id: Math.random().toString(36).substr(2, 9),
        pos: { x: 100 + Math.random() * 800, y: GROUND_Y - 20 },
        healAmount: 25,
        isCollected: false
      });
    }
  }

  // Spawn Enemies
  const activeEnemies = newState.enemies.filter(e => !e.isDead).length;
  const maxEnemies = 3 + Math.floor(newState.difficulty * 0.8);
  
  if (activeEnemies < maxEnemies) {
    const spawnChance = Math.min(0.08, 0.02 * newState.difficulty);
    
    if (Math.random() < spawnChance) {
      const d = newState.difficulty;
      let type = EntityType.ENEMY_ARCHER;
      
      const weights = [
        { type: EntityType.ENEMY_ARCHER, weight: 100, minDiff: 1.0 },
        { type: EntityType.ENEMY_SPEARMAN, weight: 80, minDiff: 1.0 },
        { type: EntityType.ENEMY_SHIELD_SPEARMAN, weight: 70, minDiff: 2.0 },
        { type: EntityType.ENEMY_FLYING_BOMBER, weight: 60, minDiff: 3.0 },
        { type: EntityType.ENEMY_SPREAD_ARCHER, weight: 50, minDiff: 4.0 },
      ];

      // As difficulty increases, older types become slightly less common to make room for new ones
      const availableTypes = weights.filter(w => d >= w.minDiff).map(w => {
        let adjustedWeight = w.weight;
        if (d > w.minDiff + 2) {
          adjustedWeight *= 0.8; // Fade out older types slightly
        }
        return { ...w, weight: adjustedWeight };
      });
      const totalWeight = availableTypes.reduce((sum, w) => sum + w.weight, 0);
      let randomWeight = Math.random() * totalWeight;
      
      for (const w of availableTypes) {
        if (randomWeight < w.weight) {
          type = w.type;
          break;
        }
        randomWeight -= w.weight;
      }

      const isFlying = type === EntityType.ENEMY_FLYING_BOMBER;
      const spawnSide = Math.random() > 0.5 ? 1 : -1; // 1 = Right, -1 = Left
      const spawnX = spawnSide === 1 ? 1100 : -100;
      
      // Platform spawning (Only Archers on platforms)
      let spawnY = GROUND_Y - 60;
      let finalX = spawnX;
      
      const canSpawnOnPlatform = (type === EntityType.ENEMY_ARCHER || type === EntityType.ENEMY_SPREAD_ARCHER);
      if (canSpawnOnPlatform && Math.random() > 0.5 && newState.platforms.length > 0) {
        const platform = newState.platforms[Math.floor(Math.random() * newState.platforms.length)];
        finalX = platform.pos.x + Math.random() * platform.width;
        spawnY = platform.pos.y - 60;
      }

      newState.enemies.push({
        id: Math.random().toString(36).substr(2, 9),
        type,
        pos: { x: (isFlying || spawnY === GROUND_Y - 60) ? spawnX : finalX, y: isFlying ? 100 + Math.random() * 100 : spawnY },
        vel: { x: 0, y: 0 },
        health: 50,
        maxHealth: 50,
        width: 30,
        height: 60,
        isDead: false,
        lastShotTime: now + Math.random() * 500,
        lastHitTime: 0,
        shieldHealth: type === EntityType.ENEMY_SHIELD_SPEARMAN ? 2 : 0,
        aimAngle: 0,
        charge: 0,
      });
    }
  }

  // Update Difficulty Scaling
  // Faster scaling for better pacing
  const oldWave = newState.wave;
  newState.difficulty += 0.0005 * dt;
  newState.wave = Math.floor(newState.difficulty);

  if (newState.wave > oldWave) {
    const waveNames: Record<number, string> = {
      2: "SHIELDED ENEMIES ARRIVE",
      3: "AERIAL THREAT DETECTED",
      4: "SPREAD SHOTS INCOMING",
      5: "THE HORDE BEGINS"
    };
    newState.waveNotification = {
      message: waveNames[newState.wave] || `WAVE ${newState.wave}`,
      life: 3000
    };
    newState.screenShake = 15;
    newState.slowMoFactor = 0.5;
  }

  if (newState.waveNotification) {
    newState.waveNotification.life -= dt * 16.67; // approx ms
    if (newState.waveNotification.life <= 0) {
      delete newState.waveNotification;
    }
  }

  // Update Floating Texts
  newState.floatingTexts = newState.floatingTexts.map(t => ({
    ...t,
    pos: { x: t.pos.x, y: t.pos.y - 1.0 * dt },
    life: t.life - dt * 16.67
  })).filter(t => t.life > 0);

  // Update Particles
  newState.particles = newState.particles.map(p => ({
    ...p,
    pos: { x: p.pos.x + p.vel.x * dt, y: p.pos.y + p.vel.y * dt },
    vel: { x: p.vel.x, y: p.vel.y + GRAVITY * 0.5 * dt },
    life: p.life - dt
  })).filter(p => p.life > 0);

  // Combo Reset
  if (Date.now() - newState.lastKillTime > 3000) {
    newState.combo = 0;
  }

  return newState;
};

const checkCollision = (point: Point, entity: Entity): boolean => {
  return (
    point.x >= entity.pos.x - entity.width / 2 &&
    point.x <= entity.pos.x + entity.width / 2 &&
    point.y >= entity.pos.y &&
    point.y <= entity.pos.y + entity.height
  );
};

const spawnBlood = (particles: Particle[], pos: Point) => {
  for (let i = 0; i < 8; i++) {
    particles.push({
      pos: { ...pos },
      vel: { x: (Math.random() - 0.5) * 5, y: (Math.random() - 0.5) * 5 - 2 },
      life: 30 + Math.random() * 20,
      maxLife: 50,
      color: '#ff3b30',
      size: 2 + Math.random() * 3
    });
  }
};

const spawnExplosion = (particles: Particle[], pos: Point) => {
  // Fire particles
  for (let i = 0; i < 25; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 8 + 2;
    particles.push({
      pos: { ...pos },
      vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed - 2 },
      life: 40 + Math.random() * 30,
      maxLife: 70,
      color: Math.random() > 0.5 ? '#ff4500' : '#ffcc00',
      size: 4 + Math.random() * 6
    });
  }
  // Smoke particles
  for (let i = 0; i < 15; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3 + 1;
    particles.push({
      pos: { ...pos },
      vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed - 1 },
      life: 60 + Math.random() * 40,
      maxLife: 100,
      color: '#555',
      size: 8 + Math.random() * 10
    });
  }
};
