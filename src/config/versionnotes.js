export const APP_VERSION = '1.4.0';

export const VERSION_NOTES = {
  version: APP_VERSION,
  title: 'Novedades de la versión',
  subtitle: 'Mejoras recientes en Cubica Photo App',
  date: '2026-06-22',
  items: [
    'Se agregó el módulo de tiendas para administrar puntos desde la app.',
    'Se agregó historial de informes por tienda.',
    'Se agregó el módulo de usuarios para crear y editar usuarios',
    'Se agregó geolocalización en los informes generados.',
    'Se agregó buscador inteligente de tiendas en el Dashboard.',
    'Se agregó subida múltiple de imágenes previas y posteriores.',
    'se agregó vista de informes generados desde la cuenta de cada técnico',
  ]
};

export const VERSION_STORAGE_KEY = `cubica_version_notes_seen_${APP_VERSION}`;