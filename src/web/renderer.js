// Infinite procedural Map Canvas Renderer with Fog of War for Realmbound Wilds
import { generateCell, getCell, REALMS } from '../simulation/engine.js';

export class CosmicSynth {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.ambientOsc = null;
    this.ambientGain = null;
    this.musicMuted = true;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }

  playClick() {
    this.init();
    if (this.muted || !this.ctx) return;
    
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(330, this.ctx.currentTime); // E4 pluck
    osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.15);
    
    gainNode.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
    
    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playPortalTravel() {
    this.init();
    if (this.muted || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.65);

    filter.type = 'bandpass';
    filter.Q.value = 4.0;
    filter.frequency.setValueAtTime(200, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(1000, this.ctx.currentTime + 0.65);

    gainNode.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.7);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.72);
  }

  playBell() {
    this.init();
    if (this.muted || !this.ctx) return;

    const o1 = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    o1.type = 'sine';
    o1.frequency.value = 160;
    o2.type = 'triangle';
    o2.frequency.value = 161.5;

    gainNode.gain.setValueAtTime(0.22, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.1);

    o1.connect(gainNode);
    o2.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    o1.start();
    o2.start();
    o1.stop(this.ctx.currentTime + 1.2);
    o2.stop(this.ctx.currentTime + 1.2);
  }

  playAlliance() {
    this.init();
    if (this.muted || !this.ctx) return;

    const freqs = [330, 440, 554, 660];
    freqs.forEach(f => {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = f;

      gainNode.gain.setValueAtTime(0.06, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.7);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.85);
    });
  }

  startAmbientMusic(realm = 'overworld') {
    this.init();
    if (this.musicMuted || !this.ctx) return;
    this.stopAmbientMusic();
    
    this.ambientOsc = this.ctx.createOscillator();
    this.ambientGain = this.ctx.createGain();
    
    let baseFreq = 110;
    let type = 'sine';
    
    if (realm === 'overworld') {
      baseFreq = 220;
      type = 'triangle';
    } else if (realm === 'underworld') {
      baseFreq = 82.4;
      type = 'sawtooth';
    } else if (realm === 'aether') {
      baseFreq = 329.6;
      type = 'sine';
    } else if (realm === 'space') {
      baseFreq = 55.0;
      type = 'sine';
    }
    
    this.ambientOsc.type = type;
    this.ambientOsc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
    
    this.ambientGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    this.ambientGain.gain.linearRampToValueAtTime(0.04, this.ctx.currentTime + 1.0);
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = realm === 'underworld' ? 180 : 450;
    
    this.ambientOsc.connect(filter);
    filter.connect(this.ambientGain);
    this.ambientGain.connect(this.ctx.destination);
    
    this.ambientOsc.start();
  }

  stopAmbientMusic() {
    if (this.ambientOsc) {
      try {
        this.ambientOsc.stop();
      } catch (e) {}
      this.ambientOsc = null;
    }
  }
}

window.synth = new CosmicSynth();


export const BIOME_LABELS = {
  ocean: 'Ocean',
  coast: 'Coast',
  lake: 'Lake',
  plains: 'Plains',
  forest: 'Dense Forest',
  mountain: 'Mountain Range',
  desert: 'Desert Wasteland',
  tundra: 'Tundra',
  deep_lake: 'Deep Cavern Lake',
  solid_rock: 'Solid Cave Rock',
  magma_vent: 'Volcanic Magma Vent',
  mushroom_forest: 'Spore Mushroom Forest',
  crystal_cave: 'Subterranean Crystal Cave',
  cavern: 'Cavernous Wilderness',
  void: 'Aetherial Sky Void',
  storm_peaks: 'Aetherial Storm Peaks',
  starlight_woods: 'Starlight Sky Woods',
  cloud_fields: 'Fluffy Cloud Fields',
  sky_island: 'Floating Sky Island',
  void_space: 'Empty Void Space',
  comet_tail: 'Glowing Comet Tail',
  nebula: 'Cosmic Nebula Cloud',
  asteroid_belt: 'Rocky Asteroid Belt'
};

// Biome color schemes for different realms
const REALM_BIOME_COLORS = {
  overworld: {
    ocean: '#0c1524', coast: '#1b324d', lake: '#244e76', plains: '#455e3c',
    forest: '#264228', mountain: '#4a4d53', desert: '#8a7959', tundra: '#5a6b6c', crater: '#2a2220'
  },
  underworld: {
    deep_lake: '#0c0f1d', solid_rock: '#1e1c22', magma_vent: '#b91c1c',
    mushroom_forest: '#18382c', crystal_cave: '#4c2e6b', cavern: '#2d2b33', crater: '#2a2220'
  },
  aether: {
    void: '#0b0c16', storm_peaks: '#4d5162', starlight_woods: '#1d3e56',
    cloud_fields: '#65779c', sky_island: '#3a6b7e', crater: '#2a2220'
  },
  space: {
    void_space: '#020205', comet_tail: '#29435c', nebula: '#3f1f51', asteroid_belt: '#1b1d22', crater: '#2a2220'
  }
};

const FOW_COLORS = {
  overworld: '#0b0c10',
  underworld: '#030305',
  aether: '#101424',
  space: '#010103'
};

const FACTION_COLORS = ["#3b82f6", "#10b981", "#6b7280", "#f59e0b", "#8b5cf6", "#ec4899"];

