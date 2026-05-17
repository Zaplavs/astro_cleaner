echo "Checking viewport..."
grep "viewport" index.html
echo "Checking ysdk link..."
grep "yandex.ru/games/sdk/v2" index.html
echo "Checking YaGames.init..."
grep "YaGames.init" game.js
echo "Checking ready loading API..."
grep "LoadingAPI" game.js
