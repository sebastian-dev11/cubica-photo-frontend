import { http, resultadoIncierto } from './http';
import { API_TIMEOUTS } from './apiConfig';

function tieneValor(valor) {
  return valor !== undefined && valor !== null && valor !== '';
}

function esArchivo(valor) {
  const esFile = typeof File !== 'undefined' && valor instanceof File;
  const esBlob = typeof Blob !== 'undefined' && valor instanceof Blob;

  return esFile || esBlob;
}

function agregarCampo(formData, key, value) {
  if (!tieneValor(value)) return;

  if (typeof value === 'object' && !esArchivo(value)) {
    formData.append(key, JSON.stringify(value));
    return;
  }

  formData.append(key, value);
}

function normalizarListaArchivos(valor) {
  if (!valor) return [];

  if (typeof FileList !== 'undefined' && valor instanceof FileList) {
    return Array.from(valor);
  }

  if (Array.isArray(valor)) {
    return valor.filter(Boolean);
  }

  return [valor].filter(Boolean);
}

function agregarArchivos(formData, key, archivos) {
  normalizarListaArchivos(archivos).forEach((archivo) => {
    formData.append(key, archivo);
  });
}

function agregarListaTexto(formData, key, lista) {
  if (!Array.isArray(lista)) return;

  lista.forEach((item) => {
    formData.append(key, item || '');
  });
}

function construirPayloadEdicionBasica(data = {}) {
  const payload = {};

  [
    'title',
    'numeroIncidencia',
    'regional',
    'includesActa',
    'tiendaId',
    'motivo'
  ].forEach((key) => {
    if (tieneValor(data[key])) {
      payload[key] = data[key];
    }
  });

  if (data.actualizarGeolocalizacion === true && tieneValor(data.geolocalizacion)) {
    payload.actualizarGeolocalizacion = true;
    payload.geolocalizacion = data.geolocalizacion;
  }

  return payload;
}

function construirFormDataEdicionAvanzada(data = {}) {
  const formData = new FormData();

  agregarCampo(formData, 'title', data.title);
  agregarCampo(formData, 'numeroIncidencia', data.numeroIncidencia);
  agregarCampo(formData, 'regional', data.regional);
  agregarCampo(formData, 'includesActa', data.includesActa);
  agregarCampo(formData, 'tiendaId', data.tiendaId);
  agregarCampo(formData, 'motivo', data.motivo);

  agregarArchivos(formData, 'fotosPrevias', data.fotosPrevias);
  agregarArchivos(formData, 'fotosPosteriores', data.fotosPosteriores);
  agregarArchivos(formData, 'acta', data.acta);
  agregarArchivos(formData, 'actaImagenes', data.actaImagenes);

  agregarListaTexto(formData, 'observacionesPrevias', data.observacionesPrevias);
  agregarListaTexto(formData, 'observacionesPosteriores', data.observacionesPosteriores);
  agregarListaTexto(formData, 'ubicacionesPrevias', data.ubicacionesPrevias);
  agregarListaTexto(formData, 'ubicacionesPosteriores', data.ubicacionesPosteriores);

  return formData;
}

export function listarInformes(params = {}) {
  return http.get('/informes', params);
}

export function obtenerInforme(id) {
  return http.get(`/informes/${id}`);
}

export function obtenerUltimoInformePorSesion(sesionId) {
  return http.get('/informes/utils/ultimo-por-sesion', {
    sesionId
  });
}

export function generarInforme(sesionId, params) {
  return http.get(`/pdf/generar/${encodeURIComponent(sesionId)}`, params, {
    timeoutMs: API_TIMEOUTS.generate
  });
}

export function coincideConIntento(informe, intento, now = Date.now()) {
  const tiendaId = informe?.tiendaId?._id || informe?.tiendaId;
  const createdAt = Date.parse(informe?.createdAt);
  const startedAt = Date.parse(intento.startedAt);
  return Boolean(
    informe?._id &&
    informe.sesionId === intento.sesionId &&
    String(tiendaId || '') === intento.tiendaId &&
    String(informe.numeroIncidencia || '').trim() === intento.numeroIncidencia &&
    Number.isFinite(createdAt) && Number.isFinite(startedAt) &&
    createdAt >= startedAt && createdAt <= now
  );
}

export async function recuperarInformePorIntento(intento, {
  checks = 6,
  intervalMs = 15000,
  onCheck = () => {}
} = {}) {
  for (let index = 0; index < checks; index += 1) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, intervalMs));
    onCheck(index + 1, checks);
    try {
      const informe = await obtenerUltimoInformePorSesion(intento.sesionId);
      if (coincideConIntento(informe, intento)) return informe;
    } catch (error) {
      if (error?.response?.status !== 404 && !resultadoIncierto(error)) throw error;
    }
  }
  // Ausencia (incluso repetida) no prueba fallo: la generación puede seguir en curso.
  return null;
}

export function listarInformesPorTienda(tiendaId, params = {}) {
  return http.get(`/informes/tienda/${tiendaId}`, params);
}

export function editarInforme(id, data = {}) {
  const payload = construirPayloadEdicionBasica(data);

  return http.put(`/informes/${id}`, payload);
}

export function editarInformeAvanzado(id, data = {}) {
  const formData = construirFormDataEdicionAvanzada(data);

  return http.put(`/informes/${id}/editar-avanzado`, formData);
}

export function listarVersionesInforme(id, params = {}) {
  return http.get(`/informes/${id}/versiones`, params);
}

export function obtenerVersionInforme(id, versionId) {
  return http.get(`/informes/${id}/versiones/${versionId}`);
}

export function eliminarInforme(id) {
  return http.delete(`/informes/${id}`);
}

export function eliminarInformesBulk(ids = []) {
  return http.post('/informes/bulk-delete', {
    ids
  });
}

const informesService = {
  listarInformes,
  obtenerInforme,
  obtenerUltimoInformePorSesion,
  generarInforme,
  recuperarInformePorIntento,
  listarInformesPorTienda,
  editarInforme,
  editarInformeAvanzado,
  listarVersionesInforme,
  obtenerVersionInforme,
  eliminarInforme,
  eliminarInformesBulk
};

export default informesService;
