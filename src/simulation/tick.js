import fs from 'fs';
import path from 'path';
import { createNewWorld, advanceSimulation } from './engine.js';

const DATA_DIR = path.resolve('public/data');
const WORLD_FILE = path.join(DATA_DIR, 'world.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history_log.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getSummary(world) {
  let deer = 0, wolf = 0, elk = 0, bear = 0, beasts = 0;
  let population = 0;
  
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const cell = world.grid[y][x];
      if (cell.settlement) {
        population += cell.settlement.size;
      }
      cell.wildlife.forEach(w => {
        if (w.species === 'deer') deer += w.count;
        if (w.species === 'wolf') wolf += w.count;
        if (w.species === 'elk') elk += w.count;
        if (w.species === 'bear') bear += w.count;
        if (w.species === 'legendary_beast') beasts += w.count;
      });
    }
  }

  const factionPowers = {};
  world.factions.forEach(f => {
    factionPowers[f.name] = f.power;
  });

  return {
    year: world.year,
    globalTempOffset: world.globalTempOffset,
    stats: { deer, wolf, elk, bear, beasts, population },
    factions: factionPowers,
    events: [...world.chronicle.slice(-10)] // Grab recent events
  };
}

async function run() {
  let world;
  let history = [];

  // Load existing world
  if (fs.existsSync(WORLD_FILE)) {
    console.log('Loading existing world state...');
    try {
      const rawData = fs.readFileSync(WORLD_FILE, 'utf8');
      world = JSON.parse(rawData);
    } catch (e) {
      console.error('Failed to parse world state, generating a new one.', e);
    }
  }

  if (!world) {
    console.log('Initializing a brand new world...');
    const seed = Date.now().toString();
    world = createNewWorld(60, 40, seed);
  } else {
    console.log(`Advancing simulation for Year ${world.year}...`);
    advanceSimulation(world);
  }

  // Load existing history log
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      const rawHistory = fs.readFileSync(HISTORY_FILE, 'utf8');
      history = JSON.parse(rawHistory);
    } catch (e) {
      console.warn('Failed to parse history log, starting fresh history.');
    }
  }

  // Append new history summary
  const summary = getSummary(world);
  history.push(summary);
  // Keep last 200 ticks of history data in the log to avoid huge files
  if (history.length > 200) {
    history.shift();
  }

  // Save files
  fs.writeFileSync(WORLD_FILE, JSON.stringify(world, null, 2), 'utf8');
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');

  console.log(`Tick complete! World is now in Year ${world.year}.`);
}

run().catch(err => {
  console.error('Error running simulation tick:', err);
  process.exit(1);
});
