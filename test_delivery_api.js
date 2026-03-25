const http = require('http');

function testAPI(path, description) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`TEST: ${description}`);
        console.log(`PATH: ${path}`);
        console.log(`STATUS: ${res.statusCode}`);
        console.log(`${'='.repeat(70)}`);

        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            console.log(JSON.stringify(json, null, 2).substring(0, 800));
            console.log(data.length > 800 ? '\n... (truncated)' : '');
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
      console.log(`\nERROR for ${description}:`, err.message);
      resolve();
    });

    req.setTimeout(5000, () => {
      req.destroy();
      console.log(`\nTIMEOUT for ${description}`);
      resolve();
    });

    req.end();
  });
}

async function runTests() {
  console.log('\n🚀 Starting API Tests...\n');

  // Тест 1: Получить информацию о России
  await testAPI('/api/delivery/countries/RU?lang=ru', 'Get Russia info');

  // Тест 2: Получить информацию о Беларуси
  await testAPI('/api/delivery/countries/BY?lang=ru', 'Get Belarus info');

  // Тест 3: Получить информацию о Польше
  await testAPI('/api/delivery/countries/PL?lang=ru', 'Get Poland info');

  // Тест 4: Получить список стран (первые несколько)
  await testAPI('/api/delivery/countries?lang=ru', 'Get all countries');

  // Тест 5: Получить регионы России (CDEK API)
  await testAPI('/api/delivery/regions?countryCode=RU', 'Get regions of Russia');

  // Тест 6: Получить города Москвы (CDEK API)
  await testAPI('/api/delivery/cities?countryCode=RU&regionCode=77', 'Get cities in Moscow region');

  console.log('\n\n✅ All tests completed!\n');
  process.exit(0);
}

// Даем серверу время запуститься
setTimeout(runTests, 3000);
