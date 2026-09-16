'use strict';

/* ============================================================
   拾知 - Theme Particle Effects Engine
   Canvas-based particle system with theme-specific effects
   ============================================================ */

const ThemeFX = {
  canvas: null,
  ctx: null,
  particles: [],
  rafId: null,
  currentTheme: null,
  enabled: true,
  maxParticles: 60,

  /* Theme effect configurations */
  CONFIG: {
    'japanese':       { type: 'mote',      color: '#d4a574', count: 25, size: [1, 3], speed: [0.2, 0.6], opacity: [0.1, 0.3] },
    'ink':            { type: 'inkdrop',    color: '#333333', count: 15, size: [2, 6], speed: [0.1, 0.3], opacity: [0.05, 0.15] },
    'sakura':         { type: 'petal',      color: '#e91e63', count: 30, size: [6, 12], speed: [0.5, 1.5], opacity: [0.3, 0.7] },
    'zen':            { type: 'sand',       color: '#8d6e63', count: 20, size: [1, 2], speed: [0.1, 0.4], opacity: [0.1, 0.25] },
    'pokemon-gba':    { type: 'pixel',      color: '#9bbc0f', count: 20, size: [3, 6], speed: [0.3, 0.8], opacity: [0.2, 0.5] },
    'cyberpunk':      { type: 'glitch',     color: '#00ffff', count: 25, size: [1, 4], speed: [0.5, 2], opacity: [0.2, 0.6], secondary: '#ff00ff' },
    'stardew':        { type: 'leaf',       color: '#6b8e4e', count: 20, size: [4, 8], speed: [0.3, 0.8], opacity: [0.2, 0.5] },
    'shinkai':        { type: 'cloud',      color: '#bbdefb', count: 15, size: [20, 50], speed: [0.2, 0.5], opacity: [0.05, 0.15] },
    'deepsea':        { type: 'bubble',     color: '#7FDBFF', count: 25, size: [3, 10], speed: [0.3, 1], opacity: [0.1, 0.4] },
    'forest':         { type: 'leaf',       color: '#4caf50', count: 25, size: [5, 10], speed: [0.4, 1], opacity: [0.2, 0.5] },
    'twilight':       { type: 'firefly',    color: '#ff6b35', count: 30, size: [2, 5], speed: [0.2, 0.5], opacity: [0.3, 0.8] },
    'aurora':         { type: 'aurora',     color: '#00e676', count: 8, size: [100, 300], speed: [0.3, 0.6], opacity: [0.05, 0.12], secondary: '#7c4dff' },
    'warmsun':        { type: 'sunray',     color: '#ff8f00', count: 20, size: [2, 5], speed: [0.1, 0.4], opacity: [0.1, 0.3] },
    'coldmoon':       { type: 'moonbeam',   color: '#b0bec5', count: 20, size: [1, 3], speed: [0.1, 0.3], opacity: [0.1, 0.25] },
    'redplum':        { type: 'petal',      color: '#b71c1c', count: 25, size: [5, 10], speed: [0.4, 1], opacity: [0.3, 0.6] },
    'bamboo':         { type: 'leaf',       color: '#4a7c2e', count: 20, size: [4, 8], speed: [0.3, 0.7], opacity: [0.2, 0.4] },
    'forbidden':      { type: 'sparkle',   color: '#FFD700', count: 30, size: [1, 4], speed: [0.2, 0.6], opacity: [0.3, 0.7] },
    'obsidian':       { type: 'dust',      color: '#64ffda', count: 25, size: [1, 3], speed: [0.1, 0.4], opacity: [0.1, 0.3] },
    'ricepaper':      { type: 'mote',      color: '#a1887f', count: 15, size: [1, 2], speed: [0.1, 0.3], opacity: [0.05, 0.15] },
    'mint':           { type: 'mote',      color: '#00897B', count: 25, size: [2, 4], speed: [0.2, 0.5], opacity: [0.1, 0.3] },
    'rosegold':       { type: 'shimmer',   color: '#b76e79', count: 25, size: [2, 5], speed: [0.2, 0.5], opacity: [0.2, 0.5] },
    'neon-night':     { type: 'neon',       color: '#ff00ff', count: 25, size: [2, 6], speed: [0.3, 0.8], opacity: [0.3, 0.7], secondary: '#ffff00' },
    'retro':          { type: 'grain',     color: '#8b6914', count: 40, size: [1, 2], speed: [0, 0.1], opacity: [0.05, 0.2] },
    'blueporcelain':  { type: 'porcelain',  color: '#1565c0', count: 20, size: [3, 8], speed: [0.1, 0.3], opacity: [0.05, 0.15] },
  },

  init() {
    if (this.canvas) return;
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'fx-canvas';
    this.canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:0;';
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    // Respect reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.enabled = false;
    }
  },

  resize() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    this.ctx.scale(dpr, dpr);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
  },

  start(theme) {
    this.init();
    if (!this.enabled) return;
    if (this.currentTheme === theme && this.rafId) return;
    this.stop();
    this.currentTheme = theme;
    const cfg = this.CONFIG[theme];
    if (!cfg) { this.stop(); return; }

    // Make sure content sits above the canvas
    const app = document.getElementById('app');
    if (app) app.style.position = 'relative';

    this.particles = [];
    for (let i = 0; i < cfg.count; i++) {
      this.particles.push(this.createParticle(cfg));
    }
    this.config = cfg;
    this.animate();
  },

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.w, this.h);
    }
    this.particles = [];
  },

  createParticle(cfg) {
    const rand = (arr) => arr[0] + Math.random() * (arr[1] - arr[0]);
    const p = {
      x: Math.random() * this.w,
      y: Math.random() * this.h,
      size: rand(cfg.size),
      speed: rand(cfg.speed),
      opacity: rand(cfg.opacity),
      angle: Math.random() * Math.PI * 2,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.04,
      wobble: Math.random() * 2,
      wobbleSpeed: 0.01 + Math.random() * 0.03,
      phase: Math.random() * Math.PI * 2,
      color: cfg.color,
      secondary: cfg.secondary,
      life: 1,
      vx: 0, vy: 0,
    };
    // Set initial velocity based on type
    switch (cfg.type) {
      case 'petal':
      case 'leaf':
        p.vy = p.speed;
        p.vx = (Math.random() - 0.5) * p.speed * 0.5;
        break;
      case 'bubble':
        p.vy = -p.speed;
        p.vx = (Math.random() - 0.5) * 0.5;
        break;
      case 'pixel':
        p.vy = -p.speed;
        p.vx = (Math.random() - 0.5) * 0.3;
        break;
      case 'glitch':
        p.vy = p.speed;
        p.vx = 0;
        p.glitchOffset = Math.random() * 10;
        break;
      case 'firefly':
        p.vx = (Math.random() - 0.5) * p.speed;
        p.vy = (Math.random() - 0.5) * p.speed;
        break;
      case 'aurora':
        p.vx = p.speed;
        p.vy = 0;
        break;
      case 'sparkle':
      case 'shimmer':
        p.vy = -p.speed * 0.3;
        p.vx = (Math.random() - 0.5) * 0.2;
        break;
      case 'sunray':
        p.vy = -p.speed * 0.2;
        p.vx = (Math.random() - 0.5) * 0.1;
        break;
      case 'grain':
        p.vx = 0; p.vy = 0;
        break;
      default:
        p.vy = p.speed * 0.3;
        p.vx = (Math.random() - 0.5) * p.speed * 0.3;
    }
    return p;
  },

  animate() {
    if (!this.enabled || !this.ctx) return;
    this.rafId = requestAnimationFrame(() => this.animate());
    this.ctx.clearRect(0, 0, this.w, this.h);
    const cfg = this.config;
    if (!cfg) return;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      this.updateParticle(p, cfg);
      this.drawParticle(p, cfg);
      // Respawn if out of bounds
      if (p.y > this.h + 50 || p.y < -100 || p.x > this.w + 100 || p.x < -100) {
        this.respawnParticle(p, cfg);
      }
    }
  },

  updateParticle(p, cfg) {
    p.phase += p.wobbleSpeed;
    switch (cfg.type) {
      case 'petal':
      case 'leaf':
        p.x += p.vx + Math.sin(p.phase) * 0.8;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        break;
      case 'bubble':
        p.x += p.vx + Math.sin(p.phase) * 0.5;
        p.y += p.vy;
        break;
      case 'pixel':
        p.x += p.vx;
        p.y += p.vy;
        break;
      case 'glitch':
        p.y += p.vy;
        if (Math.random() < 0.02) p.x += (Math.random() - 0.5) * 20;
        break;
      case 'firefly':
        p.vx += (Math.random() - 0.5) * 0.05;
        p.vy += (Math.random() - 0.5) * 0.05;
        p.vx = Math.max(-1, Math.min(1, p.vx));
        p.vy = Math.max(-1, Math.min(1, p.vy));
        p.x += p.vx;
        p.y += p.vy;
        p.opacity = cfg.opacity[0] + Math.abs(Math.sin(p.phase * 2)) * (cfg.opacity[1] - cfg.opacity[0]);
        break;
      case 'aurora':
        p.x += p.vx;
        p.phase += 0.005;
        break;
      case 'sparkle':
      case 'shimmer':
        p.x += p.vx;
        p.y += p.vy;
        p.opacity = cfg.opacity[0] + Math.abs(Math.sin(p.phase * 3)) * (cfg.opacity[1] - cfg.opacity[0]);
        break;
      case 'sunray':
        p.x += p.vx;
        p.y += p.vy;
        break;
      case 'grain':
        if (Math.random() < 0.1) {
          p.x = Math.random() * this.w;
          p.y = Math.random() * this.h;
        }
        break;
      case 'cloud':
        p.x += p.vx;
        break;
      case 'neon':
        p.x += p.vx;
        p.y += p.vy;
        p.opacity = cfg.opacity[0] + Math.abs(Math.sin(p.phase * 2)) * (cfg.opacity[1] - cfg.opacity[0]);
        break;
      default:
        p.x += p.vx + Math.sin(p.phase) * 0.3;
        p.y += p.vy;
    }
  },

  drawParticle(p, cfg) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = p.opacity;

    switch (cfg.type) {
      case 'petal':
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'leaf':
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'pixel':
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        break;

      case 'bubble':
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = p.opacity * 0.3;
        ctx.fillStyle = p.color;
        ctx.fill();
        break;

      case 'glitch':
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size * 8, p.size);
        if (p.secondary && Math.random() < 0.3) {
          ctx.fillStyle = p.secondary;
          ctx.globalAlpha = p.opacity * 0.5;
          ctx.fillRect(p.x + p.glitchOffset, p.y + p.size, p.size * 6, p.size);
        }
        break;

      case 'firefly':
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
        glow.addColorStop(0, p.color);
        glow.addColorStop(0.3, p.color + '88');
        glow.addColorStop(1, p.color + '00');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'aurora':
        const auroraGrad = ctx.createLinearGradient(p.x, p.y, p.x + p.size, p.y + 200);
        auroraGrad.addColorStop(0, p.color + '00');
        auroraGrad.addColorStop(0.3, p.color + '33');
        auroraGrad.addColorStop(0.5, (p.secondary || p.color) + '22');
        auroraGrad.addColorStop(0.7, p.color + '33');
        auroraGrad.addColorStop(1, p.color + '00');
        ctx.fillStyle = auroraGrad;
        const waveY = Math.sin(p.phase) * 30;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y + waveY);
        ctx.quadraticCurveTo(p.x + p.size * 0.3, p.y + waveY - 50, p.x + p.size * 0.5, p.y + waveY);
        ctx.quadraticCurveTo(p.x + p.size * 0.7, p.y + waveY + 50, p.x + p.size, p.y + waveY);
        ctx.lineTo(p.x + p.size, p.y + waveY + 200);
        ctx.lineTo(p.x, p.y + waveY + 200);
        ctx.closePath();
        ctx.fill();
        break;

      case 'cloud':
        const cloudGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        cloudGrad.addColorStop(0, p.color);
        cloudGrad.addColorStop(1, p.color + '00');
        ctx.fillStyle = cloudGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'sparkle':
        ctx.translate(p.x, p.y);
        ctx.rotate(p.phase);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(0, p.size);
        ctx.moveTo(-p.size, 0);
        ctx.lineTo(p.size, 0);
        ctx.stroke();
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.3, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'shimmer':
        const shimGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
        shimGrad.addColorStop(0, p.color);
        shimGrad.addColorStop(0.5, p.color + '44');
        shimGrad.addColorStop(1, p.color + '00');
        ctx.fillStyle = shimGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'sunray':
        const rayGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
        rayGrad.addColorStop(0, p.color);
        rayGrad.addColorStop(1, p.color + '00');
        ctx.fillStyle = rayGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'grain':
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        break;

      case 'neon':
        const neonGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 5);
        const neonColor = Math.random() < 0.5 ? p.color : (p.secondary || p.color);
        neonGrad.addColorStop(0, neonColor);
        neonGrad.addColorStop(0.3, neonColor + '66');
        neonGrad.addColorStop(1, neonColor + '00');
        ctx.fillStyle = neonGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 5, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'moonbeam':
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'porcelain':
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case 'sand':
      case 'mote':
      case 'dust':
      default:
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
  },

  respawnParticle(p, cfg) {
    p.x = Math.random() * this.w;
    switch (cfg.type) {
      case 'petal':
      case 'leaf':
      case 'pixel':
      case 'glitch':
      case 'sunray':
      case 'grain':
        p.y = -20;
        break;
      case 'bubble':
      case 'sparkle':
      case 'shimmer':
        p.y = this.h + 20;
        break;
      case 'firefly':
      case 'neon':
      case 'moonbeam':
      case 'mote':
      case 'dust':
      case 'sand':
        p.y = Math.random() * this.h;
        break;
      case 'cloud':
        p.y = Math.random() * this.h * 0.5;
        p.x = -p.size;
        break;
      case 'aurora':
        p.y = Math.random() * this.h * 0.6;
        p.x = -p.size;
        break;
      default:
        p.y = Math.random() * this.h;
    }
    // Reset opacity
    p.opacity = cfg.opacity[0] + Math.random() * (cfg.opacity[1] - cfg.opacity[0]);
  },
};
