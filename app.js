// Root entry point for Hostinger Git deployment
// Forces cwd to backend so all relative paths work correctly
const path = require('path');
const backendDir = path.join(__dirname, 'backend');
process.chdir(backendDir);

// Load .env from backend folder explicitly
require('dotenv').config({ path: path.join(backendDir, '.env') });

require('./backend/dist/index.js');
