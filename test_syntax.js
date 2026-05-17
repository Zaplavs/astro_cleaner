const fs = require('fs');
let gameJS = fs.readFileSync('/app/game.js', 'utf8');
try {
    eval(gameJS);
} catch(e) {
    if (e instanceof ReferenceError) {
        // window and document aren't defined in node, this is fine.
    } else {
        console.error("Syntax Error or similar:", e);
    }
}
