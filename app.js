// Root entry point for Hostinger Git deployment
// Forces cwd to backend so all relative paths work correctly
const path = require('path');
process.chdir(path.join(__dirname, 'backend'));
require('./backend/dist/index.js');
