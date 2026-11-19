import { http, mensajeError } from './http';

export async function obtenerVistaPreviaInforme(informeId) {
  const response = await http.get(`/pdf/preview-link/${encodeURIComponent(informeId)}`);
  const data = response?.previewUrl ? response : response?.data;
  if (!data?.previewUrl || data.ok === false) {
    throw new Error('El backend no devolvió el enlace de vista previa.');
  }
  // El backend conserva el nombre de descarga en el token/Content-Disposition.
  // Nunca reconstruir URLs de Cloudinary/R2 ni usar url/shareUrl como alternativa.
  return { previewUrl: data.previewUrl, filename: data.filename };
}

async function abrirEnVentana(informeId, destino) {
  // Abrir antes del primer await para conservar el gesto del usuario en móviles.
  const ventana = window.open('about:blank', '_blank');
  if (!ventana) throw new Error('Permite las ventanas emergentes para visualizar el informe.');
  ventana.opener = null;
  ventana.document.open();
  ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Abriendo informe</title><style>
    body { margin:0; min-height:100vh; display:grid; place-items:center; background:#101317;
      color:#f4f4f5; font-family:Arial,sans-serif; }
    main { width:min(520px,calc(100% - 40px)); line-height:1.5; } h2 { color:#fff200; }
    </style></head><body><main><h2>Abriendo informe</h2>
    <p id="estado">Obteniendo el enlace de vista previa...</p></main></body></html>`);
  ventana.document.close();
  try {
    const data = await obtenerVistaPreviaInforme(informeId);
    if (!ventana.closed) ventana.location.replace(destino(data.previewUrl));
    return data;
  } catch (error) {
    if (!ventana.closed) {
      try {
        const estado = ventana.document.getElementById('estado');
        if (estado) estado.textContent = mensajeError(error);
        ventana.document.title = 'No se pudo abrir el informe';
      } catch {}
    }
    throw error;
  }
}

export function abrirVistaPreviaInforme(informeId) {
  return abrirEnVentana(informeId, (previewUrl) => previewUrl);
}

export function compartirInformeWhatsApp(informeId, descripcion = 'Informe técnico') {
  return abrirEnVentana(informeId, (previewUrl) =>
    `https://wa.me/?text=${encodeURIComponent(`${descripcion}\n${previewUrl}`)}`);
}
