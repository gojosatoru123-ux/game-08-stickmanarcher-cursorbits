export interface Point {
  x: number;
  y: number;
}

export interface Vector {
  x: number;
  y: number;
}

export enum EntityType {
  PLAYER = 'PLAYER',
  ENEMY_ARCHER = 'ENEMY_ARCHER',
  ENEMY_SPEARMAN = 'ENEMY_SPEARMAN',
  ENEMY_SPREAD_ARCHER = 'ENEMY_SPREAD_ARCHER',
  ENEMY_SHIELD_SPEARMAN = 'ENEMY_SHIELD_SPEARMAN',
  ENEMY_FLYING_BOMBER = 'ENEMY_FLYING_BOMBER',
}

export interface Entity {
  id: string;
  type: EntityType;
  pos: Point;
  vel: Vector;
  health: number;
  maxHealth: number;
  width: number;
  height: number;
  isDead: boolean;
  lastShotTime: number;
  lastHitTime: number;
  shieldHealth: number;
  aimAngle: number;
  charge: number; // 0 to 1
}

export interface Arrow {
  id: string;
  pos: Point;
  vel: Vector;
  angle: number;
  ownerId: string;
  isStuck: boolean;
  stuckInId?: string;
  stuckOffset?: Point;
  damage: number;
  isFireball?: boolean;
}

export interface Particle {
  pos: Point;
  vel: Vector;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface Platform {
  id: string;
  pos: Point;
  width: number;
}

export interface HealthKit {
  id: string;
  pos: Point;
  healAmount: number;
  isCollected: boolean;
}

export interface GameState {
  player: Entity;
  enemies: Entity[];
  platforms: Platform[];
  arrows: Arrow[];
  healthKits: HealthKit[];
  particles: Particle[];
  score: number;
  highScore: number;
  combo: number;
  maxCombo: number;
  lastKillTime: number;
  isGameOver: boolean;
  isPaused: boolean;
  wave: number;
  difficulty: number;
  screenShake: number;
  slowMoFactor: number;
  waveNotification?: {
    message: string;
    life: number;
  };
  floatingTexts: {
    id: string;
    text: string;
    pos: Point;
    life: number;
    color: string;
  }[];
}
