import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.YANDEX_REGION || 'ru-central1',
  endpoint: process.env.YANDEX_ENDPOINT || 'https://storage.yandexcloud.net',
  credentials: {
    accessKeyId: process.env.YANDEX_ACCESS_KEY!,
    secretAccessKey: process.env.YANDEX_SECRET_KEY!,
  },
});

async function listFiles() {
  try {
    const command = new ListObjectsV2Command({
      Bucket: process.env.YANDEX_BUCKET || 'saliy-shop',
      MaxKeys: 100,
    });

    const response = await s3Client.send(command);

    console.log('📦 Файлы в S3:');
    console.log('='.repeat(50));

    if (response.Contents) {
      response.Contents.forEach((file) => {
        console.log(`✓ ${file.Key} (${(file.Size! / 1024).toFixed(2)} KB)`);
      });
      console.log(`\n✅ Всего файлов: ${response.Contents.length}`);
    } else {
      console.log('❌ Файлы не найдены');
    }
  } catch (error: any) {
    console.error('❌ Ошибка:', error.message);
  }
}

listFiles();
