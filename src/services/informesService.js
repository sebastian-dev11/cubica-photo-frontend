import { http } from './http';

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
  listarInformesPorTienda,
  editarInforme,
  editarInformeAvanzado,
  listarVersionesInforme,
  obtenerVersionInforme,
  eliminarInforme,
  eliminarInformesBulk
};

export default informesService;