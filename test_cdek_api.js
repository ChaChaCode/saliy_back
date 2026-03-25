const http = require('http');

function testAPI(path, description) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`TEST: ${description}`);
        console.log(`PATH: ${path}`);
        console.log(`STATUS: ${res.statusCode}`);
        console.log(`${'='.repeat(70)}`);

        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            console.log(JSON.stringify(json, null, 2).substring(0, 1500));
            if (data.length > 1500) console.log('\n... (truncated)');
          } catch (e) {
            console.log('Response:', data.substring(0, 500));
          }
        } else {
          console.log('Error:', data);
        }
        resolve();
      });
    });

    req.on('error', (err) => {
      console.log(`\nERROR: ${description}:`, err.message);
      resolve();
    });

    req.setTimeout(10000, () => {
      req.destroy();
      console.log(`\nTIMEOUT: ${description}`);
      resolve();
    });

    req.end();
  });
}

async function runTests() {
  console.log('\n🧪 Тестирование CDEK API интеграции...\n');

  // Тест 1: Получить пункты выдачи в Москве (код 44)
  await testAPI('/api/delivery/pickup-points?cityCode=44', 'Пункты выдачи в Москве (код 44)');

  // Тест 2: Рассчитать стоимость доставки в Москву
  await testAPI('/api/delivery/prices?cityCode=44&weight=500&currency=RUB', 'Расчёт доставки в Москву (500г)');

  // Тест 3: Получить пункты выдачи в Минске (код 9220)
  await testAPI('/api/delivery/pickup-points?cityCode=9220', 'Пункты выдачи в Минске (код 9220)');

  // Тест 4: Рассчитать стоимость доставки в Минск
  await testAPI('/api/delivery/prices?cityCode=9220&weight=1000&currency=RUB', 'Расчёт доставки в Минск (1000г)');

  console.log('\n\n✅ CDEK тесты завершены!\n');
  process.exit(0);
}

setTimeout(runTests, 2000);
