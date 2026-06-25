// Infinite Procedural Multi-Realm Simulation Engine with Fog of War

// Simple deterministic/seeded random generator
export function seedRandom(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

let random = Math.random;

export function setSeed(seed) {
  random = seedRandom(seed);
}

// 2D noise approximation based on coordinates and seed
function getProceduralNoise(x, y, realm, seed) {
  // Combine x, y, seed and realm string to create a coordinate hash
  const hashInput = `${x},${y}:${realm}:${seed}`;
  const rng = seedRandom(hashInput);
  return rng();
}

function getSmoothNoise(x, y, realm, seed) {
  // Combine layers of trigonometric waves for continuous terrain heightmaps
  const rOffset = realm.charCodeAt(0) * 10;
  const val = (
    Math.sin((x + rOffset) * 0.08) * Math.cos((y - rOffset) * 0.08) +
    Math.sin((x - y) * 0.03) * 0.5 +
    Math.cos((x + y + rOffset) * 0.15) * 0.25 + 1.0
  ) / 3.5;
  return Math.max(0, Math.min(1.0, val));
}

const FACTION_NAMES = ["Valoria", "Oakhaven", "Ironclad", "Sunspire", "Grimwallow", "Aethelgard"];
const FACTION_COLORS = ["#3b82f6", "#10b981", "#6b7280", "#f59e0b", "#8b5cf6", "#ec4899"];

export const REALMS = {
  OVERWORLD: 'overworld',
  UNDERWORLD: 'underworld',
  AETHER: 'aether',
  SPACE: 'space'
};

// Procedural cell state generator
export function generateCell(x, y, realm, seed) {
  const noise = getSmoothNoise(x, y, realm, seed);
  const detailNoise = getProceduralNoise(x, y, realm, seed);
  
  let biome = 'ocean';
  let elevation = noise;
  let moisture = getSmoothNoise(x + 50, y + 50, realm, seed);
  let temperature = 0.5;
  let resources = [];
  let wildlife = [];

  if (realm === REALMS.OVERWORLD) {
    // Overworld: standard forest, plains, mountains
    const latFactor = 1 - Math.abs(y) * 0.015; // Colder as we move away from y=0
    temperature = Math.max(0, Math.min(1, latFactor * 0.6 + (1 - elevation) * 0.4 + (detailNoise * 0.08 - 0.04)));
    
    if (elevation < 0.28) biome = 'ocean';
    else if (elevation < 0.32) biome = 'coast';
    else if (elevation > 0.72) biome = 'mountain';
    else if (temperature < 0.22) biome = 'tundra';
    else if (moisture < 0.25) biome = temperature > 0.55 ? 'desert' : 'plains';
    else if (moisture > 0.58 && elevation < 0.6) biome = 'forest';
    else biome = 'plains';

    // Populate base wildlife
    if (biome !== 'ocean' && biome !== 'mountain') {
      if (biome === 'forest' || biome === 'plains') {
        if (detailNoise < 0.3) wildlife.push({ species: 'deer', count: Math.floor(detailNoise * 60) + 10 });
      } else if (biome === 'tundra') {
        if (detailNoise < 0.2) wildlife.push({ species: 'elk', count: Math.floor(detailNoise * 50) + 5 });
      }
    }

    // Populate base resources
    if (biome !== 'ocean') {
      if (elevation > 0.55 && detailNoise < 0.15) resources.push('iron');
      if (elevation > 0.68 && detailNoise < 0.08) resources.push('gold');
      if (biome === 'forest' && detailNoise < 0.3) resources.push('timber');
      if (biome === 'coast' && detailNoise < 0.2) resources.push('fish');
    }

  } else if (realm === REALMS.UNDERWORLD) {
    // Underworld: caves, magma chambers, shadow crystals
    temperature = 0.4 + elevation * 0.4 + (detailNoise * 0.1);
    
    if (elevation < 0.25) biome = 'deep_lake';
    else if (elevation > 0.78) biome = 'solid_rock';
    else if (temperature > 0.75) biome = 'magma_vent';
    else if (moisture > 0.6) biome = 'mushroom_forest';
    else if (moisture < 0.3) biome = 'crystal_cave';
    else biome = 'cavern';

    if (biome === 'mushroom_forest' && detailNoise < 0.35) {
      wildlife.push({ species: 'giant_spore_deer', count: Math.floor(detailNoise * 30) + 5 });
    }
    if (biome === 'crystal_cave' && detailNoise < 0.12) {
      resources.push('shadowgem');
    } else if (biome === 'magma_vent' && detailNoise < 0.18) {
      resources.push('obsidian');
    }

  } else if (realm === REALMS.AETHER) {
    // Aether: sky clouds, floating islands
    temperature = 0.3 + (1 - elevation) * 0.3;
    
    if (elevation < 0.3) biome = 'void'; // empty space between islands
    else if (elevation > 0.8) biome = 'storm_peaks';
    else if (moisture > 0.65) biome = 'starlight_woods';
    else if (moisture < 0.35) biome = 'cloud_fields';
    else biome = 'sky_island';

    if (biome === 'starlight_woods' && detailNoise < 0.25) {
      wildlife.push({ species: 'pegasus', count: Math.floor(detailNoise * 15) + 2 });
      resources.push('stardust');
    }

  } else if (realm === REALMS.SPACE) {
    // Space: vacuum orbit, asteroids
    temperature = 0.05 + detailNoise * 0.1;
    
    if (elevation < 0.5) biome = 'void_space';
    else if (elevation > 0.85) biome = 'comet_tail';
    else if (moisture > 0.6) biome = 'nebula';
    else biome = 'asteroid_belt';

    if (biome === 'asteroid_belt' && detailNoise < 0.15) {
      resources.push('starmetal');
    }
  }

  return {
    x,
    y,
    realm,
    elevation,
    moisture,
    temperature,
    biome,
    wildlife,
    vegetation: (biome.includes('forest') || biome.includes('woods')) ? 0.8 : (biome.includes('plains') || biome === 'cavern' || biome === 'sky_island' ? 0.3 : 0.05),
    fireTicksLeft: 0,
    settlement: null,
    resources,
    ruin: null,
    history: []
  };
}

// Retrieve or generate a cell dynamically from database
export function getCell(world, realm, x, y) {
  const key = `${realm}:${x},${y}`;
  if (world.modifiedCells[key]) {
    return world.modifiedCells[key];
  }
  return generateCell(x, y, realm, world.seed);
}

// Save a modified cell status
export function saveCell(world, cell) {
  const key = `${cell.realm}:${cell.x},${cell.y}`;
  
  // Check if cell matches default state, if so we delete to keep file sizes optimized
  const defaultCell = generateCell(cell.x, cell.y, cell.realm, world.seed);
  
  const isModified = 
    cell.settlement !== null ||
    cell.ruin !== null ||
    cell.fireTicksLeft > 0 ||
    cell.history.length > 0 ||
    JSON.stringify(cell.wildlife) !== JSON.stringify(defaultCell.wildlife) ||
    cell.biome !== defaultCell.biome;

  if (isModified) {
    world.modifiedCells[key] = {
      x: cell.x,
      y: cell.y,
      realm: cell.realm,
      biome: cell.biome,
      elevation: cell.elevation,
      temperature: cell.temperature,
      settlement: cell.settlement,
      fireTicksLeft: cell.fireTicksLeft,
      resources: cell.resources,
      ruin: cell.ruin,
      wildlife: cell.wildlife,
      vegetation: cell.vegetation,
      history: cell.history
    };
  } else {
    delete world.modifiedCells[key];
  }
}

// Initialize a new multi-realm world
export function createNewWorld(seed = "realmbound") {
  setSeed(seed);
  
  const world = {
    seed,
    year: 1,
    factions: [],
    modifiedCells: {},
    discoveredCenters: [], // Array of { realm, x, y, radius }
    chronicle: ["The multi-dimensional cosmos awakens."],
    tradeRoutes: [],
    globalTempOffset: 0.0
  };

  // Place capital cities for initial factions in Overworld
  for (let i = 0; i < 4; i++) {
    const name = FACTION_NAMES[i];
    const color = FACTION_COLORS[i];
    
    // Find a solid Overworld land coordinate near origin
    let cx = 0, cy = 0;
    for (let attempts = 0; attempts < 100; attempts++) {
      cx = Math.floor(random() * 40) - 20;
      cy = Math.floor(random() * 40) - 20;
      const cell = getCell(world, REALMS.OVERWORLD, cx, cy);
      if (cell.biome !== 'ocean' && cell.biome !== 'mountain' && !cell.settlement) {
        break;
      }
    }

    const capitalName = `${name} Prime`;
    const cell = getCell(world, REALMS.OVERWORLD, cx, cy);
    cell.settlement = {
      name: capitalName,
      faction: name,
      size: 120,
      type: 'capital',
      resources: [...cell.resources]
    };
    saveCell(world, cell);

    world.factions.push({
      name,
      color,
      capital: { realm: REALMS.OVERWORLD, x: cx, y: cy },
      settlements: [{ realm: REALMS.OVERWORLD, x: cx, y: cy }],
      status: {},
      power: 120
    });

    // Setup initial Fog of War discovery boundary around capital
    world.discoveredCenters.push({
      realm: REALMS.OVERWORLD,
      x: cx,
      y: cy,
      radius: 6
    });

    world.chronicle.push(`The faction of ${name} established their capital ${capitalName} on the Overworld at [${cx}, ${cy}].`);
  }

  // Relations init
  world.factions.forEach(f1 => {
    world.factions.forEach(f2 => {
      if (f1.name !== f2.name) {
        f1.status[f2.name] = 'peace';
      }
    });
  });

  // Spawn dynamic portal points linking Overworld to other dimensions
  spawnPortal(world, REALMS.OVERWORLD, 5, 5, REALMS.UNDERWORLD, 0, 0, "Ancient Cavern Portal");
  spawnPortal(world, REALMS.OVERWORLD, -15, 10, REALMS.AETHER, 0, 0, "Sky Gate of Aether");
  spawnPortal(world, REALMS.OVERWORLD, 20, -15, REALMS.SPACE, 0, 0, "Celestial Launchpad");

  return world;
}

// Spawns linked portals
export function spawnPortal(world, r1, x1, y1, r2, x2, y2, name) {
  const c1 = getCell(world, r1, x1, y1);
  const c2 = getCell(world, r2, x2, y2);

  c1.ruin = {
    name,
    description: `A mystical glowing archway connected to ${r2} at coordinates [${x2}, ${y2}].`,
    age: world.year,
    portalTarget: { realm: r2, x: x2, y: y2 }
  };
  saveCell(world, c1);

  c2.ruin = {
    name: `${name} Link`,
    description: `A returning gateway linked back to ${r1} at coordinates [${x1}, ${y1}].`,
    age: world.year,
    portalTarget: { realm: r1, x: x1, y: y1 }
  };
  saveCell(world, c2);

  // Expose portal landing zones through Fog of War
  world.discoveredCenters.push({ realm: r1, x: x1, y: y1, radius: 4 });
  world.discoveredCenters.push({ realm: r2, x: x2, y: y2, radius: 4 });
}

function getNeighbors(x, y) {
  return [
    { x: x - 1, y: y }, { x: x + 1, y: y },
    { x: x, y: y - 1 }, { x: x, y: y + 1 },
    { x: x - 1, y: y - 1 }, { x: x + 1, y: y - 1 },
    { x: x - 1, y: y + 1 }, { x: x + 1, y: y + 1 }
  ];
}

// Advance simulation tick
export function advanceSimulation(world) {
  world.year += 1;
  const logPrefix = `[Year ${world.year}]`;
  setSeed(world.seed + world.year);

  // Local temperature offsets
  world.globalTempOffset += (random() * 0.04 - 0.02);
  world.globalTempOffset = Math.max(-0.2, Math.min(0.2, world.globalTempOffset));

  // Determine which cells need simulation (active cells + neighbor buffers)
  const activeKeys = new Set();
  Object.keys(world.modifiedCells).forEach(key => {
    activeKeys.add(key);
    const [realm, coords] = key.split(':');
    const [cx, cy] = coords.split(',').map(Number);
    getNeighbors(cx, cy).forEach(n => {
      activeKeys.add(`${realm}:${n.x},${n.y}`);
    });
  });

  // Run simulation loops on active grid tiles
  const cellsToSave = [];
  activeKeys.forEach(key => {
    const [realm, coords] = key.split(':');
    const [cx, cy] = coords.split(',').map(Number);
    const cell = getCell(world, realm, cx, cy);

    // Weather drift
    cell.temperature = Math.max(0, Math.min(1.0, cell.temperature + world.globalTempOffset * 0.1));

    // Fires
    if (cell.fireTicksLeft > 0) {
      cell.fireTicksLeft--;
      cell.vegetation = Math.max(0, cell.vegetation - 0.35);
      
      if (cell.settlement) {
        cell.settlement.size = Math.floor(cell.settlement.size * 0.5);
        if (cell.settlement.size < 12) {
          world.chronicle.push(`${logPrefix} Disaster: ${cell.settlement.name} was reduced to smoldering ash by a wildfire in ${realm} at [${cx}, ${cy}].`);
          cell.ruin = {
            name: `Burned Outpost of ${cell.settlement.faction}`,
            description: `Burned down in Year ${world.year}.`,
            age: world.year
          };
          const f = world.factions.find(fac => fac.name === cell.settlement.faction);
          if (f) f.settlements = f.settlements.filter(s => s.x !== cx || s.y !== cy || s.realm !== realm);
          cell.settlement = null;
        }
      }

      if (cell.vegetation > 0.1) {
        getNeighbors(cx, cy).forEach(n => {
          const nc = getCell(world, realm, n.x, n.y);
          if (nc.fireTicksLeft === 0 && nc.vegetation > 0.45 && random() < 0.25) {
            nc.fireTicksLeft = Math.floor(random() * 3) + 2;
            cellsToSave.push(nc);
          }
        });
      }
    } else {
      // Veg growth
      if (cell.biome.includes('forest') || cell.biome.includes('woods')) cell.vegetation = Math.min(1.0, cell.vegetation + 0.04);
      else cell.vegetation = Math.min(0.5, cell.vegetation + 0.01);
    }

    cellsToSave.push(cell);
  });

  // Commit dynamic environment cells
  cellsToSave.forEach(c => saveCell(world, c));

  // Sim Faction expansions
  world.factions.forEach(faction => {
    let factionPower = 0;
    faction.settlements.forEach(sCoord => {
      const cell = getCell(world, sCoord.realm, sCoord.x, sCoord.y);
      if (!cell.settlement) return;

      cell.settlement.size += Math.floor(cell.settlement.size * 0.08);
      factionPower += cell.settlement.size;

      // Classify type
      if (cell.settlement.size > 2000) cell.settlement.type = 'city';
      else if (cell.settlement.size > 700) cell.settlement.type = 'town';
      else cell.settlement.type = 'village';

      // Settlement Expansion
      if (cell.settlement.size > 600 && random() < 0.09 && faction.settlements.length < 10) {
        const neighbors = getNeighbors(sCoord.x, sCoord.y);
        const candidates = neighbors.filter(n => {
          const nc = getCell(world, sCoord.realm, n.x, n.y);
          return nc.biome !== 'ocean' && nc.biome !== 'mountain' && nc.biome !== 'void' && nc.biome !== 'void_space' && !nc.settlement;
        });

        if (candidates.length > 0) {
          const target = candidates[Math.floor(random() * candidates.length)];
          const newCell = getCell(world, sCoord.realm, target.x, target.y);
          const names = ["Crossroads", "Stonefort", "Oakhaven", "Goldpeak", "Riverbend", "Aethercliff", "Deepmine", "OrbitStation"];
          const nName = `${names[Math.floor(random() * names.length)]} of ${faction.name}`;

          newCell.settlement = {
            name: nName,
            faction: faction.name,
            size: 60,
            type: 'village',
            resources: [...newCell.resources]
          };
          saveCell(world, newCell);
          faction.settlements.push({ realm: sCoord.realm, x: target.x, y: target.y });
          
          world.chronicle.push(`${logPrefix} ${faction.name} expanded to [${target.x}, ${target.y}] in ${sCoord.realm}, building ${nName}.`);
        }
      }
      
      saveCell(world, cell);
    });

    faction.power = factionPower;
  });

  // Dynamic discovery radii for Fog of War updates
  world.discoveredCenters = [];
  
  // Faction cities reveal map areas
  world.factions.forEach(f => {
    f.settlements.forEach(s => {
      const cell = getCell(world, s.realm, s.x, s.y);
      if (cell.settlement) {
        const rad = cell.settlement.size > 1000 ? 10 : (cell.settlement.size > 500 ? 8 : 6);
        world.discoveredCenters.push({
          realm: s.realm,
          x: s.x,
          y: s.y,
          radius: rad
        });
      }
    });
  });

  // Re-establish Portals discovery centers
  Object.keys(world.modifiedCells).forEach(key => {
    const cell = world.modifiedCells[key];
    if (cell.ruin && cell.ruin.portalTarget) {
      world.discoveredCenters.push({
        realm: cell.realm,
        x: cell.x,
        y: cell.y,
        radius: 4
      });
    }
  });

  // Cap logs
  if (world.chronicle.length > 500) {
    world.chronicle = world.chronicle.slice(world.chronicle.length - 500);
  }
}
