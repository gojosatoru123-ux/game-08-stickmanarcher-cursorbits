import { GameState, EntityType, Entity, Arrow, Particle } from './types';
import { GROUND_Y, VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from './gameLogic';

export const render = (ctx: CanvasRenderingContext2D, state: GameState, width: number, height: number) => {
  ctx.clearRect(0, 0, width, height);

  const scaleX = width / VIRTUAL_WIDTH;
  const scaleY = height / VIRTUAL_HEIGHT;
  const scale = Math.min(scaleX, scaleY);
  
  // Center the game area
  const offsetX = (width - VIRTUAL_WIDTH * scale) / 2;
  const offsetY = (height - VIRTUAL_HEIGHT * scale) / 2;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Apply Screen Shake
  if (state.screenShake > 0) {
    ctx.save();
    const dx = (Math.random() - 0.5) * state.screenShake;
    const dy = (Math.random() - 0.5) * state.screenShake;
    ctx.translate(dx, dy);
  }

  // Draw Ground
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(VIRTUAL_WIDTH, GROUND_Y);
  ctx.strokeStyle = '#d1d1d6';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw Platforms
  state.platforms.forEach(p => {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#d1d1d6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(p.pos.x, p.pos.y, p.width, 10, 5);
    ctx.fill();
    ctx.stroke();
    
    // Platform shadow/depth
    ctx.fillStyle = '#f5f5f7';
    ctx.fillRect(p.pos.x + 5, p.pos.y + 10, p.width - 10, 4);
  });

  // Draw Particles
  state.particles.forEach(p => {
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Draw Health Kits
  state.healthKits.forEach(kit => {
    const { x, y } = kit.pos;
    const bounce = Math.sin(Date.now() / 200) * 5;
    
    // Box
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ff3b30';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x - 12, y - 12 + bounce, 24, 24, 4);
    ctx.fill();
    ctx.stroke();
    
    // Cross
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(x - 8, y - 2 + bounce, 16, 4);
    ctx.fillRect(x - 2, y - 8 + bounce, 4, 16);
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(x, GROUND_Y, 15, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw Arrows
  state.arrows.forEach(arrow => {
    ctx.save();
    ctx.translate(arrow.pos.x, arrow.pos.y);
    ctx.rotate(arrow.angle);
    
    if (arrow.isFireball) {
      // Fireball core
      const gradient = ctx.createRadialGradient(0, 0, 2, 0, 0, 10);
      gradient.addColorStop(0, '#fff');
      gradient.addColorStop(0.4, '#ffcc00');
      gradient.addColorStop(1, 'rgba(255, 69, 0, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      
      // Trail
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.quadraticCurveTo(-20, 0, 0, 5);
      ctx.fillStyle = 'rgba(255, 69, 0, 0.6)';
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(-15, 0);
      ctx.lineTo(15, 0);
      ctx.strokeStyle = '#1d1d1f';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Arrow head
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(10, -3);
      ctx.lineTo(10, 3);
      ctx.closePath();
      ctx.fillStyle = '#1d1d1f';
      ctx.fill();

      // Fletching
      ctx.beginPath();
      ctx.moveTo(-15, 0);
      ctx.lineTo(-20, -4);
      ctx.moveTo(-15, 0);
      ctx.lineTo(-20, 4);
      ctx.strokeStyle = '#86868b';
      ctx.stroke();
    }
    
    ctx.restore();
  });

  // Draw Player
  drawStickman(ctx, state.player, true, state.player.pos.x);

  // Draw Enemies
  state.enemies.forEach(enemy => {
    drawStickman(ctx, enemy, false, state.player.pos.x);
  });

  // Draw Aiming Line (if charging)
  if (state.player.charge > 0 && !state.player.isDead) {
    const angle = state.player.aimAngle;
    const length = 100 * state.player.charge;
    
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(state.player.pos.x, state.player.pos.y + 20);
    ctx.lineTo(
      state.player.pos.x + Math.cos(angle) * length,
      state.player.pos.y + 20 + Math.sin(angle) * length
    );
    ctx.strokeStyle = 'rgba(0, 113, 227, 0.5)';
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (state.screenShake > 0) {
    ctx.restore();
  }

  // Draw Wave Notification
  if (state.waveNotification) {
    const { message, life } = state.waveNotification;
    const alpha = Math.min(1, life / 500);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Background glow
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(0, 113, 227, 0.5)';
    
    ctx.font = 'bold 48px "Inter", sans-serif';
    ctx.fillStyle = '#0071e3';
    ctx.fillText(message, VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 50);
    
    ctx.font = 'bold 24px "Inter", sans-serif';
    ctx.fillStyle = '#1d1d1f';
    ctx.fillText("PREPARE YOURSELF", VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 10);
    
    ctx.restore();
  }

  // Draw Floating Texts
  state.floatingTexts.forEach(t => {
    ctx.save();
    ctx.globalAlpha = Math.min(1, t.life / 200);
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px "Inter", sans-serif';
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.pos.x, t.pos.y);
    ctx.restore();
  });

  ctx.restore(); // Restore scaling & translation
};

const drawStickman = (ctx: CanvasRenderingContext2D, entity: Entity, isPlayer: boolean, playerX: number) => {
  let { x, y } = entity.pos;
  const now = Date.now();
  const hitElapsed = now - entity.lastHitTime;
  const isFlinching = hitElapsed < 150;
  
  // Facing direction
  const facingRight = isPlayer ? (entity.aimAngle > -Math.PI / 2 && entity.aimAngle < Math.PI / 2) : (x < playerX);
  const flip = facingRight ? 1 : -1;

  // Apply flinch offset
  if (isFlinching) {
    x += (Math.random() - 0.5) * 6;
    y += (Math.random() - 0.5) * 4;
  }

  const baseColor = entity.isDead ? '#d1d1d6' : (isPlayer ? '#0071e3' : '#1d1d1f');
  const color = isFlinching ? '#ff3b30' : baseColor; // Flash red on hit
  
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  // Wings for flying bomber
  if (entity.type === EntityType.ENEMY_FLYING_BOMBER && !entity.isDead) {
    ctx.save();
    ctx.strokeStyle = '#86868b';
    ctx.lineWidth = 2;
    const wingSpread = Math.sin(Date.now() / 100) * 15;
    
    ctx.beginPath();
    ctx.moveTo(x, y + 25);
    ctx.bezierCurveTo(x + 20, y - 10 - wingSpread, x + 40, y + 10, x + 10, y + 30);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(x, y + 25);
    ctx.bezierCurveTo(x - 20, y - 10 - wingSpread, x - 40, y + 10, x - 10, y + 30);
    ctx.stroke();
    ctx.restore();
  }

  // Head
  ctx.beginPath();
  ctx.arc(x, y + 10, 8, 0, Math.PI * 2);
  ctx.stroke();

  // Body
  ctx.beginPath();
  ctx.moveTo(x, y + 18);
  ctx.lineTo(x, y + 40);
  ctx.stroke();

  // Legs
  const isMoving = !entity.isDead && (entity.type === EntityType.ENEMY_SPEARMAN || entity.type === EntityType.ENEMY_SHIELD_SPEARMAN);
  const legSpeed = isMoving ? 150 : 100;
  const legAmplitude = isMoving ? 0.4 : 0.2;
  const legAngle = entity.isDead ? Math.PI / 4 : Math.sin(Date.now() / legSpeed) * legAmplitude;
  
  ctx.beginPath();
  ctx.moveTo(x, y + 40);
  ctx.lineTo(x - 12 * flip * Math.cos(legAngle), y + 60 + 5 * Math.sin(legAngle));
  ctx.moveTo(x, y + 40);
  ctx.lineTo(x + 12 * flip * Math.cos(legAngle), y + 60 - 5 * Math.sin(legAngle));
  ctx.stroke();

  // Shield for shield spearman
  if (entity.type === EntityType.ENEMY_SHIELD_SPEARMAN && !entity.isDead && entity.shieldHealth > 0) {
    ctx.fillStyle = '#d1d1d6';
    ctx.strokeStyle = '#86868b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x + (facingRight ? 6 : -18), y + 15, 12, 35, 4);
    ctx.fill();
    ctx.stroke();
  }

  // Arms & Weapon
  ctx.save();
  ctx.translate(x, y + 25);
  
  if ((entity.type === EntityType.ENEMY_SPEARMAN || entity.type === EntityType.ENEMY_SHIELD_SPEARMAN) && !entity.isDead) {
    // Spearman arm & spear
    const isAttacking = now - entity.lastShotTime < 300;
    const thrustOffset = isAttacking ? Math.sin((now - entity.lastShotTime) / 300 * Math.PI) * 25 : 0;
    
    ctx.rotate((facingRight ? -Math.PI / 6 : Math.PI / 6) + (isAttacking ? 0 : Math.sin(Date.now() / 50) * 0.1));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo((20 + thrustOffset) * flip, 0);
    ctx.stroke();
    
    // Spear
    ctx.beginPath();
    ctx.moveTo((30 + thrustOffset) * flip, 0);
    ctx.lineTo((-10 + thrustOffset) * flip, 0);
    ctx.strokeStyle = '#86868b';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo((30 + thrustOffset) * flip, 0);
    ctx.lineTo((35 + thrustOffset) * flip, -3);
    ctx.lineTo((35 + thrustOffset) * flip, 3);
    ctx.closePath();
    ctx.fillStyle = '#86868b';
    ctx.fill();
  } else if (!entity.isDead) {
    // Archer arms & bow
    const angle = isPlayer ? entity.aimAngle : Math.atan2(entity.pos.y + 20 - (y + 25), playerX - x);
    ctx.rotate(angle);
    
    // Bow (Spread archer has a larger/different bow)
    const isSpread = entity.type === EntityType.ENEMY_SPREAD_ARCHER;
    ctx.beginPath();
    ctx.arc(10, 0, isSpread ? 25 : 20, -Math.PI / 2, Math.PI / 2);
    ctx.strokeStyle = isSpread ? '#0071e3' : '#86868b';
    ctx.lineWidth = isSpread ? 4 : 2;
    ctx.stroke();
    
    // String
    const pull = entity.charge * 15;
    ctx.beginPath();
    ctx.moveTo(10, isSpread ? -25 : -20);
    ctx.lineTo(10 - pull, 0);
    ctx.lineTo(10, isSpread ? 25 : 20);
    ctx.stroke();

    // Arms
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(10 - pull, 0);
    ctx.stroke();
  } else {
    // Dead arms
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-10, 10);
    ctx.moveTo(0, 0);
    ctx.lineTo(10, 10);
    ctx.stroke();
  }
  
  ctx.restore();

  // Health Bar
  if (!entity.isDead && entity.health < entity.maxHealth) {
    const barWidth = 40;
    const h = (entity.health / entity.maxHealth) * barWidth;
    ctx.fillStyle = '#e5e5ea';
    ctx.fillRect(x - barWidth / 2, y - 10, barWidth, 4);
    ctx.fillStyle = isPlayer ? '#34c759' : '#ff3b30';
    ctx.fillRect(x - barWidth / 2, y - 10, h, 4);
  }
};
