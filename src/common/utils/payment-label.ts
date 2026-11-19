const METHOD_LABELS: Record<string, string> = {
  CARD_ONLINE: 'Т-Банк (карта)',
  YANDEX_PAY: 'Яндекс Пэй',
  SBP_TOCHKA: 'Точка (СБП)',
  CARD_MANUAL: 'Карта (вручную)',
  BANK_TRANSFER: 'Оплата по реквизитам',
  CRYPTO: 'Криптовалюта',
  PAYPAL: 'PayPal',
};

// methodType из Яндекс Пэй: чем именно платил покупатель.
const DETAIL_LABELS: Record<string, string> = {
  SPLIT: 'Сплит',
  CARD: 'карта',
  SBP: 'СБП',
};

/**
 * Подпись способа оплаты для админки: «Яндекс Пэй · Сплит», «Яндекс Пэй · карта».
 * Для Яндекс Пэй без сохранённой детали (заказ ещё не оплачен или оплачен до
 * 19.11.2026 у прежнего мерчанта) — просто «Яндекс Пэй».
 */
export function paymentMethodLabel(
  paymentMethod: string | null | undefined,
  detail?: string | null,
): string {
  const base = (paymentMethod && METHOD_LABELS[paymentMethod]) || paymentMethod || '';
  if (!detail) return base;
  return `${base} · ${DETAIL_LABELS[detail] ?? detail}`;
}
