// Тестирование API пользователя
const axios = require('axios');

const BASE_URL = process.env.API_URL || 'https://saliy-shop.ru/api';
let accessToken = '';

// Цвета для вывода
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function test() {
  console.log('\n🧪 Тестирование API пользователя\n');

  try {
    // 1. Отправить код
    log('blue', '1️⃣  Отправка кода на email...');
    const email = `test${Date.now()}@example.com`;
    await axios.post(`${BASE_URL}/auth/send-code`, { email });
    log('green', '✅ Код отправлен');

    // Для теста берем код из базы данных
    log('yellow', '⚠️  В реальном сценарии нужно получить код из email');
    log('yellow', '⚠️  Для теста используем код из последней записи в БД');

    // 2. Подтвердить код (используем фиктивный код для демонстрации)
    log('blue', '\n2️⃣  Авторизация...');
    // В реальном тесте нужно получить код из БД или email
    // const verifyResponse = await axios.post(`${BASE_URL}/auth/verify-code`, {
    //   email,
    //   code: '1234' // Код из email
    // });
    // accessToken = verifyResponse.data.accessToken;
    // log('green', '✅ Авторизация успешна');

    // Для демонстрации используем существующий токен или пропускаем авторизацию
    log(
      'yellow',
      '⚠️  Пропускаем авторизацию (используйте реальный токен для теста)',
    );
    log(
      'yellow',
      '⚠️  Для полного теста выполните авторизацию вручную и вставьте токен ниже',
    );
    // accessToken = 'YOUR_ACCESS_TOKEN_HERE';

    if (!accessToken) {
      log('red', '\n❌ Токен не установлен. Дальнейшее тестирование невозможно.');
      log(
        'yellow',
        '\nДля тестирования выполните следующие шаги:\n',
      );
      log('yellow', '1. Отправьте код: POST /api/auth/send-code');
      log('yellow', '   Body: { "email": "your@email.com" }');
      log('yellow', '\n2. Получите код из email');
      log('yellow', '\n3. Подтвердите код: POST /api/auth/verify-code');
      log('yellow', '   Body: { "email": "your@email.com", "code": "1234" }');
      log('yellow', '\n4. Скопируйте accessToken из ответа');
      log('yellow', '\n5. Вставьте токен в этот скрипт (переменная accessToken)');
      return;
    }

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    // 3. Получить профиль
    log('blue', '\n3️⃣  Получение профиля...');
    const profileResponse = await axios.get(`${BASE_URL}/auth/me`, { headers });
    log('green', '✅ Профиль получен:');
    console.log(JSON.stringify(profileResponse.data, null, 2));

    // 4. Обновить персональные данные
    log('blue', '\n4️⃣  Обновление персональных данных...');
    const updateProfileData = {
      firstName: 'Иван',
      lastName: 'Петров',
      middleName: 'Сергеевич',
      phone: '+79991234567',
      street: 'ул. Пушкина, д. 5',
      apartment: '12',
      postalCode: '190000',
    };

    const updatedProfile = await axios.put(
      `${BASE_URL}/auth/profile`,
      updateProfileData,
      { headers },
    );
    log('green', '✅ Профиль обновлен:');
    console.log(JSON.stringify(updatedProfile.data, null, 2));

    // 5. Установить город доставки
    log('blue', '\n5️⃣  Установка города доставки (Москва, код 44)...');
    const locationData = {
      cdekCityCode: 44,
    };

    const updatedLocation = await axios.put(
      `${BASE_URL}/auth/delivery-location`,
      locationData,
      { headers },
    );
    log('green', '✅ Город доставки установлен:');
    console.log(JSON.stringify(updatedLocation.data, null, 2));

    // 6. Получить обновленный профиль
    log('blue', '\n6️⃣  Получение обновленного профиля...');
    const finalProfile = await axios.get(`${BASE_URL}/auth/me`, { headers });
    log('green', '✅ Финальный профиль:');
    console.log(JSON.stringify(finalProfile.data, null, 2));

    log('green', '\n\n✅ Все тесты пройдены успешно!');
  } catch (error) {
    log('red', '\n❌ Ошибка:');
    if (error.response) {
      console.log('Статус:', error.response.status);
      console.log('Данные:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log(error.message);
    }
  }
}

// Примеры curl команд
function showCurlExamples() {
  console.log('\n📚 Примеры curl команд:\n');

  console.log('1. Отправить код:');
  console.log(
    `curl -X POST ${BASE_URL}/auth/send-code \\
  -H "Content-Type: application/json" \\
  -d '{"email": "your@email.com"}'\n`,
  );

  console.log('2. Подтвердить код:');
  console.log(
    `curl -X POST ${BASE_URL}/auth/verify-code \\
  -H "Content-Type: application/json" \\
  -d '{"email": "your@email.com", "code": "1234"}'\n`,
  );

  console.log('3. Получить профиль:');
  console.log(
    `curl -X GET ${BASE_URL}/auth/me \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"\n`,
  );

  console.log('4. Обновить профиль:');
  console.log(
    `curl -X PUT ${BASE_URL}/auth/profile \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "firstName": "Иван",
    "lastName": "Петров",
    "middleName": "Сергеевич",
    "phone": "+79991234567",
    "street": "ул. Пушкина, д. 5",
    "apartment": "12",
    "postalCode": "190000"
  }'\n`,
  );

  console.log('5. Установить город доставки:');
  console.log(
    `curl -X PUT ${BASE_URL}/auth/delivery-location \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"cdekCityCode": 44}'\n`,
  );
}

// Запуск
if (process.argv[2] === 'curl') {
  showCurlExamples();
} else {
  test();
}
