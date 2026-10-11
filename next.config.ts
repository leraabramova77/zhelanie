import type { NextConfig } from 'next';

// Сайт собирается в статику (папка out/) — для GitHub Pages и любого статического хостинга.
// На GitHub Pages сайт живёт в подпапке /<репозиторий>, её передаём через NEXT_PUBLIC_BASE_PATH.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig: NextConfig = {
  output: 'export',
  // Маршруты Next.js — только файлы *.next.tsx в src/app; слой FSD src/pages роутером не считается.
  pageExtensions: ['next.tsx', 'next.ts'],
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
};

export default nextConfig;
