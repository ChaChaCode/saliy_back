// Тест получения токена CDEK напрямую
require('dotenv').config();
const https = require('https');
const { URLSearchParams } = require('url');

const isTestMode = process.env.CDEK_TEST_MODE === 'true';
const clientId = process.env.CDEK_CLIENT_ID_TEST;
const clientSecret = process.env.CDEK_CLIENT_SECRET_TEST;
const apiUrl = isTestMode ? 'api.edu.cdek.ru' : 'api.cdek.ru';

console.log('\n🔑 Тестирование получения токена CDEK');
console.log(`Режим: ${isTestMode ? 'ТЕСТОВЫЙ' : 'ПРОДАКШН'}`);
console.log(`API URL: https://${apiUrl}`);
console.log(`Client ID: ${clientId}`);
console.log(`Client Secret: ${clientSecret ? '***' + clientSecret.slice(-4) : 'не указан'}`);
console.log('\n' + '='.repeat(70));

const params = new URLSearchParams();
params.append('grant_type', 'client_credentials');
params.append('client_id', clientId);
params.append('client_secret', clientSecret);

const postData = params.toString();

const options = {
  hostname: apiUrl,
  port: 443,
  path: '/v2/oauth/token',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`\nСтатус ответа: ${res.statusCode}`);

    if (res.statusCode === 200) {
      const json = JSON.parse(data);
      console.log(`✅ Токен получен успешно!`);
      console.log(`Token: ${json.access_token.substring(0, 20)}...`);
      console.log(`Expires in: ${json.expires_in} секунд`);
      console.log(`Token type: ${json.token_type}`);
    } else {
      console.log('❌ Ошибка получения токена:');
      console.log(data);
    }

    console.log('='.repeat(70) + '\n');
  });
});

req.on('error', (err) => {
  console.error('❌ Ошибка запроса:', err.message);
});

req.write(postData);
req.end();