export class MapRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Viewport Zoom & Pan
    this.zoom = 1.0;
    this.targetZoom = 1.0; // Added for smooth zoom interpolation
    this.panX = 0;
    this.targetPanX = 0; // Added for smooth pan interpolation
    this.panY = 0;
    this.targetPanY = 0; // Added for smooth pan interpolation
    
    this.selectedCell = null;
    this.hoveredCell = null;
    
    this.viewMode = 'terrain'; // 'terrain' | 'factions' | 'wildlife' | 'temperature'
    this.activeRealm = REALMS.OVERWORLD; // Current rendering dimension
    
    this.world = null;
    this.historicalState = null;
    this.tileSize = 28;
    
    // Kinetic physics
    this.vx = 0;
    this.vy = 0;
    this.isDragging = false;
    
    this.animTime = 0;
    this.particles = [];
    this.atmosphericParticles = []; // Custom atmospheric elements per realm
    this.entities = []; // Animated citizens and wildlife entities roaming the map
    this.roadTraffic = {}; // Tracks coordinate traversals for dynamic roads
    this.lastWorldYear = 1;
    
    this.discoveryCache = new Set();
    this.setupEvents();
    this.startAnimationLoop();
  }

  rebuildDiscoveryCache() {
    this.discoveryCache.clear();
    const centers = this.historicalState ? this.historicalState.discoveredCenters : (this.world ? this.world.discoveredCenters : []);
    if (!centers) return;

    for (let i = 0; i < centers.length; i++) {
      const c = centers[i];
      if (c.realm === this.activeRealm) {
        const rad = Math.ceil(c.radius);
        // Precompute coordinates within circle distance
        for (let dy = -rad; dy <= rad; dy++) {
          for (let dx = -rad; dx <= rad; dx++) {
            if (dx*dx + dy*dy <= c.radius * c.radius) {
              this.discoveryCache.add(`${c.x + dx},${c.y + dy}`);
            }
          }
        }
      }
    }
  }

  setWorld(world) {
    this.world = world;
    this.historicalState = null;
    this.rebuildDiscoveryCache();
    this.resize();
    this.resetView();
    // Immediate zoom/pan without lerping initially
    this.zoom = this.targetZoom;
    this.panX = this.targetPanX;
    this.panY = this.targetPanY;
  }

  setHistoricalState(state) {
    this.historicalState = state;
    this.rebuildDiscoveryCache();
    this.draw();
  }

  setViewMode(mode) {
    this.viewMode = mode;
    this.draw();
  }

  setRealm(realm) {
    this.activeRealm = realm;
    this.selectedCell = null;
    this.hoveredCell = null;
    this.atmosphericParticles = []; // Clear current atmospheric particles
    this.rebuildDiscoveryCache();
    if (window.synth) {
      window.synth.startAmbientMusic(realm);
    }
    this.draw();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.draw();
  }

  resetView() {
    this.targetZoom = 1.0;
    this.targetPanX = this.canvas.width / 2;
    this.targetPanY = this.canvas.height / 2;
    this.vx = 0;
    this.vy = 0;
  }

  zoomIn() {
    this.targetZoom = Math.min(3.5, this.targetZoom * 1.25);
  }

  zoomOut() {
    // Enforce reasonable zoom limit to avoid canvas scaling overhead
    this.targetZoom = Math.max(0.3, this.targetZoom / 1.25);
  }

  // Check if coordinate is discovered under current Fog of War centers
  isCoordinateDiscovered(x, y) {
    return this.discoveryCache.has(`${x},${y}`);
  }

  // Get active cell from coordinates
  screenToCell(screenX, screenY) {
    if (!this.world) return null;
    const mapX = (screenX - this.panX) / this.zoom;
    const mapY = (screenY - this.panY) / this.zoom;
    
    const cx = Math.floor(mapX / this.tileSize);
    const cy = Math.floor(mapY / this.tileSize);
    
    // Check if discovered. Undiscovered tiles cannot be clicked/inspected
    if (!this.isCoordinateDiscovered(cx, cy)) {
      return { x: cx, y: cy, undiscovered: true, realm: this.activeRealm };
    }

    if (this.historicalState) {
      return this.getReconstructedCell(cx, cy);
    }

    // Live mode coordinate resolution
    const key = `${this.activeRealm}:${cx},${cy}`;
    if (this.world.modifiedCells[key]) {
      return this.world.modifiedCells[key];
    }
    return generateCell(cx, cy, this.activeRealm, this.world.seed);
  }

  // Reconstruct dynamic cell state from historical logs
  getReconstructedCell(cx, cy) {
    const baseCell = generateCell(cx, cy, this.activeRealm, this.world.seed);
    const cells = this.historicalState.mapState.modifiedCells || [];
    const keyCell = cells.find(c => c.r === this.activeRealm && c.x === cx && c.y === cy);

    if (keyCell) {
      baseCell.settlement = keyCell.f ? {
        name: keyCell.f === 'Players' ? 'Player Settlement' : `${keyCell.f} Outpost`,
        faction: keyCell.f,
        size: keyCell.s,
        type: keyCell.t
      } : null;
      baseCell.ruin = keyCell.ruin ? { name: keyCell.ruin.name, portalTarget: keyCell.ruin.portalTarget } : null;
      baseCell.fireTicksLeft = keyCell.fire ? 1 : 0;
      baseCell.history = [`Observed in the archives of Year ${this.historicalState.year}.`];
    }

    return baseCell;
  }

  setupEvents() {
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;

    this.canvas.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      startX = e.clientX - this.targetPanX;
      startY = e.clientY - this.targetPanY;
      lastX = e.clientX;
      lastY = e.clientY;
      this.vx = 0;
      this.vy = 0;
    });

    window.addEventListener('pointermove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      if (this.isDragging) {
        this.targetPanX = e.clientX - startX;
        this.targetPanY = e.clientY - startY;
        
        this.vx = e.clientX - lastX;
        this.vy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
      } else {
        const cell = this.screenToCell(clientX, clientY);
        if (cell !== this.hoveredCell) {
          this.hoveredCell = cell;
        }
      }
    });

    window.addEventListener('pointerup', () => {
      this.isDragging = false;
    });

    window.addEventListener('pointercancel', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('click', (e) => {
      if (Math.hypot(this.vx, this.vy) > 3) return;

      const rect = this.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      
      const cell = this.screenToCell(clickX, clickY);
      this.selectedCell = cell;
      
      // Play a click sound profile when selecting cells
      if (window.synth && !cell.undiscovered) {
        window.synth.playClick();
      }
      
      if (this.onSelectCell) {
        this.onSelectCell(cell);
      }
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const mapX = (mouseX - this.targetPanX) / this.targetZoom;
      const mapY = (mouseY - this.targetPanY) / this.targetZoom;
      
      const zoomFactor = e.deltaY < 0 ? 1.18 : 0.82;
      this.targetZoom = Math.max(0.1, Math.min(6.0, this.targetZoom * zoomFactor));
      
      this.targetPanX = mouseX - mapX * this.targetZoom;
      this.targetPanY = mouseY - mapY * this.targetZoom;
    }, { passive: false });
  }

  startAnimationLoop() {
    const loop = () => {
      try {
      this.animTime += 0.04;
      
      let changed = false;

      // Smooth zoom lerp
      if (Math.abs(this.zoom - this.targetZoom) > 0.001) {
        this.zoom += (this.targetZoom - this.zoom) * 0.15;
        changed = true;
      } else if (this.zoom !== this.targetZoom) {
        this.zoom = this.targetZoom;
        changed = true;
      }

      // Kinetic physics applied to targets
      if (!this.isDragging && (Math.abs(this.vx) > 0.1 || Math.abs(this.vy) > 0.1)) {
        this.targetPanX += this.vx;
        this.targetPanY += this.vy;
        this.vx *= 0.88;
        this.vy *= 0.88;
      }

      // Smooth pan lerp
      if (Math.abs(this.panX - this.targetPanX) > 0.05) {
        this.panX += (this.targetPanX - this.panX) * 0.2;
        changed = true;
      } else if (this.panX !== this.targetPanX) {
        this.panX = this.targetPanX;
        changed = true;
      }

      if (Math.abs(this.panY - this.targetPanY) > 0.05) {
        this.panY += (this.targetPanY - this.panY) * 0.2;
        changed = true;
      } else if (this.panY !== this.targetPanY) {
        this.panY = this.targetPanY;
        changed = true;
      }

      this.updateParticles();
      // Always draw to make sure animated particles and waves render smoothly
      this.draw();
      } catch (err) {
        console.error('Render loop error:', err);
      }
      
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  updateParticles() {
    // Generate active wildfire ember particles
    if (this.world) {
      const ts = this.tileSize;
      
      // We gather visible cells to check for fires
      const startX = Math.floor(-this.panX / (this.zoom * ts)) - 1;
      const endX = Math.ceil((this.canvas.width - this.panX) / (this.zoom * ts)) + 1;
      const startY = Math.floor(-this.panY / (this.zoom * ts)) - 1;
      const endY = Math.ceil((this.canvas.height - this.panY) / (this.zoom * ts)) + 1;

      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          if (!this.isCoordinateDiscovered(x, y)) continue;

          let onFire = false;
          if (this.historicalState) {
            const cells = this.historicalState.mapState.modifiedCells || [];
            onFire = cells.some(c => c.r === this.activeRealm && c.x === x && c.y === y && c.fire);
          } else {
            const key = `${this.activeRealm}:${x},${y}`;
            const cell = this.world.modifiedCells[key];
            onFire = cell && cell.fireTicksLeft > 0;
          }

          if (onFire && Math.random() < 0.15) {
            this.particles.push({
              x: x * ts + Math.random() * ts,
              y: y * ts + ts,
              vx: Math.random() * 0.4 - 0.2,
              vy: -Math.random() * 0.7 - 0.5,
              life: 1.0,
              size: Math.random() * 2.5 + 1,
              color: `rgba(${220 + Math.floor(Math.random() * 35)}, ${100 + Math.floor(Math.random() * 40)}, 0, `
            });
          }
        }
      }

      // Generate atmospheric particles in screen space to cover the viewport nicely
      const maxAtmosphere = 30;
      while (this.atmosphericParticles.length < maxAtmosphere) {
        this.atmosphericParticles.push({
          x: Math.random() * this.canvas.width,
          y: Math.random() * this.canvas.height,
          vx: this.activeRealm === 'overworld' ? Math.random() * 0.5 - 0.2 : (this.activeRealm === 'space' ? Math.random() * 0.15 - 0.07 : Math.random() * 0.4 - 0.1),
          vy: this.activeRealm === 'underworld' ? -Math.random() * 0.4 - 0.1 : (this.activeRealm === 'overworld' ? Math.random() * 0.3 + 0.2 : Math.random() * 0.15 - 0.05),
          size: Math.random() * 3 + 1,
          life: Math.random() * 0.5 + 0.5,
          angle: Math.random() * Math.PI * 2,
          spin: Math.random() * 0.02 - 0.01
        });
      }
    }

    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.035;
    });
    this.particles = this.particles.filter(p => p.life > 0);

    // Update atmospheric particles
    this.atmosphericParticles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.spin;
      
      // Wrap around canvas boundaries
      if (p.x < 0) p.x = this.canvas.width;
      if (p.x > this.canvas.width) p.x = 0;
      if (p.y < 0) p.y = this.canvas.height;
      if (p.y > this.canvas.height) p.y = 0;
    });

    // Generate and animate roaming entities
    if (this.world) {
      const ts = this.tileSize;

      // Handle generational aging and reproduction on year change
      if (this.world.year !== this.lastWorldYear) {
        this.lastWorldYear = this.world.year;
        
        const CITIZEN_NAMES = ["Thorin", "Elara", "Alden", "Valen", "Kira", "Roran", "Lyra", "Sark", "Dara", "Joran"];
        const TRAITS = ["Swiftfooted", "Giant Strength", "Sickly", "Intellectual", "Rugged"];
        const kidsToSpawn = [];
        this.entities = this.entities.filter(ent => {
          if (ent.type !== 'citizen') return true;
          ent.age = (ent.age || 0) + 1;
          
          // Death check (starts at age 70)
          if (ent.age >= 70) {
            const deathChance = (ent.age - 70) * 0.05 + 0.02;
            if (Math.random() < deathChance) {
              if (this.world.chronicle) {
                this.world.chronicle.push(`[Chronicle] ${ent.name} (${ent.role}) passed away of old age at ${ent.age} in Year ${this.world.year}.`);
              }
              return false; // dies
            }
          }
          
          // Genetic mutation or inheritance check
          if (!ent.trait) {
            ent.trait = TRAITS[Math.floor(Math.random() * TRAITS.length)];
          }

          // Reproduction check (fertile age 20-45)
          if (ent.age >= 20 && ent.age <= 45 && Math.random() < 0.08) {
            const nameSuffix = ent.name.split(' ').pop() || '';
            const babyName = CITIZEN_NAMES[Math.floor(Math.random() * CITIZEN_NAMES.length)] + " " + nameSuffix;
            const roles = ["Gatherer", "Miner", "Builder", "Scout", "Trader"];
            const babyRole = roles[Math.floor(Math.random() * roles.length)];
            
            // Inherit trait (70% chance) or get new random trait
            const babyTrait = Math.random() < 0.7 ? ent.trait : TRAITS[Math.floor(Math.random() * TRAITS.length)];
            
            if (!ent.history) ent.history = [];
            ent.history.push(`Had a child named ${babyName} in Year ${this.world.year}`);
            
            kidsToSpawn.push({
              id: `${ent.id}-child-${Math.random()}`,
              type: 'citizen',
              name: babyName,
              role: babyRole,
              age: 0,
              parents: ent.name,
              generation: (ent.generation || 1) + 1,
              activityState: 'GATHERING',
              cargo: {},
              history: [`Born to ${ent.name} in Year ${this.world.year}`],
              hunger: 0,
              inventory: { gold: 0, food: 3, raw_materials: 0 },
              task: `Infant resting`,
              color: ent.color,
              trait: babyTrait,
              x: ent.homeX * ts + ts/2 + (Math.random() * 8 - 4),
              y: ent.homeY * ts + ts/2 + (Math.random() * 8 - 4),
              targetX: ent.homeX * ts + ts/2,
              targetY: ent.homeY * ts + ts/2,
              homeX: ent.homeX,
              homeY: ent.homeY,
              speed: (ent.speed || 0.35) * (babyTrait === 'Swiftfooted' ? 1.4 : 1.0),
              emoji: '🚶'
            });
          }
          return true;
        });
        
        kidsToSpawn.forEach(k => {
          this.entities.push(k);
          if (this.world.chronicle && Math.random() < 0.3) {
            this.world.chronicle.push(`[Chronicle] A baby named ${k.name} with trait [${k.trait}] was born to ${k.parents} (Gen ${k.generation})!`);
          }
        });
      }
      
      // Seed initial entities if empty
      if (this.entities.length === 0) {
        // Procedural citizen naming lists
        const CITIZEN_NAMES = ["Thorin", "Elara", "Alden", "Valen", "Kira", "Roran", "Lyra", "Sark", "Dara", "Joran"];
        const CITIZEN_ROLES = ["Gatherer", "Miner", "Builder", "Scout", "Trader"];

        // Roaming citizen traders/workers between cities or nearby cells
        this.world.factions.forEach(faction => {
          faction.settlements.forEach(s => {
            if (s.realm !== this.activeRealm) return;
            // Spawn 3 distinct simulated citizens per settlement
            for (let cIdx = 0; cIdx < 3; cIdx++) {
              const citizenName = CITIZEN_NAMES[Math.floor(Math.random() * CITIZEN_NAMES.length)] + " " + faction.name.substring(0, 4);
              const citizenRole = CITIZEN_ROLES[Math.floor(Math.random() * CITIZEN_ROLES.length)];
              
              if (cIdx === 0) {
                this.entities.push({
                  id: `${faction.name}-leader-${s.x}-${s.y}-${Math.random()}`,
                  type: 'leader',
                  name: `Royal Leader ${faction.name}`,
                  role: 'Kingdom Hero',
                  realm: this.activeRealm,
                  age: 25,
                  parents: "Royal Lineage",
                  generation: 1,
                  health: 500,
                  maxHealth: 500,
                  history: [`Ascended to the throne of ${faction.name} in Year 1`],
                  task: `Guarding Faction Center`,
                  color: faction.color,
                  x: s.x * ts + ts/2,
                  y: s.y * ts + ts/2,
                  targetX: s.x * ts + ts/2,
                  targetY: s.y * ts + ts/2,
                  homeX: s.x,
                  homeY: s.y,
                  speed: 0.6,
                  emoji: '👑'
                });
              }

              const TRAITS = ["Swiftfooted", "Giant Strength", "Sickly", "Intellectual", "Rugged"];
              const randomTrait = TRAITS[Math.floor(Math.random() * TRAITS.length)];
              const bSpeed = 0.35 + Math.random() * 0.25;

              this.entities.push({
                id: `${faction.name}-citizen-${s.x}-${s.y}-${cIdx}-${Math.random()}`,
                type: 'citizen',
                name: citizenName,
                role: citizenRole,
                realm: this.activeRealm,
                age: Math.floor(Math.random() * 30) + 15,
                parents: "Ancestors",
                generation: 1,
                activityState: 'GATHERING', // 'GATHERING' | 'RETURNING'
                cargo: {},
                history: [`Began career as a ${citizenRole} in Year 1`],
                hunger: Math.floor(Math.random() * 30), // Start with low hunger
                inventory: { gold: 0, food: 2, raw_materials: 0 },
                task: `Resting at ${s.name}`,
                color: faction.color,
                trait: randomTrait,
                tamedMount: null,
                x: s.x * ts + ts/2 + (Math.random() * 12 - 6),
                y: s.y * ts + ts/2 + (Math.random() * 12 - 6),
                targetX: s.x * ts + ts/2,
                targetY: s.y * ts + ts/2,
                homeX: s.x,
                homeY: s.y,
                speed: bSpeed * (randomTrait === 'Swiftfooted' ? 1.4 : 1.0),
                emoji: '🚶'
              });
            }
          });
        });

        // Add some random wild animals roaming in forest/plains biomes
        const maxAnimals = 15;
        let animalCount = 0;
        const centers = this.historicalState ? this.historicalState.discoveredCenters : (this.world.discoveredCenters || []);
        
        centers.forEach(c => {
          if (c.realm !== this.activeRealm || animalCount >= maxAnimals) return;
          const rad = Math.ceil(c.radius);
          for (let attempts = 0; attempts < 10; attempts++) {
            const rx = c.x + Math.floor(Math.random() * (rad * 2 + 1)) - rad;
            const ry = c.y + Math.floor(Math.random() * (rad * 2 + 1)) - rad;
            
            if (this.isCoordinateDiscovered(rx, ry)) {
              const cell = generateCell(rx, ry, this.activeRealm, this.world.seed);
              if (cell.biome !== 'ocean' && cell.biome !== 'mountain' && cell.biome !== 'void' && cell.biome !== 'void_space') {
                const isPegasus = this.activeRealm === 'aether';
                this.entities.push({
                  id: `animal-${rx}-${ry}-${Math.random()}`,
                  type: 'wildlife',
                  subType: isPegasus ? 'pegasus' : 'deer',
                  x: rx * ts + ts/2,
                  y: ry * ts + ts/2,
                  targetX: rx * ts + ts/2,
                  targetY: ry * ts + ts/2,
                  homeX: rx,
                  homeY: ry,
                  speed: 0.2 + Math.random() * 0.15,
                  emoji: isPegasus ? '🦄' : '🦌'
                });
                animalCount++;
                break;
              }
            }
          }
        });
      }

      // Dynamic space shuttle spawning (if starflight is researched)
      if (this.world && this.world.factions) {
        const hasStarflight = this.world.factions.some(f => f.technologies && f.technologies.includes('starflight'));
        if (this.activeRealm === 'space' || hasStarflight) {
          const shuttleCount = this.entities.filter(ent => ent.type === 'shuttle').length;
          if (shuttleCount < 3 && Math.random() < 0.05) {
            this.entities.push({
              id: `shuttle-${Math.random()}`,
              type: 'shuttle',
              emoji: Math.random() < 0.5 ? '🚀' : '🛸',
              x: Math.random() * this.canvas.width,
              y: Math.random() * this.canvas.height,
              targetX: Math.random() * this.canvas.width,
              targetY: Math.random() * this.canvas.height,
              speed: 1.5 + Math.random() * 1.0
            });
          }
        }
      }

      // Update entity movement towards their targets
      this.entities.forEach(ent => {
        if (ent.realm && ent.realm !== this.activeRealm) return;
        const dx = ent.targetX - ent.x;
        const dy = ent.targetY - ent.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 1.0) {
          // Arrived at destination chunk, perform meaningful action
          const cx = Math.floor(ent.x / ts);
          const cy = Math.floor(ent.y / ts);
          const key = `${this.activeRealm}:${cx},${cy}`;
          
          // Track traffic traversal for dynamic roads
          this.roadTraffic[key] = (this.roadTraffic[key] || 0) + 1;
          
          if (ent.type === 'citizen') {
            const faction = this.world.factions.find(f => f.name === ent.color || f.color === ent.color);
            
            // Portal Traversal Check
            const cell = generateCell(cx, cy, this.activeRealm, this.world.seed);
            const dynamicCell = this.world.modifiedCells[key];
            const ruin = dynamicCell ? dynamicCell.ruin : (cell ? cell.ruin : null);
            if (ruin && ruin.portalTarget && Math.random() < 0.22) {
              const target = ruin.portalTarget;
              if (!ent.history) ent.history = [];
              ent.history.push(`Traversed portal from ${this.activeRealm} to ${target.realm} [${target.x}, ${target.y}] in Year ${this.world.year}`);
              if (this.world.chronicle && Math.random() < 0.2) {
                this.world.chronicle.push(`[Portal] ${ent.name} stepped through the portal into ${target.realm} at [${target.x}, ${target.y}].`);
              }
              ent.realm = target.realm;
              ent.x = target.x * ts + ts/2;
              ent.y = target.y * ts + ts/2;
              ent.targetX = ent.x;
              ent.targetY = ent.y;
              ent.homeX = target.x;
              ent.homeY = target.y;
              if (window.synth) window.synth.playSwirl();
              return;
            }

            // Legendary Beast / Pegasus / Deer Domestication & Taming
            if ((ent.role === 'Scout' || ent.role === 'Soldier') && !ent.tamedMount) {
              const currentCellState = this.world.modifiedCells[key] || generateCell(cx, cy, this.activeRealm, this.world.seed);
              if (currentCellState.wildlife && currentCellState.wildlife.length > 0) {
                const wild = currentCellState.wildlife[0];
                if (Math.random() < 0.25) {
                  ent.tamedMount = wild.species;
                  ent.history.push(`Successfully tamed and mounted a wild ${wild.species} in Year ${this.world.year}`);
                  this.world.chronicle.push(`[Taming] AMAZING! ${ent.name} successfully tamed and mounted a wild ${wild.species} in ${this.activeRealm} at [${cx}, ${cy}]!`);
                  if (window.synth) window.synth.playAlliance();
                  
                  // Reduce wild population count
                  wild.count--;
                  if (wild.count <= 0) {
                    currentCellState.wildlife = currentCellState.wildlife.filter(w => w !== wild);
                  }
                  this.world.modifiedCells[key] = currentCellState;
                }
              }
            }

            // Plague infection checks
            const homeCell = getCell(this.world, ent.realm || this.activeRealm, ent.homeX, ent.homeY);
            const currentCell = getCell(this.world, ent.realm || this.activeRealm, cx, cy);
            
            // If home or current cell is plagued, citizen has 30% chance to catch it
            if ((homeCell.settlement && homeCell.settlement.plagued) || (currentCell.settlement && currentCell.settlement.plagued)) {
              if (Math.random() < 0.3) {
                ent.plagued = true;
              }
            }

            // Apothecary healing logic at home
            if (ent.plagued && homeCell.settlement && homeCell.settlement.apothecary) {
              ent.plagued = false;
              ent.task = "Cured by Apothecary";
            }

            // Plague stats drain
            if (ent.plagued) {
              ent.health = (ent.health || 100) - 2;
              ent.speed = (ent.speed || 0.35) * 0.6; // slow down
              if (Math.random() < 0.1) {
                this.particles.push({
                  x: ent.x + (Math.random() * 6 - 3),
                  y: ent.y + (Math.random() * 6 - 3),
                  vx: Math.random() * 0.5 - 0.25,
                  vy: Math.random() * -0.5,
                  size: 3,
                  color: 'rgba(34, 197, 94, ', // green plague particles
                  life: 0.8
                });
              }
            }

            // Peasant rebellion strike behavior: refuse to work
            if (homeCell.settlement && homeCell.settlement.rebellionActive) {
              ent.task = "✊ Protesting Regime!";
              ent.activityState = 'GATHERING';
              ent.cargo = {};
              ent.speed = (ent.speed || 0.35) * 0.7;
            }

            // Harbor Port Warship boarding check
            const hasHarbor = homeCell.settlement && homeCell.settlement.harbor;
            if (hasHarbor && (currentCell.biome === 'ocean' || currentCell.biome === 'coast')) {
              ent.onWarship = true;
              ent.task = "🚢 Sailing Warship";
            } else {
              ent.onWarship = false;
            }

            // Bio-Lab mutation upgrades
            if (cx === ent.homeX && cy === ent.homeY && homeCell.settlement && homeCell.settlement.biolab && Math.random() < 0.15) {
              const TRAITS = ["Swiftfooted", "Giant Strength", "Sickly", "Intellectual", "Rugged"];
              if (ent.trait === 'Sickly') {
                ent.trait = 'Rugged'; // Cure sickly to rugged
                ent.history.push(`Bio-Lab mutagen therapy mutated trait to Rugged in Year ${this.world.year}`);
              }
            }

            // Tool and Weapon Crafting at home
            if (cx === ent.homeX && cy === ent.homeY && faction && !ent.plagued) {
              if (!ent.equipped) {
                if (faction.resources.gold >= 15 && faction.resources.iron >= 5 && Math.random() < 0.2) {
                  faction.resources.gold -= 15;
                  faction.resources.iron -= 5;
                  const roll = Math.random();
                  if (roll < 0.33) {
                    ent.equipped = 'Sword';
                    ent.history.push(`Crafted a steel sword for combat in Year ${this.world.year}`);
                  } else if (roll < 0.66) {
                    ent.equipped = 'Pickaxe';
                    ent.history.push(`Crafted a reinforced pickaxe for mining in Year ${this.world.year}`);
                  } else {
                    ent.equipped = 'Axe';
                    ent.history.push(`Crafted a lumberjack axe for forestry in Year ${this.world.year}`);
                  }
                }
              }
            }

            // Increment hunger points
            ent.hunger = (ent.hunger || 0) + 12;
            
            // Manage Cargo Gathering & Returning states
            if (!ent.cargo) ent.cargo = {};
            
            if (ent.activityState === 'RETURNING') {
              // Deposit gathered resources to Faction reserves
              if (!ent.history) ent.history = [];
              const cargoKeys = Object.keys(ent.cargo || {});
              if (cargoKeys.length > 0) {
                ent.history.push(`Deposited cargo [${cargoKeys.map(k => `${k}:${ent.cargo[k]}`).join(', ')}] in Year ${this.world.year}`);
              }
              Object.keys(ent.cargo).forEach(res => {
                if (faction) {
                  let multiplier = 1;
                  if (res === 'wood' && ent.equipped === 'Axe') multiplier = 2; // double wood
                  if ((res === 'iron' || res === 'gold') && ent.equipped === 'Pickaxe') multiplier = 2; // double mining
                  faction.resources[res] = (faction.resources[res] || 0) + ent.cargo[res] * multiplier;
                }
              });
              ent.cargo = {};
              ent.activityState = 'GATHERING';
              ent.task = "Deposited cargo, resting";
              
              if (faction) faction.resources.gold = (faction.resources.gold || 0) + 2;
            } else {
              // We are gathering
              const cell = generateCell(cx, cy, this.activeRealm, this.world.seed);
              let gatheredType = null;
              if (cell.biome.includes('forest')) {
                gatheredType = 'wood';
              } else if (cell.resources && cell.resources.length > 0) {
                gatheredType = cell.resources[0];
              }
              
              if (gatheredType) {
                ent.cargo[gatheredType] = (ent.cargo[gatheredType] || 0) + 1;
                ent.task = `Harvested ${gatheredType}`;
              } else {
                ent.task = "Patrolling Region";
              }
              
              // Capacity limits based on technology level
              let capacity = 3;
              if (faction && faction.technologies) {
                if (faction.technologies.includes('starflight')) capacity = 25;
                else if (faction.technologies.includes('steam_engine')) capacity = 15;
                else if (faction.technologies.includes('carriage_vehicles')) capacity = 8;
              }
              
              const totalCargo = Object.values(ent.cargo).reduce((a, b) => a + b, 0);
              if (totalCargo >= capacity) {
                ent.activityState = 'RETURNING';
                ent.task = "Hauling cargo home";
                ent.targetX = ent.homeX * ts + ts/2;
                ent.targetY = ent.homeY * ts + ts/2;
              }
            }

            // Citizen consumes food if hungry
            if (ent.hunger >= 65) {
              if (faction && faction.resources.gold >= 5) {
                // Buy food from faction reserve
                ent.hunger = 0;
                faction.resources.gold = Math.max(0, faction.resources.gold - 5);
                ent.task = "Eating Rations";
              } else {
                // Starving state
                ent.task = "Starving / Foraging";
                ent.hunger = 40; // temporary foraging drop
              }
            }

            if (faction) {
              faction.resources.gold = (faction.resources.gold || 0) + 1;
            }
          } else if (ent.type === 'wildlife') {
            // Animals slightly graze and modify vegetation density
            const cell = this.world.modifiedCells[key] || generateCell(cx, cy, this.activeRealm, this.world.seed);
            if (cell.vegetation > 0.1) {
              cell.vegetation = Math.max(0.05, cell.vegetation - 0.03);
              this.world.modifiedCells[key] = cell; // Save modifications
            }
          }

          if (ent.type === 'shuttle') {
            ent.targetX = Math.random() * (this.canvas ? this.canvas.width : 800);
            ent.targetY = Math.random() * (this.canvas ? this.canvas.height : 600);
          } else if (ent.type === 'citizen' && ent.activityState === 'RETURNING') {
            ent.targetX = ent.homeX * ts + ts/2;
            ent.targetY = ent.homeY * ts + ts/2;
          } else {
            // Choose a new nearby coordinate target to wander to
            const range = 3; // wandered chunk offset range
            const nextCx = ent.homeX + Math.floor(Math.random() * (range * 2 + 1)) - range;
            const nextCy = ent.homeY + Math.floor(Math.random() * (range * 2 + 1)) - range;

            if (this.isCoordinateDiscovered(nextCx, nextCy)) {
              const cell = generateCell(nextCx, nextCy, this.activeRealm, this.world.seed);
              const faction = this.world.factions.find(f => f.name === ent.color || f.color === ent.color);
              const canSail = faction && faction.technologies && faction.technologies.includes('sailing_boats');

              // Allow moving into ocean/coast if they have boat tech
              const isValidLand = cell.biome !== 'ocean' && cell.biome !== 'mountain' && cell.biome !== 'void' && cell.biome !== 'void_space';
              const isValidWater = canSail && (cell.biome === 'ocean' || cell.biome === 'coast');

              if (isValidLand || isValidWater) {
                ent.targetX = nextCx * ts + Math.random() * (ts - 6) + 3;
                ent.targetY = nextCy * ts + Math.random() * (ts - 6) + 3;
              }
            }
          }
        } else {
          // Move towards target
          ent.x += (dx / dist) * ent.speed;
          ent.y += (dy / dist) * ent.speed;
        }
      });

      // Combat Resolution Check
      this.entities.forEach(ent1 => {
        if (ent1.type !== 'citizen' && ent1.type !== 'leader') return;
        this.entities.forEach(ent2 => {
          if ((ent2.type !== 'citizen' && ent2.type !== 'leader') || ent1.id === ent2.id) return;
          if (ent1.color !== ent2.color) {
            const dist = Math.hypot(ent1.x - ent2.x, ent1.y - ent2.y);
            if (dist < 12.0) {
              // Calculate leader aura boosts
              const ent1HasLeaderAura = this.entities.some(e => e.type === 'leader' && e.color === ent1.color && Math.hypot(e.x - ent1.x, e.y - ent1.y) < 60);
              const ent2HasLeaderAura = this.entities.some(e => e.type === 'leader' && e.color === ent2.color && Math.hypot(e.x - ent2.x, e.y - ent2.y) < 60);
              
              let ent1Dmg = 5;
              let ent2Dmg = 5;

              // Weapon multipliers
              if (ent1.equipped === 'Sword') ent1Dmg *= 2.0;
              if (ent2.equipped === 'Sword') ent2Dmg *= 2.0;

              // Tamed mount multipliers
              if (ent1.tamedMount === 'legendary_beast') ent1Dmg *= 2.5;
              else if (ent1.tamedMount === 'pegasus') ent1Dmg *= 1.5;
              if (ent2.tamedMount === 'legendary_beast') ent2Dmg *= 2.5;
              else if (ent2.tamedMount === 'pegasus') ent2Dmg *= 1.5;

              // Leader aura multipliers (+50% combat efficiency / reduction in received damage)
              if (ent1HasLeaderAura) ent2Dmg *= 1.5;
              if (ent2HasLeaderAura) ent1Dmg *= 1.5;

              ent1.health = (ent1.health || 100) - ent2Dmg;
              ent2.health = (ent2.health || 100) - ent1Dmg;
              ent1.task = "Battling rival!";
              ent2.task = "Battling rival!";
              
              if (!ent1.history) ent1.history = [];
              if (!ent1.history.includes("Engaged in skirmish")) {
                ent1.history.push(`Engaged in combat against ${ent2.name} in Year ${this.world.year}`);
              }
              
              if (Math.random() < 0.25) {
                this.particles.push({
                  x: (ent1.x + ent2.x)/2 + (Math.random()*6-3),
                  y: (ent1.y + ent2.y)/2 + (Math.random()*6-3),
                  vx: Math.random()*2-1,
                  vy: Math.random()*2-1,
                  size: 2,
                  color: 'rgba(239, 68, 68, ',
                  life: 0.8
                });
              }
            }
          }
        });
      });

      // Filter dead entities and log slain events
      this.entities = this.entities.filter(ent => {
        if ((ent.type === 'citizen' || ent.type === 'leader') && (ent.health || 100) <= 0) {
          if (this.world.chronicle) {
            const cx = Math.floor(ent.x / ts);
            const cy = Math.floor(ent.y / ts);
            const typeLabel = ent.type === 'leader' ? 'Royal Leader' : 'Citizen';
            this.world.chronicle.push(`[War] ${typeLabel} ${ent.name} was slain in battle at [${cx}, ${cy}] in Year ${this.world.year}.`);
            if (window.synth) window.synth.playSwirl();
          }
          return false;
        }
        return true;
      });
    }
  }

  // Draw visible grid
  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.world) return;

    this.ctx.save();
    this.ctx.translate(this.panX, this.panY);
    this.ctx.scale(this.zoom, this.zoom);

    const ts = this.tileSize;

    // Calculate currently visible viewport coordinate range
    const startX = Math.floor(-this.panX / (this.zoom * ts)) - 1;
    const endX = Math.ceil((this.canvas.width - this.panX) / (this.zoom * ts)) + 1;
    const startY = Math.floor(-this.panY / (this.zoom * ts)) - 1;
    const endY = Math.ceil((this.canvas.height - this.panY) / (this.zoom * ts)) + 1;

    // 1. Draw biomes / bases
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        this.drawCell(x, y, x * ts, y * ts, ts);
      }
    }

    // 1.5. Draw dynamic citizen-worn roads/paths
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const roadKey = `${this.activeRealm}:${x},${y}`;
        const traffic = this.roadTraffic[roadKey] || 0;
        if (traffic > 0 && this.isCoordinateDiscovered(x, y)) {
          const intensity = Math.min(0.65, traffic * 0.09);
          this.ctx.fillStyle = `rgba(139, 90, 43, ${intensity})`; // Dirt path brown
          this.ctx.fillRect(x * ts + ts/4, y * ts + ts/4, ts/2, ts/2);
        }
      }
    }

    // 2. Draw Trade routes if on Overworld
    if (this.activeRealm === REALMS.OVERWORLD) {
      this.drawTradeRoutes(ts);
    }

    // 3. Draw structures, portals, overlays
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        this.drawCellOverlay(x, y, x * ts, y * ts, ts);
      }
    }

    // 4. Draw focus brackets
    if (this.selectedCell && !this.selectedCell.undiscovered) {
      this.ctx.strokeStyle = '#dfb15b';
      this.ctx.lineWidth = 2.5;
      this.ctx.strokeRect(this.selectedCell.x * ts, this.selectedCell.y * ts, ts, ts);
    }

    if (this.hoveredCell && this.hoveredCell !== this.selectedCell && !this.hoveredCell.undiscovered) {
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(this.hoveredCell.x * ts, this.hoveredCell.y * ts, ts, ts);
    }

    // 5. Draw fires
    this.particles.forEach(p => {
      this.ctx.fillStyle = p.color + p.life + ')';
      this.ctx.fillRect(p.x, p.y, p.size, p.size);
    });

    // 5.5 Draw moving citizens and animals
    this.entities.forEach(ent => {
      // Reconstruct chunk coordinates
      const cx = Math.floor(ent.x / ts);
      const cy = Math.floor(ent.y / ts);
      if (!this.isCoordinateDiscovered(cx, cy)) return;

      this.ctx.save();
      if (ent.type === 'citizen') {
        // Reconstruct tech-based vehicle emoji representation
        const faction = this.world.factions.find(f => f.name === ent.color || f.color === ent.color);
        let vehicleEmoji = '🚶';
        let vehicleSpeed = 0.35;
        if (ent.onWarship) {
          vehicleEmoji = ent.role === 'Soldier' ? '🏴‍☠️' : '🚢';
          vehicleSpeed = 0.75;
        } else if (faction && faction.technologies) {
          if (faction.technologies.includes('starflight')) {
            vehicleEmoji = '🚀';
            vehicleSpeed = 1.2;
          } else if (faction.technologies.includes('steam_engine')) {
            vehicleEmoji = '🚗';
            vehicleSpeed = 0.85;
          } else if (faction.technologies.includes('carriage_vehicles')) {
            vehicleEmoji = '🐎';
            vehicleSpeed = 0.6;
          } else if (faction.technologies.includes('sailing_boats')) {
            // Use boat if currently on coast or ocean
            const cell = generateCell(cx, cy, this.activeRealm, this.world.seed);
            if (cell.biome === 'ocean' || cell.biome === 'coast') {
              vehicleEmoji = '⛵';
              vehicleSpeed = 0.5;
            }
          }
        }
        if (ent.emoji && ent.emoji !== vehicleEmoji) {
          if (!ent.history) ent.history = [];
          ent.history.push(`Upgraded transportation vehicle to ${vehicleEmoji} in Year ${this.world.year}`);
        }
        ent.emoji = vehicleEmoji;
        ent.speed = vehicleSpeed;

        // Draw colored dot with citizen/trader label when zoomed in
        this.ctx.fillStyle = ent.color;
        this.ctx.beginPath();
        this.ctx.arc(ent.x, ent.y, this.zoom >= 2.0 ? 3 : 2, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 0.5;
        this.ctx.stroke();

        if (this.zoom >= 2.5) {
          this.ctx.fillStyle = '#ffffff';
          this.ctx.font = '5px sans-serif';
          this.ctx.textAlign = 'center';
          const mountEmoji = ent.tamedMount === 'legendary_beast' ? '🐉' : (ent.tamedMount === 'pegasus' ? '🦄' : (ent.tamedMount === 'deer' ? '🦌' : ''));
          const displayLabel = mountEmoji ? `${ent.emoji}${mountEmoji}` : ent.emoji;
          this.ctx.fillText(displayLabel, ent.x, ent.y - 4);
        }
      } else if (ent.type === 'shuttle') {
        // Space Shuttle flying
        this.ctx.fillStyle = '#60a5fa';
        this.ctx.font = '12px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(ent.emoji || '🚀', ent.x, ent.y + 4);
      } else {
        // Wildlife animals roaming
        if (this.zoom >= 2.0) {
          this.ctx.fillStyle = '#ffffff';
          this.ctx.font = '8px sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(ent.emoji, ent.x, ent.y + 3);
        } else {
          this.ctx.fillStyle = ent.subType === 'pegasus' ? '#38bdf8' : '#a78bfa';
          this.ctx.beginPath();
          this.ctx.arc(ent.x, ent.y, 1.5, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
      this.ctx.restore();
    });

    this.ctx.restore();

    // 6. Draw Atmosphere overlay (screen-space weather elements)
    this.drawAtmosphere();

    // 7. Draw Minimap overlay
    this.drawMinimap();
  }

  drawAtmosphere() {
    this.ctx.save();
    this.atmosphericParticles.forEach(p => {
      if (this.activeRealm === 'overworld') {
        // Soft green drifting leaves
        this.ctx.fillStyle = `rgba(34, 197, 94, ${p.life * 0.45})`;
        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate(p.angle);
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, p.size * 1.5, p.size * 0.8, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      } else if (this.activeRealm === 'underworld') {
        // Reddish cavern embers / steam
        this.ctx.fillStyle = `rgba(239, 68, 68, ${p.life * 0.35})`;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size * 0.8, 0, Math.PI * 2);
        this.ctx.fill();
      } else if (this.activeRealm === 'aether') {
        // Fluffy light blue sky clouds
        this.ctx.fillStyle = `rgba(255, 255, 255, ${p.life * 0.15})`;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
        this.ctx.arc(p.x + p.size * 2, p.y, p.size * 3, 0, Math.PI * 2);
        this.ctx.arc(p.x - p.size * 2, p.y, p.size * 3, 0, Math.PI * 2);
        this.ctx.fill();
      } else if (this.activeRealm === 'space') {
        // Drifting space stardust
        this.ctx.fillStyle = `rgba(255, 255, 255, ${p.life * 0.75})`;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
    });
    this.ctx.restore();
  }

  drawMinimap() {
    const size = 120;
    const padding = 15;
    const x = this.canvas.width - size - padding;
    const y = padding;

    const ctx = this.ctx;
    ctx.save();

    // Map frame background
    ctx.fillStyle = 'rgba(15, 17, 26, 0.85)';
    ctx.strokeStyle = '#dfb15b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 8);
    ctx.fill();
    ctx.stroke();

    // Radar grids
    ctx.strokeStyle = 'rgba(223, 177, 91, 0.2)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2.5, 0, Math.PI * 2);
    ctx.arc(x + size / 2, y + size / 2, size / 5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + size / 2, y);
    ctx.lineTo(x + size / 2, y + size);
    ctx.moveTo(x, y + size / 2);
    ctx.lineTo(x + size, y + size / 2);
    ctx.stroke();

    // Plot discovered centers inside the radar space
    const centers = this.historicalState ? this.historicalState.discoveredCenters : (this.world ? this.world.discoveredCenters : []);
    if (centers && centers.length > 0) {
      // Find bounding limits for centers to center the map viewport appropriately
      let minCx = Infinity, maxCx = -Infinity, minCy = Infinity, maxCy = -Infinity;
      const relevant = centers.filter(c => c.realm === this.activeRealm);
      
      if (relevant.length > 0) {
        relevant.forEach(c => {
          if (c.x < minCx) minCx = c.x;
          if (c.x > maxCx) maxCx = c.x;
          if (c.y < minCy) minCy = c.y;
          if (c.y > maxCy) maxCy = c.y;
        });

        const spanX = Math.max(1, maxCx - minCx);
        const spanY = Math.max(1, maxCy - minCy);
        const maxSpan = Math.max(spanX, spanY, 20);

        const midX = (minCx + maxCx) / 2;
        const midY = (minCy + maxCy) / 2;

        ctx.fillStyle = 'rgba(16, 185, 129, 0.4)';
        relevant.forEach(c => {
          // Map to local minimap coordinates
          const mapLocX = x + size/2 + ((c.x - midX) / maxSpan) * (size - 20);
          const mapLocY = y + size/2 + ((c.y - midY) / maxSpan) * (size - 20);
          const drawRadius = Math.max(2, (c.radius / maxSpan) * (size - 20));

          ctx.beginPath();
          ctx.arc(mapLocX, mapLocY, drawRadius, 0, Math.PI * 2);
          ctx.fill();
        });

        // Draw camera position indicator
        // Reconstruct map coordinates of the camera viewport center
        const camX = (this.canvas.width / 2 - this.panX) / (this.zoom * this.tileSize);
        const camY = (this.canvas.height / 2 - this.panY) / (this.zoom * this.tileSize);

        const camLocX = x + size/2 + ((camX - midX) / maxSpan) * (size - 20);
        const camLocY = y + size/2 + ((camY - midY) / maxSpan) * (size - 20);

        if (camLocX >= x + 2 && camLocX <= x + size - 2 && camLocY >= y + 2 && camLocY <= y + size - 2) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(camLocX, camLocY, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(camLocX, camLocY, 6, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }

  // Draw procedural biome cell
  drawCell(x, y, cx, cy, ts) {
    if (!this.isCoordinateDiscovered(x, y)) {
      // Undiscovered cell: cover with Realm-specific Fog of War
      const fowColor = FOW_COLORS[this.activeRealm] || '#050505';
      this.ctx.fillStyle = fowColor;
      this.ctx.fillRect(cx, cy, ts, ts);
      return;
    }

    const baseCell = generateCell(x, y, this.activeRealm, this.world.seed);
    const key = `${this.activeRealm}:${x},${y}`;
    const dynamicCell = this.world && this.world.modifiedCells[key];
    let biome = dynamicCell ? dynamicCell.biome : baseCell.biome;
    let factionIdx = -1;

    // Load overlays from dynamic cell registry
    if (this.historicalState) {
      const cells = this.historicalState.mapState.modifiedCells || [];
      const keyCell = cells.find(c => c.r === this.activeRealm && c.x === x && c.y === y);
      if (keyCell && keyCell.f) {
        factionIdx = keyCell.f === 'Players' ? 4 : this.world.factions.findIndex(f => f.name === keyCell.f);
      }
    } else {
      const key = `${this.activeRealm}:${x},${y}`;
      const cell = this.world.modifiedCells[key];
      if (cell && cell.settlement) {
        factionIdx = this.world.factions.findIndex(f => f.name === cell.settlement.faction);
        if (factionIdx === -1 && cell.settlement.faction === 'Players') factionIdx = 4;
      }
    }

    let color = (REALM_BIOME_COLORS[this.activeRealm] && REALM_BIOME_COLORS[this.activeRealm][biome]) || '#111115';

    // Ocean waves ripple
    if (biome === 'ocean' || biome === 'coast' || biome === 'void_space' || biome === 'void') {
      const ripple = Math.sin(this.animTime + (x * 0.15) + (y * 0.08)) * 3;
      if (ripple > 1.8) {
        color = biome === 'ocean' ? '#111b2d' : (biome === 'coast' ? '#203957' : '#07070b');
      }
    }

    if (this.viewMode === 'factions') {
      if (factionIdx !== -1) {
        const hex = FACTION_COLORS[factionIdx] || '#ef4444';
        color = this.hexToRgba(hex, 0.4);
      } else {
        color = '#111216';
      }
    } else if (this.viewMode === 'wildlife') {
      let count = baseCell.wildlife.reduce((sum, w) => sum + w.count, 0);
      if (count > 0) {
        const intensity = Math.min(255, Math.floor((count / 40) * 150) + 50);
        color = `rgb(16, ${intensity}, 80)`;
      } else {
        color = '#111216';
      }
    } else if (this.viewMode === 'temperature') {
      const temp = baseCell.temperature;
      const r = Math.floor(temp * 220);
      const b = Math.floor((1 - temp) * 220);
      color = `rgb(${r}, 40, ${b})`;
    }

    this.ctx.fillStyle = color;
    this.ctx.fillRect(cx, cy, ts, ts);

    // Draw micro detailed view overlay when zoomed in
    if (this.zoom >= 2.2) {
      this.ctx.save();
      
      // Draw grid line borders for individual tiles at high zoom
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      this.ctx.lineWidth = 0.5;
      this.ctx.strokeRect(cx, cy, ts, ts);

      // Micro environment symbols inside the chunk
      if (biome === 'forest' || biome === 'mushroom_forest' || biome === 'starlight_woods') {
        this.ctx.fillStyle = biome === 'mushroom_forest' ? '#10b981' : (biome === 'starlight_woods' ? '#38bdf8' : '#15803d');
        // Render three micro trees/mushrooms inside the tile
        this.ctx.font = `${ts / 3.5}px sans-serif`;
        this.ctx.fillText(biome === 'mushroom_forest' ? '🍄' : '🌲', cx + 2, cy + ts/2);
        this.ctx.fillText(biome === 'mushroom_forest' ? '🍄' : '🌲', cx + ts/2, cy + ts - 2);
        this.ctx.fillText(biome === 'mushroom_forest' ? '🍄' : '🌲', cx + ts - 8, cy + ts/2 + 2);
      } else if (biome === 'mountain' || biome === 'storm_peaks') {
        this.ctx.fillStyle = '#64748b';
        this.ctx.beginPath();
        this.ctx.moveTo(cx + ts/4, cy + ts - 2);
        this.ctx.lineTo(cx + ts/2, cy + ts/3);
        this.ctx.lineTo(cx + 3*ts/4, cy + ts - 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#94a3b8';
        this.ctx.beginPath();
        this.ctx.moveTo(cx + ts/2, cy + ts - 2);
        this.ctx.lineTo(cx + 3*ts/5, cy + ts/2);
        this.ctx.lineTo(cx + 4*ts/5, cy + ts - 2);
        this.ctx.fill();
      }

      // Render mini resource sparkles
      if (baseCell.resources && baseCell.resources.length > 0) {
        this.ctx.fillStyle = baseCell.resources.includes('gold') ? '#f59e0b' : (baseCell.resources.includes('stardust') || baseCell.resources.includes('starmetal') ? '#38bdf8' : '#94a3b8');
        this.ctx.font = `${ts / 4}px sans-serif`;
        this.ctx.fillText('✨', cx + ts - 8, cy + 8);
      }

      // Render micro population dots if settlement present
      let sSize = 0;
      if (this.historicalState) {
        const cells = this.historicalState.mapState.modifiedCells || [];
        const keyCell = cells.find(c => c.r === this.activeRealm && c.x === x && c.y === y);
        if (keyCell && keyCell.f) sSize = keyCell.s;
      } else {
        const key = `${this.activeRealm}:${x},${y}`;
        const cell = this.world.modifiedCells[key];
        if (cell && cell.settlement) sSize = cell.settlement.size;
      }

      if (sSize > 0) {
        const numDots = Math.min(6, Math.ceil(sSize / 150));
        this.ctx.fillStyle = '#ffffff';
        for (let idx = 0; idx < numDots; idx++) {
          const dx = cx + 4 + (idx % 3) * (ts / 4);
          const dy = cy + ts - 8 - Math.floor(idx / 3) * (ts / 4);
          this.ctx.beginPath();
          this.ctx.arc(dx, dy, 1.2, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }

      this.ctx.restore();
    } else {
      this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
      this.ctx.lineWidth = 0.5;
      this.ctx.strokeRect(cx, cy, ts, ts);
    }
  }

  // Draw overlay structures (castles, portals, fires)
  drawCellOverlay(x, y, cx, cy, ts) {
    if (!this.isCoordinateDiscovered(x, y)) return;

    const ctx = this.ctx;
    
    // Fetch state
    let hasSettlement = false;
    let factionIdx = -1;
    let type = '';
    let ruin = null;
    let isFire = false;
    let hasBeast = false;
    let hasSeaMonster = false;
    let isPlagued = false;
    let hasApothecary = false;
    let wonderBlueprint = null;

    let hasHarbor = false;
    let hasBioLab = false;
    let hasStrike = false;
    let hasShield = false;
    let hasDome = false;

    if (this.historicalState) {
      const cells = this.historicalState.mapState.modifiedCells || [];
      const keyCell = cells.find(c => c.r === this.activeRealm && c.x === x && c.y === y);
      if (keyCell) {
        hasSettlement = keyCell.f !== null;
        if (hasSettlement) {
          factionIdx = keyCell.f === 'Players' ? 4 : this.world.factions.findIndex(f => f.name === keyCell.f);
          type = keyCell.t;
        }
        ruin = keyCell.ruin;
        isFire = keyCell.fire;
      }
    } else {
      const key = `${this.activeRealm}:${x},${y}`;
      const cell = this.world.modifiedCells[key];
      if (cell) {
        hasSettlement = cell.settlement !== null;
        if (hasSettlement) {
          factionIdx = this.world.factions.findIndex(f => f.name === cell.settlement.faction);
          if (factionIdx === -1 && cell.settlement.faction === 'Players') factionIdx = 4;
          type = cell.settlement.type;
          isPlagued = cell.settlement.plagued;
          hasApothecary = cell.settlement.apothecary;
          wonderBlueprint = cell.settlement.wonderBlueprint;
          hasHarbor = cell.settlement.harbor;
          hasBioLab = cell.settlement.biolab;
          hasStrike = cell.settlement.rebellionActive;
          hasShield = cell.settlement.shielded;
          hasDome = cell.settlement.dome;
        }
        ruin = cell.ruin;
        isFire = cell.fireTicksLeft > 0;
        hasBeast = cell.wildlife && cell.wildlife.some(w => w.species === 'legendary_beast');
        hasSeaMonster = cell.wildlife && cell.wildlife.some(w => w.species === 'sea_monster');
      }
    }

    // 1. Draw wildfire overlay
    if (isFire) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.65)';
      ctx.fillRect(cx, cy, ts, ts);
      ctx.font = '10px sans-serif';
      ctx.fillText('🔥', cx + 4, cy + ts - 6);
      return;
    }

    // 2. Draw Portal Ruin Vortex
    if (ruin && ruin.portalTarget) {
      // Swirling portal color animation
      ctx.fillStyle = this.activeRealm === 'overworld' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)';
      ctx.fillRect(cx, cy, ts, ts);

      ctx.save();
      ctx.translate(cx + ts/2, cy + ts/2);
      ctx.rotate(this.animTime * 1.5);
      
      // Draw swirling portal oval
      ctx.strokeStyle = this.activeRealm === 'overworld' ? '#8b5cf6' : '#10b981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-2, -2, 4, 4); // Core spark
      ctx.restore();
      return;
    }

    // 3. Draw standard ruins
    if (ruin) {
      ctx.strokeStyle = '#dfb15b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx + ts/2, cy + ts - 4, 6, Math.PI, 0, false);
      ctx.stroke();
      ctx.fillStyle = '#dfb15b';
      ctx.fillRect(cx + ts/2 - 7, cy + ts - 7, 2, 4);
      ctx.fillRect(cx + ts/2 + 5, cy + ts - 7, 2, 4);
      return;
    }

    // 4. Draw Settlement buildings
    if (hasSettlement) {
      const fColor = FACTION_COLORS[factionIdx] || '#ef4444';
      ctx.fillStyle = fColor;
      const isCapital = type === 'capital';

      if (isCapital) {
        ctx.fillRect(cx + 4, cy + ts - 15, 5, 11);
        ctx.fillRect(cx + ts - 9, cy + ts - 15, 5, 11);
        ctx.fillRect(cx + 9, cy + ts - 11, ts - 18, 7);
      } else {
        ctx.beginPath();
        ctx.moveTo(cx + ts/2, cy + 5);
        ctx.lineTo(cx + 4, cy + 13);
        ctx.lineTo(cx + ts - 4, cy + 13);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(cx + 6, cy + 13, ts - 12, ts - 18);
      }

      // Render Apothecary overlay
      if (hasApothecary) {
        ctx.fillStyle = '#10b981';
        ctx.font = '8px sans-serif';
        ctx.fillText('🏥', cx + 2, cy + 9);
      }

      // Render Harbor Port
      if (hasHarbor) {
        ctx.fillStyle = '#38bdf8';
        ctx.font = '8px sans-serif';
        ctx.fillText('⚓', cx + ts - 9, cy + 9);
      }

      // Render Bio-Lab
      if (hasBioLab) {
        ctx.fillStyle = '#a78bfa';
        ctx.font = '8px sans-serif';
        ctx.fillText('🧪', cx + 2, cy + ts - 2);
      }

      // Render Peasant Strike Active (red outline / strike sign)
      if (hasStrike) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cx, cy, ts, ts);
        ctx.fillStyle = '#ef4444';
        ctx.font = '9px sans-serif';
        ctx.fillText('✊', cx + ts/2 - 4, cy + ts/2 + 3);
      }

      // Render Shield overlay (blue circle outlining settlement)
      if (hasShield) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx + ts/2, cy + ts/2, ts/2 - 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Render Life Support Dome overlay (light blue dome shape overlay)
      if (hasDome) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.beginPath();
        ctx.arc(cx + ts/2, cy + ts/2, ts/2 - 1, Math.PI, 0, false);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.0;
        ctx.stroke();
      }

      // Render Wonder blueprint / Completed Wonder overlay
      if (wonderBlueprint) {
        if (wonderBlueprint.progress < 100) {
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.strokeRect(cx + 1, cy + 1, ts - 2, ts - 2);
          ctx.setLineDash([]);
          ctx.fillStyle = '#eab308';
          ctx.font = '6px sans-serif';
          ctx.fillText(`🚧${wonderBlueprint.progress}%`, cx + ts/2 - 8, cy + 9);
        } else {
          ctx.fillStyle = '#fbbf24';
          ctx.font = '10px sans-serif';
          ctx.fillText('🏛️', cx + ts/2 - 5, cy + ts - 4);
        }
      }

      // Render Plague sickness overlay
      if (isPlagued) {
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx, cy, ts, ts);
        ctx.fillStyle = '#22c55e';
        ctx.font = '9px sans-serif';
        ctx.fillText('🤢', cx + ts - 10, cy + ts - 2);
      }

      // Spaceport overlay if faction has starflight tech
      const faction = factionIdx !== -1 ? this.world.factions[factionIdx] : null;
      if (faction && faction.technologies && faction.technologies.includes('starflight')) {
        ctx.fillStyle = '#60a5fa';
        ctx.font = '8px sans-serif';
        ctx.fillText('🛰️', cx + ts - 10, cy + 10);
      }

      // Builder scaffolding overlay
      const hasBuilder = this.entities.some(e => e.type === 'citizen' && e.role === 'Builder' && Math.floor(e.x / ts) === x && Math.floor(e.y / ts) === y && e.realm === this.activeRealm);
      if (hasBuilder) {
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx + 2, cy + 2, ts - 4, ts - 4);
        ctx.fillStyle = '#f97316';
        ctx.font = '8px sans-serif';
        ctx.fillText('🏗️', cx + 2, cy + 9);

        // Active Builder contributes to Wonder Blueprint progress if present
        if (wonderBlueprint && wonderBlueprint.progress < 100 && faction && Math.random() < 0.15) {
          if (faction.resources.wood >= 1 && faction.resources.iron >= 1) {
            faction.resources.wood -= 1;
            faction.resources.iron -= 1;
            wonderBlueprint.progress = Math.min(100, wonderBlueprint.progress + 5);
            if (wonderBlueprint.progress === 100) {
              this.world.chronicle.push(`[Wonder] MEGASTRUCTURE COMPLETED! Faction ${faction.name} finished construction of the Monumental Wonder at [${x}, ${y}] in ${this.activeRealm}!`);
              if (window.synth) window.synth.playBell();
            }
          }
        }
      }
    }

    // 5. Draw legendary beast
    if (hasBeast) {
      ctx.fillStyle = '#ef4444';
      ctx.font = '13px sans-serif';
      ctx.fillText('🐉', cx + 4, cy + ts - 5);
    }

    // 6. Draw sea monster
    if (hasSeaMonster) {
      ctx.fillStyle = '#3b82f6';
      ctx.font = '13px sans-serif';
      ctx.fillText('🦑', cx + 4, cy + ts - 5);
    }
  }

  // Draw Trade lines and roads
  drawTradeRoutes(ts) {
    const routes = this.historicalState ? this.historicalState.mapState.tradeRoutes : (this.world.tradeRoutes || []);
    if (routes.length === 0) return;

    this.ctx.save();
    
    // Step 1: Draw solid cobblestone roads underneath trade paths
    this.ctx.strokeStyle = '#3f3f46';
    this.ctx.lineWidth = 3.5;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    routes.forEach(route => {
      this.ctx.beginPath();
      this.ctx.moveTo(route.from.x * ts + ts/2, route.from.y * ts + ts/2);
      this.ctx.lineTo(route.to.x * ts + ts/2, route.to.y * ts + ts/2);
      this.ctx.stroke();
    });

    // Step 2: Overlay golden trade route markers
    this.ctx.strokeStyle = 'rgba(223, 177, 91, 0.75)';
    this.ctx.lineWidth = 1.2;
    this.ctx.setLineDash([4, 4]);
    this.ctx.lineDashOffset = -this.animTime * 5;

    routes.forEach(route => {
      this.ctx.beginPath();
      this.ctx.moveTo(route.from.x * ts + ts/2, route.from.y * ts + ts/2);
      this.ctx.lineTo(route.to.x * ts + ts/2, route.to.y * ts + ts/2);
      this.ctx.stroke();

      const p = (this.animTime * 0.15) % 1.0;
      const cx = route.from.x * ts + ts/2 + (route.to.x - route.from.x) * ts * p;
      const cy = route.from.y * ts + ts/2 + (route.to.y - route.from.y) * ts * p;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      this.ctx.fill();
    });

    this.ctx.restore();
  }

  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
