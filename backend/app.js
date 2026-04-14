// Hostinger Passenger entry point
// Passenger may change process.cwd() — force it to this file's directory
process.chdir(__dirname);
require('./dist/index.js');
