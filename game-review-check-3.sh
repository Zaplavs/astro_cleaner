echo "Checking Background Audio Pause on Ad/blur..."
grep -C 3 "onOpen" game.js || echo "Missing onOpen callback to mute audio"
