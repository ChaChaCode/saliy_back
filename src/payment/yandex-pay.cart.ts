export interface YandexCartLine {
  productId: string;
  title: string;
  quantity: number;
  totalKop: number;
}

export interface YandexCart {
  items: {
    productId: string;
    title: string;
    quantity: { count: string };
    total: string;
  }[];
  total: { amount: string };
}

const rub = (kop: number) => (kop / 100).toFixed(2);

/**
 * Корзина для POST /v1/orders Яндекс Пэй. Яндекс отклоняет заказ, если сумма
 * позиций не равна cart.total или если total / quantity.count даёт больше двух
 * знаков после запятой. Поэтому скидка по промокоду раскладывается по строкам
 * в копейках, а строка, которая после этого не делится на количество, режется
 * на две. Доставка — отдельная позиция, как требует документация.
 */
export function buildYandexCart(
  lines: YandexCartLine[],
  discountKop: number,
  deliveryKop: number,
  expectedTotalKop: number,
): YandexCart {
  const subtotalKop = lines.reduce((sum, line) => sum + line.totalKop, 0);
  const discount = Math.min(Math.max(discountKop, 0), subtotalKop);

  const shares = lines.map((line) =>
    subtotalKop === 0 ? 0 : Math.floor((line.totalKop * discount) / subtotalKop),
  );
  let rest = discount - shares.reduce((sum, share) => sum + share, 0);
  for (let i = 0; rest > 0; i = (i + 1) % lines.length) {
    if (lines[i].totalKop - shares[i] > 0) {
      shares[i] += 1;
      rest -= 1;
    }
  }

  const items: YandexCart['items'] = [];
  lines.forEach((line, i) => {
    const totalKop = line.totalKop - shares[i];
    const push = (suffix: string, count: number, kop: number) =>
      items.push({
        productId: line.productId + suffix,
        title: line.title,
        quantity: { count: String(count) },
        total: rub(kop),
      });
    if (totalKop % line.quantity === 0) {
      push('', line.quantity, totalKop);
      return;
    }
    const unitKop = Math.floor(totalKop / line.quantity);
    push('', line.quantity - 1, unitKop * (line.quantity - 1));
    push(':1', 1, totalKop - unitKop * (line.quantity - 1));
  });

  if (deliveryKop > 0)
    items.push({
      productId: 'delivery',
      title: 'Доставка',
      quantity: { count: '1' },
      total: rub(deliveryKop),
    });

  const totalKop = subtotalKop - discount + Math.max(deliveryKop, 0);
  if (totalKop !== expectedTotalKop)
    throw new Error(
      `Сумма корзины Яндекс Пэй ${rub(totalKop)} не равна сумме заказа ${rub(expectedTotalKop)}`,
    );
  return { items, total: { amount: rub(totalKop) } };
}
