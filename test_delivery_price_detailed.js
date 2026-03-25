const http = require('http');

// Запускаем сервер
const { spawn } = require('child_process');
const server = spawn('node', ['dist/src/main.js']);

let serverOutput = '';

server.stdout.on('data', (data) => {
  serverOutput += data.toString();
  console.log(data.toString());
});

server.stderr.on('data', (data) => {
  serverOutput += data.toString();
  console.log(data.toString());
});

// Ждём запуска сервера и тестируем
setTimeout(() => {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/delivery/prices?cityCode=44&weight=500&currency=RUB',
    method: 'GET',
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('\n' + '='.repeat(70));
      console.log('API Response:');
      console.log('='.repeat(70));
      console.log('Status:', res.statusCode);
      console.log('Response:', data);
      console.log('='.repeat(70));

      // Завершаем процесс
      setTimeout(() => {
        server.kill();
        process.exit(0);
      }, 2000);
    });
  });

  req.on('error', (err) => {
    console.error('Request error:', err);
    server.kill();
    process.exit(1);
  });

  req.end();
}, 7000);
