export const EVIDENCE_MAX_BYTES = 15 * 1024 * 1024;
export const ACTA_MAX_BYTES = 25 * 1024 * 1024;

function archivoError(file, message, kind = 'validation') {
  const error = new Error(`${file?.name || 'Archivo'}: ${message}`);
  error.kind = kind;
  return error;
}

export function validarTamano(file, maxBytes) {
  if (!file || file.size === 0) throw archivoError(file, 'el archivo está vacío.');
  if (file.size > maxBytes) {
    throw archivoError(file, `supera el máximo de ${maxBytes / 1024 / 1024} MiB por archivo.`, 'size');
  }
}

function leerBytes(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsArrayBuffer(blob);
  });
}

export async function validarImagen(file, maxBytes = EVIDENCE_MAX_BYTES) {
  validarTamano(file, maxBytes);
  const bytes = await leerBytes(file.slice(0, 8));
  const jpeg = file.type === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = file.type === 'image/png' &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  if (!jpeg && !png) throw archivoError(file, 'debe ser una imagen JPEG o PNG válida. Vuelve a seleccionarla para convertirla.');
  return file;
}

export async function validarPdf(file) {
  validarTamano(file, ACTA_MAX_BYTES);
  if ((file.type && file.type !== 'application/pdf') || !/\.pdf$/i.test(file.name)) {
    throw archivoError(file, 'selecciona un archivo PDF.');
  }
  const header = String.fromCharCode(...await leerBytes(file.slice(0, 1024)));
  const tail = String.fromCharCode(...await leerBytes(file.slice(-2048)));
  if (!/^%PDF-(1\.[0-7]|2\.0)/.test(header) || !tail.includes('%%EOF')) {
    throw archivoError(file, 'no parece un PDF completo (cabecera o final incorrectos).');
  }
  // Es solo una comprobación preliminar; el backend debe validar estructura y contenido.
  return file.type ? file : new File([file], file.name, { type: 'application/pdf' });
}

async function loadImage(file) {
  if (window.createImageBitmap) {
    try {
      return await window.createImageBitmap(file);
    } catch {
      // Algunos navegadores solo decodifican ciertos formatos con HTMLImageElement.
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo decodificar la imagen.'));
    };
    image.src = url;
  });
}

function drawToCanvas(source, width, height, maxWidth) {
  const ratio = Math.min(1, maxWidth / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas no disponible');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

const canvasToBlob = (canvas, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No se pudo convertir la imagen.')), 'image/jpeg', quality);
});

export async function optimizeImage(file, {
  maxWidth = 1600,
  quality = 0.75,
  maxBytes = EVIDENCE_MAX_BYTES,
  fallbacks = [{ maxWidth: 1280, quality: 0.7 }]
} = {}) {
  if (!file?.type?.startsWith('image/')) throw archivoError(file, 'selecciona una imagen.');
  let source;
  try {
    source = await loadImage(file);
    const width = source.naturalWidth || source.width;
    const height = source.naturalHeight || source.height;
    if (!width || !height) throw new Error('Imagen sin dimensiones');
    let canvas = drawToCanvas(source, width, height, maxWidth);
    let blob = await canvasToBlob(canvas, quality);
    for (const fallback of fallbacks) {
      if (blob.size <= Math.min(10 * 1024 * 1024, maxBytes)) break;
      canvas = drawToCanvas(canvas, canvas.width, canvas.height, fallback.maxWidth);
      blob = await canvasToBlob(canvas, fallback.quality);
    }
    // No etiquetar como JPEG una conversión que el navegador devolvió en otro formato.
    if (blob.type !== 'image/jpeg') throw new Error('Conversión JPEG no disponible');
    const name = `${(file.name || 'imagen').replace(/\.[a-z0-9]+$/i, '')}-opt.jpg`;
    return await validarImagen(new File([blob], name, { type: blob.type }), maxBytes);
  } catch (error) {
    if (error.kind) throw error;
    throw archivoError(file, 'no pudo procesarse. Selecciona un JPG/PNG válido o conviértelo antes de subirlo.');
  } finally {
    source?.close?.();
  }
}

export async function optimizeMany(files, options) {
  const results = [];
  // Secuencial, sin limitar el lote a 20 ni disparar decodificaciones simultáneas.
  for (const original of Array.from(files || [])) {
    try {
      results.push({ original, file: await optimizeImage(original, options), error: '' });
    } catch (error) {
      results.push({ original, file: null, error: error.message });
    }
  }
  return results;
}
