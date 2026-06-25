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

// Procedural Resource Prefix & Suffix tables
const RES_PREFIXES = ["Nova", "Shadow", "Stellar", "Cavern", "Astral", "Magma", "Deep", "Prismatic", "Chrono", "Aether"];
const RES_SUFFIXES = ["gem", "ore", "crystal", "dust", "timber", "shards", "metal", "alloy", "weave", "essence"];

// Procedural Tech Tree Definitions starting from Stone Age
export const TECH_TREE = [
  // Stone Age
  { id: 'stone_tools', name: 'Basic Flint Tooling', cost: 40, requires: [] },
  { id: 'stone_shelter', name: 'Primitive Shelters', cost: 60, requires: [] },
  
  // Bronze/Iron Age
  { id: 'sailing_boats', name: 'Sailing & Watercraft', cost: 150, requires: ['stone_tools'] },
  { id: 'carriage_vehicles', name: 'Carriage Vehicles', cost: 200, requires: ['stone_shelter'] },
  
  // Industrial/Alchemical Age
  { id: 'steam_engine', name: 'Steam Engines & Motorized Vehicles', cost: 450, requires: ['carriage_vehicles'] },
  { id: 'sky_ships', name: 'Aetherial Sky Sailing', cost: 600, requires: ['sailing_boats'] },
  
  // Space Age
  { id: 'starflight', name: 'Cosmic Spaceflight', cost: 1200, requires: ['steam_engine', 'sky_ships'] }
];

