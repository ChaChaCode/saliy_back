// Тестирование Products API
const http = require('http');

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'GET',
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.end();
  });
}

async function runTests() {
  console.log('🧪 Тестирование Products API\n');

  try {
    // 1. Получить все товары
    console.log('1️⃣ GET /api/products');
    const allProducts = await makeRequest('/api/products');
    console.log(`   Статус: ${allProducts.status}`);
    console.log(`   Товаров: ${allProducts.data.products?.length || 0}`);
    console.log(`   Всего: ${allProducts.data.total || 0}\n`);

    // 2. Получить товар по slug
    console.log('2️⃣ GET /api/products/black-oversized-hoodie');
    const product = await makeRequest('/api/products/black-oversized-hoodie');
    console.log(`   Статус: ${product.status}`);
    if (product.data.id) {
      console.log(`   ID: ${product.data.id}`);
      console.log(`   Название: ${product.data.name}`);
      console.log(`   Slug: ${product.data.slug}`);
      console.log(`   Статус: ${product.data.cardStatus}`);
      console.log(`   Категории: ${product.data.categories?.length || 0}\n`);
    }

    // 3. Популярные товары
    console.log('3️⃣ GET /api/products/popular?limit=5');
    const popular = await makeRequest('/api/products/popular?limit=5');
    console.log(`   Статус: ${popular.status}`);
    console.log(`   Товаров: ${popular.data?.length || 0}\n`);

    // 4. Новинки
    console.log('4️⃣ GET /api/products/new?limit=5');
    const newProducts = await makeRequest('/api/products/new?limit=5');
    console.log(`   Статус: ${newProducts.status}`);
    console.log(`   Товаров: ${newProducts.data?.length || 0}\n`);

    // 5. Распродажа
    console.log('5️⃣ GET /api/products/sale?limit=5');
    const sale = await makeRequest('/api/products/sale?limit=5');
    console.log(`   Статус: ${sale.status}`);
    console.log(`   Товаров: ${sale.data?.length || 0}\n`);

    // 6. Поиск
    console.log('6️⃣ GET /api/products/search?q=толстовка');
    const search = await makeRequest('/api/products/search?q=толстовка');
    console.log(`   Статус: ${search.status}`);
    console.log(`   Найдено: ${search.data?.length || 0}\n`);

    // 7. Фильтр по категории
    console.log('7️⃣ GET /api/products?categorySlug=hoodies');
    const category = await makeRequest('/api/products?categorySlug=hoodies');
    console.log(`   Статус: ${category.status}`);
    console.log(`   Товаров: ${category.data.products?.length || 0}\n`);

    // 8. Проверка остатков
    if (product.data.id) {
      console.log(`8️⃣ GET /api/products/${product.data.id}/stock?color=black&size=M`);
      const stock = await makeRequest(`/api/products/${product.data.id}/stock?color=black&size=M`);
      console.log(`   Статус: ${stock.status}`);
      if (stock.data.quantity !== undefined) {
        console.log(`   В наличии: ${stock.data.inStock ? 'Да' : 'Нет'}`);
        console.log(`   Количество: ${stock.data.quantity}\n`);
      }
    }

    // 9. Получить цену
    if (product.data.id) {
      console.log(`9️⃣ GET /api/products/${product.data.id}/price?currency=RUB`);
      const price = await makeRequest(`/api/products/${product.data.id}/price?currency=RUB`);
      console.log(`   Статус: ${price.status}`);
      if (price.data.finalPrice) {
        console.log(`   Цена: ${price.data.originalPrice} ${price.data.currency}`);
        console.log(`   Скидка: ${price.data.discount}%`);
        console.log(`   Итого: ${price.data.finalPrice} ${price.data.currency}\n`);
      }
    }

    console.log('✅ Все тесты завершены!');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

runTests();
