echo "Checking Background Audio Pause on Ad/blur..."
grep -C 3 "visibilitychange" game.js || echo "Missing visibilitychange listener"
grep -C 3 "onClose" game.js || echo "Missing ad onClose resume"
grep -C 3 "onRewarded" game.js || echo "Missing ad onRewarded resume"
