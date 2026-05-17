const fs = require('fs');
let styleCSS = fs.readFileSync('/app/style.css', 'utf8');
styleCSS = styleCSS.replace(/animation: pulse 2s infinite;/, "");
fs.writeFileSync('/app/style.css', styleCSS);
