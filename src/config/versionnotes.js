export const APP_VERSION = '1.4.0';

export const VERSION_NOTES = {
  version: APP_VERSION,
  title: 'Novedades de la versión',
  subtitle: 'Mejoras recientes en Cubica Photo App',
  date: '2026-06-22',
  items: [
    'Se agregó el módulo de tiendas para administrar puntos desde la app.',
    'Se agregó historial de informes por tienda.',
    'Se mejoró la experiencia mobile first en los módulos principales.',
    'Se agregó geolocalización en los informes generados.',
    'Se agregó subida múltiple de imágenes previas y posteriores.',
    'Se agregó limpieza automática después de compartir el informe por WhatsApp.'
  ]
};

export const VERSION_STORAGE_KEY = `cubica_version_notes_seen_${APP_VERSION}`;