// Конфигурация PM2 для запуска приложения.
// Запуск:  pm2 start ecosystem.config.js
// Перезапуск с обновлением env:  pm2 restart ecosystem.config.js --update-env
module.exports = {
  apps: [
    {
      name: 'saliy_back',
      script: 'npm',
      args: 'run start:prod',
      cwd: __dirname,
      // --dns-result-order=ipv4first: на сервере исходящий IPv6 не работает,
      // а внешние хосты (smtp.gmail.com и др.) резолвятся в IPv6 первыми →
      // соединение зависает. Заставляем Node предпочитать IPv4.
      node_args: '--dns-result-order=ipv4first',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
