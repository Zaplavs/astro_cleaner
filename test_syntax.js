const code = require('fs').readFileSync('game.js', 'utf-8');
try {
  new Function(code);
  console.log("Syntax is valid.");
} catch(e) {
  console.error(e);
}
