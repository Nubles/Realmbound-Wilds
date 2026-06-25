import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createNewWorld, advanceSimulation, getCell } from './engine.js';

const DATA_DIR = path.resolve('public/data');
const WORLD_FILE = path.join(DATA_DIR, 'world.json');
const OUTCOME_FILE = path.join(DATA_DIR, 'expedition_outcome.md');

console.log('--- STARTING DIAGNOSTIC VERIFICATION ---');

// 1. Verify Simulation Engine Initialization
console.log('Testing world generation...');
const world = createNewWorld('test-seed');
if (!world || !world.modifiedCells) {
  throw new Error('World generation returned invalid output.');
}
console.log('✅ World initialization successful.');

// 2. Verify Simulation Tick Logic
console.log('Running 5 offline iteration ticks...');
for (let i = 0; i < 5; i++) {
  advanceSimulation(world);
  console.log(`- Year ${world.year}: Chronicle count = ${world.chronicle.length}`);
}
console.log('✅ 5 simulation ticks executed without errors.');

// 3. Setup CLI Tick Runner Verification
console.log('Testing tick.js script via child process...');
try {
  if (fs.existsSync(WORLD_FILE)) fs.unlinkSync(WORLD_FILE);
  
  execSync('node src/simulation/tick.js', { stdio: 'inherit' });
  
  if (!fs.existsSync(WORLD_FILE)) {
    throw new Error('tick.js did not write data/world.json');
  }
  console.log('✅ CLI runner tick.js executed successfully.');
} catch (e) {
  console.error('❌ CLI runner tick.js test failed:', e);
  process.exit(1);
}

// 4. Setup CLI Expedition Runner Verification
console.log('Testing expedition.js script via child process...');
try {
  // Mock issue body content specifying a realm
  const mockIssueBody = `
### Target Realm / Dimension
Underworld

### Coordinates
15, 10

### Action
Settle

### Settlement Name
Aethelgard Outpost

### Player Name
Alexander
`;
  
  process.env.ISSUE_BODY = mockIssueBody;
  
  execSync('node src/simulation/expedition.js', { stdio: 'inherit' });

  if (!fs.existsSync(OUTCOME_FILE)) {
    throw new Error('expedition.js did not produce expedition_outcome.md');
  }

  const outcome = fs.readFileSync(OUTCOME_FILE, 'utf8');
  console.log('Expedition Output Summary:\n', outcome);

  if (!outcome.includes('Success') && !outcome.includes('established')) {
    throw new Error('Expedition outcome does not mention settlement success.');
  }

  // Load world state to make sure faction is updated in the correct realm key
  const worldData = JSON.parse(fs.readFileSync(WORLD_FILE, 'utf8'));
  const cell = worldData.modifiedCells['underworld:15,10'];
  if (!cell || !cell.settlement || cell.settlement.name !== 'Aethelgard Outpost') {
    throw new Error('Expedition did not apply settlement coordinates in underworld database key.');
  }

  console.log('✅ CLI expedition.js processed player input successfully.');
} catch (e) {
  console.error('❌ CLI expedition.js test failed:', e);
  process.exit(1);
}

console.log('--- ALL SYSTEMS INTEGRITY VERIFIED ---');
process.exit(0);
