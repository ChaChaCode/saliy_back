# Параметры модели и состав и уход — 8 ноября 2026

Backend обновлён на сервере 8 ноября 2026. Применена миграция
`20261108140000_product_accordion_fields`, добавляющая nullable-поля
`products.model_parameters` и `products.composition_care`.
DTO создания и обновления в обоих API записи товаров принимают
`modelParameters` и `compositionCare`: обычный текст до 3000 символов,
пустую строку или JSON null для очистки. Отсутствие поля сохраняет значение.

Сборка подготовлена из текущих серверных исходников, чтобы сохранить
остальные серверные изменения. Backend пересобран и перезапущен через PM2.
Публичный `/api/health` возвращает 200; `/api/products?limit=1` содержит оба поля.
Frontend и админка в рамках этой выкладки не менялись.

Релиз: `/home/deploy/releases/product-details-20261108`.
Резервные копии исходников, сборки и Prisma Client:
`/home/deploy/backups/product-details-20261108`.
При откате восстановить исходники, dist и Prisma Client согласованно,
перезапустить `saliy_back`. Добавленные nullable-колонки можно оставить.
