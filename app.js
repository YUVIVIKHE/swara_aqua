// Hostinger entry point
// The nodejs/ folder IS the repo root
const path = require('path');
const backendDir = path.join(__dirname, 'backend');
process.chdir(backendDir);
require('./backend/dist/index.js');
