class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  constructor() {
    // Initialize on first interaction
  }

  private init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = 0.3;
  }

  private playTone(freq: number, type: OscillatorType, duration: number, volume: number = 1) {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playBowTension(charge: number) {
    this.playTone(200 + charge * 400, 'sine', 0.1, 0.1);
  }

  playShoot() {
    this.playTone(800, 'sine', 0.1, 0.2);
    this.playTone(150, 'triangle', 0.2, 0.1);
  }

  playHit() {
    this.playTone(100, 'square', 0.1, 0.2);
    this.playTone(50, 'sine', 0.2, 0.3);
  }

  playKill() {
    this.playTone(150, 'sawtooth', 0.3, 0.2);
    this.playTone(80, 'sine', 0.5, 0.4);
  }

  playGameOver() {
    this.playTone(200, 'sine', 0.5, 0.3);
    this.playTone(150, 'sine', 0.7, 0.3);
    this.playTone(100, 'sine', 1.0, 0.3);
  }

  playWaveStart() {
    this.playTone(400, 'sine', 0.2, 0.2);
    setTimeout(() => this.playTone(600, 'sine', 0.2, 0.2), 100);
    setTimeout(() => this.playTone(800, 'sine', 0.4, 0.3), 200);
  }
}

export const audioSystem = new AudioSystem();