export function getProceduralResource(x, y, realm, seed) {
  const rng = seedRandom(`${x},${y}:${realm}:res:${seed}`);
  const pre = RES_PREFIXES[Math.floor(rng() * RES_PREFIXES.length)];
  const suf = RES_SUFFIXES[Math.floor(rng() * RES_SUFFIXES.length)];
  return `${pre}${suf}`.toLowerCase();
}

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
      
      // Inject procedural resource under specific noise conditions
      if (detailNoise < 0.18) {
        resources.push(getProceduralResource(x, y, realm, seed));
      }
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

    if (biome !== 'deep_lake' && biome !== 'solid_rock' && detailNoise < 0.15) {
      resources.push(getProceduralResource(x, y, realm, seed));
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

    if (biome !== 'void' && detailNoise < 0.15) {
      resources.push(getProceduralResource(x, y, realm, seed));
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

    if (biome !== 'void_space' && detailNoise < 0.15) {
      resources.push(getProceduralResource(x, y, realm, seed));
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
    globalTempOffset: 0.0,
    season: 'Spring'
  };

  // Place a single starting settlement to grow and explore the world from scratch
  const name = "Valoria";
  const color = FACTION_COLORS[0];
  
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
    size: 150,
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
    power: 150,
    resources: { gold: 10, wood: 5, iron: 0 },
    technologies: []
  });

  // Setup initial Fog of War discovery boundary around capital
  world.discoveredCenters.push({
    realm: REALMS.OVERWORLD,
    x: cx,
    y: cy,
    radius: 7
  });

  world.chronicle.push(`The founding capital of ${capitalName} was established on the Overworld at [${cx}, ${cy}]. Exploring the uncharted realms begins...`);

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
  const seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];
  world.season = seasons[world.year % 4];
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

    // Weather drift (colder in winter, hotter in summer)
    const seasonalTempAdjust = world.season === 'Winter' ? -0.15 : (world.season === 'Summer' ? 0.15 : 0.0);
    cell.temperature = Math.max(0, Math.min(1.0, cell.temperature + world.globalTempOffset * 0.1 + seasonalTempAdjust * 0.05));

    // Wildfire rules with Oakhaven Druid trait
    if (cell.fireTicksLeft > 0) {
      cell.fireTicksLeft--;
      cell.vegetation = Math.max(0, cell.vegetation - 0.35);
      
      if (cell.settlement) {
        // Oakhaven Druids take half damage from forest fires
        const dmgRate = cell.settlement.faction === 'Oakhaven' ? 0.75 : 0.5;
        cell.settlement.size = Math.floor(cell.settlement.size * dmgRate);
        
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
          // Oakhaven tiles resist wildfire spreading; Summer doubles spread chance
          let spreadChance = nc.settlement && nc.settlement.faction === 'Oakhaven' ? 0.12 : 0.25;
          if (world.season === 'Summer') spreadChance *= 2.0;
          if (nc.fireTicksLeft === 0 && nc.vegetation > 0.45 && random() < spreadChance) {
            nc.fireTicksLeft = Math.floor(random() * 3) + 2;
            cellsToSave.push(nc);
          }
        });
      }
    } else {
      // Vegetation growth (Druids grow forests faster; accelerated in Summer, halted in Winter)
      let growthFactor = cell.settlement && cell.settlement.faction === 'Oakhaven' ? 0.08 : 0.04;
      if (world.season === 'Summer') growthFactor *= 1.5;
      if (world.season === 'Winter') growthFactor *= 0.1;
      
      if (cell.biome.includes('forest') || cell.biome.includes('woods')) cell.vegetation = Math.min(1.0, cell.vegetation + growthFactor);
      else cell.vegetation = Math.min(0.5, cell.vegetation + 0.015 * (world.season === 'Winter' ? 0.2 : 1.0));
    }

    cellsToSave.push(cell);
  });

  // Commit dynamic environment cells
  cellsToSave.forEach(c => saveCell(world, c));

  // Sim Faction expansions with Trait buffs
  world.factions.forEach(faction => {
    let factionPower = 0;
    
    // Ensure backwards compatibility with old database world state saves
    if (!faction.resources) {
      faction.resources = { gold: 50, wood: 50, iron: 10 };
    }
    if (!faction.technologies) {
      faction.technologies = [];
    }

    // Winter heating resource consumption
    let heatingFail = false;
    if (world.season === 'Winter') {
      const woodNeed = faction.settlements.length * 2;
      if ((faction.resources.wood || 0) >= woodNeed) {
        faction.resources.wood -= woodNeed;
      } else {
        faction.resources.wood = 0;
        heatingFail = true;
      }
    }

    faction.settlements.forEach(sCoord => {
      const cell = getCell(world, sCoord.realm, sCoord.x, sCoord.y);
      if (!cell.settlement) return;

      let growthModifier = 0.08;
      if (heatingFail) growthModifier *= 0.25; // Severe penalty for freezing citizens
      
      // Valoria Expansionist Trait
      if (faction.name === 'Valoria') growthModifier *= 1.3;
      // Ironclad Industrialist Trait: grows faster on mineral-rich cells
      if (faction.name === 'Ironclad' && (cell.resources.includes('iron') || cell.resources.includes('gold'))) {
        growthModifier += 0.05;
      }

      // Space Life-Support mechanics
      let isSpaceDecay = false;
      if (sCoord.realm === REALMS.SPACE) {
        if (cell.settlement.size < 200 && !cell.settlement.dome) {
          isSpaceDecay = true;
          cell.settlement.size -= Math.max(1, Math.floor(cell.settlement.size * 0.04));
        } else if (cell.settlement.size >= 200 && !cell.settlement.dome) {
          cell.settlement.dome = true;
          world.chronicle.push(`${logPrefix} UPGRADE: Space outpost ${cell.settlement.name} completed its Life Support Dome! Atmospheric pressure stabilized.`);
        }
      }

      if (!isSpaceDecay) {
        cell.settlement.size += Math.floor(cell.settlement.size * growthModifier);
        if (heatingFail && random() < 0.15) {
          world.chronicle.push(`${logPrefix} Winter Crisis: Citizens in ${cell.settlement.name} are freezing due to lack of timber reserves!`);
        }
      }
      
      factionPower += cell.settlement.size;

      // Classify type
      if (cell.settlement.size > 2000) cell.settlement.type = 'city';
      else if (cell.settlement.size > 700) cell.settlement.type = 'town';
      else cell.settlement.type = 'village';

      // Settlement Expansion into discovered or undiscovered coordinates
      const expandRate = faction.name === 'Valoria' ? 0.13 : 0.08;
      if (cell.settlement.size > 650 && random() < expandRate && faction.settlements.length < 12) {
        const neighbors = getNeighbors(sCoord.x, sCoord.y);
        const candidates = neighbors.filter(n => {
          const nc = getCell(world, sCoord.realm, n.x, n.y);
          // Allow expanding into neighboring cells as long as they are not ocean/mountain/void voids, even if they were covered by Fog of War!
          return nc.biome !== 'ocean' && nc.biome !== 'mountain' && nc.biome !== 'void' && nc.biome !== 'void_space' && !nc.settlement;
        });

        if (candidates.length > 0) {
          const target = candidates[Math.floor(random() * candidates.length)];
          const newCell = getCell(world, sCoord.realm, target.x, target.y);
          const names = ["Crossroads", "Stonefort", "Evergreen", "Goldpeak", "Riverbend", "Aethercliff", "Deepmine", "OrbitStation"];
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
          
          world.chronicle.push(`${logPrefix} EXPANSION: ${faction.name} expanded to [${target.x}, ${target.y}] in ${sCoord.realm}, building ${nName}.`);
        }
      }

      // Dynamic Faction Rebellion/Splits for massive scale
      if (cell.settlement.size > 1800 && faction.settlements.length >= 3 && random() < 0.18) {
        // Find a faction name that is not currently active in the world
        const activeNames = world.factions.map(f => f.name);
        const availableName = FACTION_NAMES.find(n => !activeNames.includes(n));
        
        if (availableName) {
          const newColor = FACTION_COLORS[world.factions.length % FACTION_COLORS.length];
          
          // Re-assign the settlement to the new breakaway faction
          const breakawaySettlement = sCoord;
          cell.settlement.faction = availableName;
          cell.settlement.type = 'capital';
          cell.settlement.name = `${availableName} Breakaway`;
          
          // Remove from old faction
          faction.settlements = faction.settlements.filter(s => s.x !== breakawaySettlement.x || s.y !== breakawaySettlement.y || s.realm !== breakawaySettlement.realm);
          
          // Register new faction
          world.factions.push({
            name: availableName,
            color: newColor,
            capital: { realm: breakawaySettlement.realm, x: breakawaySettlement.x, y: breakawaySettlement.y },
            settlements: [breakawaySettlement],
            status: {},
            power: cell.settlement.size,
            resources: { gold: 120, wood: 100, iron: 15 },
            technologies: [...faction.technologies] // Inherit technological advances
          });

          // Set initial diplomacy stance to war
          world.factions.forEach(fac => {
            if (fac.name !== availableName) {
              fac.status[availableName] = 'war';
              // Breakaway hates former parent
              if (fac.name === faction.name) {
                fac.status[availableName] = 'war';
              }
            }
          });

          world.chronicle.push(`${logPrefix} REBELLION: Outpost ${cell.settlement.name} rebelled against ${faction.name}, forming the independent state of ${availableName}!`);
        }
      }
      
      // Gather local resources to faction stockpile
      if (cell.resources) {
        cell.resources.forEach(r => {
          faction.resources[r] = (faction.resources[r] || 0) + 1;
        });
      }
      // Basic gold taxation based on settlement size
      faction.resources.gold = (faction.resources.gold || 0) + Math.max(1, Math.floor(cell.settlement.size * 0.05));
      
      saveCell(world, cell);
    });

    // Tech tree research progression check
    const nextTech = TECH_TREE.find(t => !faction.technologies.includes(t.id) && t.requires.every(req => faction.technologies.includes(req)));
    if (nextTech && faction.resources.gold >= nextTech.cost) {
      faction.resources.gold -= nextTech.cost;
      faction.technologies.push(nextTech.id);
      world.chronicle.push(`${logPrefix} RESEARCH: ${faction.name} unlocked technology [${nextTech.name}]!`);
    }

    faction.power = factionPower;
  });

  // Calculate Trade Routes
  world.tradeRoutes = [];
  for (let i = 0; i < world.factions.length; i++) {
    const f1 = world.factions[i];
    for (let j = i + 1; j < world.factions.length; j++) {
      const f2 = world.factions[j];
      const rel = f1.status[f2.name] || 'peace';
      if (rel === 'peace' || rel === 'alliance') {
        f1.settlements.forEach(s1 => {
          f2.settlements.forEach(s2 => {
            if (s1.realm === s2.realm) {
              const dist = Math.hypot(s1.x - s2.x, s1.y - s2.y);
              if (dist < 14) {
                world.tradeRoutes.push({
                  from: { x: s1.x, y: s1.y },
                  to: { x: s2.x, y: s2.y },
                  f1: f1.name,
                  f2: f2.name
                });
                const c1 = getCell(world, s1.realm, s1.x, s1.y);
                const c2 = getCell(world, s2.realm, s2.x, s2.y);
                if (c1.settlement) c1.settlement.size += rel === 'alliance' ? 12 : 6;
                if (c2.settlement) c2.settlement.size += rel === 'alliance' ? 12 : 6;
                saveCell(world, c1);
                saveCell(world, c2);
              }
            }
          });
        });
      }
    }
  }

  // Diplomatic Relations & Wars with Sunspire Scholar alliance traits
  for (let i = 0; i < world.factions.length; i++) {
    const f1 = world.factions[i];
    for (let j = i + 1; j < world.factions.length; j++) {
      const f2 = world.factions[j];
      const rel = f1.status[f2.name] || 'peace';

      if (rel === 'peace') {
        // Sunspire is twice as likely to form defensive alliances
        const allianceChance = (f1.name === 'Sunspire' || f2.name === 'Sunspire') ? 0.10 : 0.04;
        const warChance = 0.02;
        
        if (random() < allianceChance) {
          f1.status[f2.name] = 'alliance';
          f2.status[f1.name] = 'alliance';
          world.chronicle.push(`${logPrefix} DIPLOMACY: Alliances forged between ${f1.name} and ${f2.name}!`);
        } else if (random() < warChance) {
          f1.status[f2.name] = 'war';
          f2.status[f1.name] = 'war';
          world.chronicle.push(`${logPrefix} DECLARATION OF WAR: ${f1.name} declared war on ${f2.name}!`);
          
          // Summon allies
          world.factions.forEach(ally => {
            if (ally.name !== f1.name && ally.status[f1.name] === 'alliance' && ally.status[f2.name] !== 'war') {
              ally.status[f2.name] = 'war';
              f2.status[ally.name] = 'war';
              world.chronicle.push(`${logPrefix} CALL TO ARMS: ${ally.name} joins war against ${f2.name} to defend ally ${f1.name}.`);
            }
          });
        }
      } else if (rel === 'war') {
        // Resolve battles
        let battleSettlement = null;
        f1.settlements.forEach(s1 => {
          f2.settlements.forEach(s2 => {
            if (s1.realm === s2.realm && Math.hypot(s1.x - s2.x, s1.y - s2.y) < 10 && random() < 0.3) {
              battleSettlement = f1.power > f2.power ? s2 : s1;
            }
          });
        });

        if (battleSettlement) {
          const cell = getCell(world, battleSettlement.realm, battleSettlement.x, battleSettlement.y);
          if (cell.settlement) {
            cell.settlement.size = Math.floor(cell.settlement.size * 0.5);
            if (cell.settlement.size < 20) {
              world.chronicle.push(`${logPrefix} BATTLE LOSS: Settlement ${cell.settlement.name} was razed during combat.`);
              cell.ruin = {
                name: `Ruins of ${cell.settlement.name}`,
                description: `Destroyed in the great war.`,
                age: world.year
              };
              const def = world.factions.find(fac => fac.name === cell.settlement.faction);
              if (def) def.settlements = def.settlements.filter(s => s.x !== battleSettlement.x || s.y !== battleSettlement.y || s.realm !== battleSettlement.realm);
              cell.settlement = null;
            }
            saveCell(world, cell);
          }
        }

        if (random() < 0.15) {
          f1.status[f2.name] = 'peace';
          f2.status[f1.name] = 'peace';
          world.chronicle.push(`${logPrefix} PEACE TREATY: Armistice signed between ${f1.name} and ${f2.name}.`);
        }
      }
    }
  }

  // Migrate legendary beasts and trigger sieges
  const beasts = [];
  Object.keys(world.modifiedCells).forEach(key => {
    const cell = world.modifiedCells[key];
    const bIdx = cell.wildlife.findIndex(w => w.species === 'legendary_beast');
    if (bIdx !== -1) {
      beasts.push({ realm: cell.realm, x: cell.x, y: cell.y, beast: cell.wildlife[bIdx] });
    }
  });

  beasts.forEach(({ realm, x, y, beast }) => {
    // Find closest settlement in same realm
    let closest = null;
    let minDist = 999;
    Object.keys(world.modifiedCells).forEach(key => {
      const cell = world.modifiedCells[key];
      if (cell.realm === realm && cell.settlement) {
        const d = Math.hypot(x - cell.x, y - cell.y);
        if (d < minDist) {
          minDist = d;
          closest = { x: cell.x, y: cell.y, name: cell.settlement.name };
        }
      }
    });

    if (closest) {
      const neighbors = getNeighbors(x, y);
      let bestN = null;
      let bestD = minDist;
      neighbors.forEach(n => {
        const d = Math.hypot(n.x - closest.x, n.y - closest.y);
        if (d < bestD) {
          bestD = d;
          bestN = n;
        }
      });

      if (bestN) {
        const oldCell = getCell(world, realm, x, y);
        const newCell = getCell(world, realm, bestN.x, bestN.y);

        oldCell.wildlife = oldCell.wildlife.filter(w => w.species !== 'legendary_beast');
        saveCell(world, oldCell);

        if (newCell.settlement) {
          // Siege event
          if (random() < 0.45) {
            world.chronicle.push(`${logPrefix} SIEGE DEFEAT: Garrison at ${newCell.settlement.name} slew the beast ${beast.name}!`);
            if (!newCell.resources.includes('trophy')) newCell.resources.push('trophy');
          } else {
            newCell.settlement.size = Math.floor(newCell.settlement.size * 0.6);
            world.chronicle.push(`${logPrefix} RAMPAGE: Legendary beast ${beast.name} ransacked ${newCell.settlement.name}!`);
            newCell.wildlife.push(beast);
          }
        } else {
          newCell.wildlife.push(beast);
        }
        saveCell(world, newCell);
      }
    }
  });

  // Dynamic discovery updates
  world.discoveredCenters = [];
  world.factions.forEach(f => {
    f.settlements.forEach(s => {
      const cell = getCell(world, s.realm, s.x, s.y);
      if (cell.settlement) {
        const rad = cell.settlement.size > 1000 ? 10 : (cell.settlement.size > 500 ? 8 : 6);
        world.discoveredCenters.push({ realm: s.realm, x: s.x, y: s.y, radius: rad });
      }
    });
  });

  Object.keys(world.modifiedCells).forEach(key => {
    const cell = world.modifiedCells[key];
    if (cell.ruin && cell.ruin.portalTarget) {
      world.discoveredCenters.push({ realm: cell.realm, x: cell.x, y: cell.y, radius: 4 });
    }
  });

  // --- 1. Environmental Disasters ---
  // Meteor Strike (3% chance)
  if (random() < 0.03 && world.discoveredCenters.length > 0) {
    const targetCenter = world.discoveredCenters[Math.floor(random() * world.discoveredCenters.length)];
    const rx = targetCenter.x + Math.floor(random() * 5) - 2;
    const ry = targetCenter.y + Math.floor(random() * 5) - 2;
    const cell = getCell(world, targetCenter.realm, rx, ry);
    
    cell.biome = 'crater';
    cell.elevation = 0.15;
    cell.temperature = 0.8;
    cell.vegetation = 0.0;
    
    if (cell.settlement) {
      world.chronicle.push(`${logPrefix} METEOR IMPACT: A roaring meteorite obliterated the settlement ${cell.settlement.name} at [${rx}, ${ry}] in ${targetCenter.realm}!`);
      const f = world.factions.find(fac => fac.name === cell.settlement.faction);
      if (f) f.settlements = f.settlements.filter(s => s.x !== rx || s.y !== ry || s.realm !== targetCenter.realm);
      cell.settlement = null;
    } else {
      world.chronicle.push(`${logPrefix} METEOR STRIKE: A roaring meteorite struck the ground at [${rx}, ${ry}] in ${targetCenter.realm}, leaving a burning crater of astralmetal.`);
    }
    
    cell.resources = ['astralmetal', 'obsidian'];
    cell.ruin = {
      name: "Smoking Crater Outpost",
      description: "Rich in stellar materials from a celestial impact.",
      age: world.year
    };
    saveCell(world, cell);
  }

  // Sea Monster sighting (5% chance in water biomes)
  if (random() < 0.05) {
    const waterKeys = Object.keys(world.modifiedCells).filter(key => {
      const c = world.modifiedCells[key];
      return c.realm === 'overworld' && (c.biome === 'ocean' || c.biome === 'coast');
    });
    if (waterKeys.length > 0) {
      const targetKey = waterKeys[Math.floor(random() * waterKeys.length)];
      const cell = world.modifiedCells[targetKey];
      cell.wildlife = [{ species: 'sea_monster', count: 1 }];
      world.chronicle.push(`${logPrefix} SEA MONSTER SIGHTING: A giant kraken was spotted in the oceanic waters at [${cell.x}, ${cell.y}]!`);
      saveCell(world, cell);
    }
  }

  // Plague Outbreak check (5% chance)
  if (random() < 0.05) {
    const activeSettlementsList = [];
    world.factions.forEach(f => {
      f.settlements.forEach(s => {
        activeSettlementsList.push({ realm: s.realm, x: s.x, y: s.y });
      });
    });
    if (activeSettlementsList.length > 0) {
      const targetS = activeSettlementsList[Math.floor(random() * activeSettlementsList.length)];
      const cell = getCell(world, targetS.realm, targetS.x, targetS.y);
      if (cell.settlement) {
        cell.settlement.plagued = true;
        world.chronicle.push(`${logPrefix} PLAGUE OUTBREAK: Outbreak center detected at ${cell.settlement.name} in ${targetS.realm} [${targetS.x}, ${targetS.y}]! Sickness is spreading.`);
        saveCell(world, cell);
      }
    }
  }

  // Active plague transmission/spread check (across adjacent cells)
  const plagueKeys = Object.keys(world.modifiedCells).filter(key => {
    const c = world.modifiedCells[key];
    return c.settlement && c.settlement.plagued;
  });
  plagueKeys.forEach(key => {
    const cell = world.modifiedCells[key];
    const neighbors = getNeighbors(cell.x, cell.y);
    neighbors.forEach(n => {
      const nc = getCell(world, cell.realm, n.x, n.y);
      if (nc.settlement && !nc.settlement.plagued && random() < 0.25) {
        // If there's an Apothecary built, resist infection
        if (nc.settlement.apothecary) {
          if (random() < 0.8) return; // 80% infection prevention
        }
        nc.settlement.plagued = true;
        world.chronicle.push(`${logPrefix} CONTAGION: The plague has spread to ${nc.settlement.name} at [${nc.x}, ${nc.y}] in ${cell.realm}!`);
        saveCell(world, nc);
      }
    });

    // Demise from plague if untreated and no Apothecary built
    if (cell.settlement && cell.settlement.plagued) {
      if (cell.settlement.apothecary) {
        // Cure settlement plague
        cell.settlement.plagued = false;
        world.chronicle.push(`${logPrefix} MEDICAL RELIEF: Apothecary structure successfully cured the plague outbreak in ${cell.settlement.name}.`);
        saveCell(world, cell);
      } else if (random() < 0.15) {
        const livesLost = Math.floor(cell.settlement.size * 0.12) + 5;
        cell.settlement.size = Math.max(10, cell.settlement.size - livesLost);
        world.chronicle.push(`${logPrefix} PLAGUE TOLL: Sickness claimed ${livesLost} citizens in ${cell.settlement.name}. An Apothecary is urgently needed!`);
        saveCell(world, cell);
      }
    }
  });

  // --- 2. Market Economies & Trading ---
  for (let i = 0; i < world.factions.length; i++) {
    for (let j = i + 1; j < world.factions.length; j++) {
      const f1 = world.factions[i];
      const f2 = world.factions[j];
      
      if (!f1.resources || !f2.resources) continue;
      
      const resourcesList = ['wood', 'iron', 'gold'];
      resourcesList.forEach(res => {
        const amt1 = f1.resources[res] || 0;
        const amt2 = f2.resources[res] || 0;
        
        if (amt1 < 10 && amt2 > 60 && (f1.resources.gold || 0) > 30) {
          f1.resources[res] += 10;
          f2.resources[res] -= 10;
          f1.resources.gold -= 15;
          f2.resources.gold += 15;
          
          if (random() < 0.15) {
            world.chronicle.push(`${logPrefix} MARKET TRADE: ${f1.name} purchased 10 units of ${res} from ${f2.name} for 15 gold.`);
          }
        }
        else if (amt2 < 10 && amt1 > 60 && (f2.resources.gold || 0) > 30) {
          f2.resources[res] += 10;
          f1.resources[res] -= 10;
          f2.resources.gold -= 15;
          f1.resources.gold += 15;
          
          if (random() < 0.15) {
            world.chronicle.push(`${logPrefix} MARKET TRADE: ${f2.name} purchased 10 units of ${res} from ${f1.name} for 15 gold.`);
          }
        }
      });
    }
  }

  if (world.chronicle.length > 500) {
    world.chronicle = world.chronicle.slice(world.chronicle.length - 500);
  }
}
