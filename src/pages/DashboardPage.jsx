import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { http, mensajeError, resultadoIncierto } from '../services/http';
import { API_TIMEOUTS } from '../services/apiConfig';
import { generarInforme, recuperarInformePorIntento } from '../services/informesService';
import { abrirVistaPreviaInforme, obtenerVistaPreviaInforme } from '../services/pdfPreviewService';
import { optimizeMany, validarImagen, validarPdf, ACTA_MAX_BYTES } from '../utils/uploadFiles';
import Icon from '../components/ui/Icon';
import AppMenu from '../components/ui/AppMenu';

const APP_VERSION = '1.4.0';
const FLOW_STEP_LABELS = ['Incidencia', 'Tienda', 'Evidencias', 'Acta', 'Generar informe'];

const VERSION_NOTES = {
  version: APP_VERSION,
  title: 'Novedades de la versión',
  subtitle: 'Mejoras recientes en Cubica Photo App',
  date: '2026-06-22',
  items: [
    'Se agregó el módulo de tiendas para administrar puntos desde la app.',
    'Se agregó historial de informes por tienda.',
    'Se mejoró la experiencia mobile first en los módulos principales.',
    'Se agregó geolocalización en los informes generados.',
    'Se agregó buscador inteligente de tiendas en el Dashboard.',
    'Se agregó subida múltiple de imágenes previas y posteriores.',
    'Se agregó cambio automático entre previa y posterior al subir evidencias.',
    'Se limpian los campos y la evidencia temporal en la nube al generar el informe.'
  ]
};

const VERSION_STORAGE_KEY = `cubica_version_notes_seen_${APP_VERSION}`;

const intentoStorageKey = (sesionId) => `cubica_generacion_pendiente_${sesionId}`;

function leerIntentoPendiente() {
  try {
    const sesionId = localStorage.getItem('sesionId');
    const intento = JSON.parse(sessionStorage.getItem(intentoStorageKey(sesionId)));
    return intento?.sesionId === sesionId && intento?.startedAt && intento?.details ? intento : null;
  } catch {
    return null;
  }
}

const GlassSelect = ({
  value,
  onChange,
  options,
  placeholder = 'Selecciona...',
  disabled = false,
  ariaLabel
}) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 280 });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const idx = options.findIndex((o) => o.value === value);
    setActiveIndex(idx >= 0 ? idx : 0);

    const rect = triggerRef.current?.getBoundingClientRect?.() || {};
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(Math.max(rect.width || 280, 260), 520);
    const left = Math.min(Math.max((rect.left || 0), 8), vw - width - 8);
    const topCandidate = (rect.bottom || 0) + 6;

    setPanelPos({
      top: Math.min(topCandidate, vh - 120),
      left,
      width
    });

    setTimeout(() => panelRef.current?.focus?.(), 0);

    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    const onResize = () => setOpen(false);

    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open, value, options]);

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
    triggerRef.current?.focus?.();
  };

  const onKeyDownTrigger = (e) => {
    if (disabled) return;

    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onKeyDownPanel = (e) => {
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = options[activeIndex];
      if (opt) handleSelect(opt.value);
    }
  };

  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <div className={`glass-select ${disabled ? 'disabled' : ''}`}>
      <button
        type="button"
        className="select-trigger"
        onClick={() => !disabled && setOpen(true)}
        onKeyDown={onKeyDownTrigger}
        ref={triggerRef}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || placeholder}
        disabled={disabled}
      >
        <span className={`selected ${!selectedLabel ? 'placeholder' : ''}`}>
          {selectedLabel || placeholder}
        </span>

        <svg className="chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>

      {open && createPortal(
        <div className="dropdown-overlay" onClick={() => setOpen(false)} role="presentation">
          <div
            className="dropdown-panel"
            role="listbox"
            aria-label={ariaLabel || placeholder}
            tabIndex={0}
            ref={panelRef}
            onKeyDown={onKeyDownPanel}
            style={{
              top: panelPos.top,
              left: panelPos.left,
              width: panelPos.width
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {options.length === 0 ? (
              <div className="option empty">Sin opciones</div>
            ) : options.map((opt, idx) => {
              const isSel = value === opt.value;
              const isAct = idx === activeIndex;

              return (
                <div
                  key={String(opt.value) + idx}
                  className={`option ${isSel ? 'selected' : ''} ${isAct ? 'active' : ''}`}
                  role="option"
                  aria-selected={isSel}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => handleSelect(opt.value)}
                >
                  <span className="label">{opt.label}</span>
                  {isSel && <span className="check">Seleccionado</span>}
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const norm = (s) => String(s || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const useAnimatedNumber = (value, duration = 500) => {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  const rafRef = useRef(null);

  useEffect(() => {
    const from = displayRef.current;
    const to = value;
    const start = performance.now();

    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = t * (2 - t);
      const v = Math.round(from + (to - from) * eased);

      displayRef.current = v;
      setDisplay(v);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [value, duration]);

  return display;
};

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 560px), (pointer: coarse)');
    const update = () => setIsMobile(mq.matches);

    update();

    if (mq.addEventListener) {
      mq.addEventListener('change', update);
    } else {
      mq.addListener(update);
    }

    return () => {
      if (mq.removeEventListener) {
        mq.removeEventListener('change', update);
      } else {
        mq.removeListener(update);
      }
    };
  }, []);

  return isMobile;
};

function obtenerUbicacionActual() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('geolocation_unavailable'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000
    });
  });
}

function normalizarUbicacion(position) {
  const coords = position?.coords || {};
  const latitud = Number(coords.latitude);
  const longitud = Number(coords.longitude);

  if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) {
    return null;
  }

  return {
    latitud,
    longitud,
    precision: Number.isFinite(Number(coords.accuracy)) ? Number(coords.accuracy) : null,
    altitud: Number.isFinite(Number(coords.altitude)) ? Number(coords.altitude) : null,
    precisionAltitud: Number.isFinite(Number(coords.altitudeAccuracy)) ? Number(coords.altitudeAccuracy) : null,
    fechaCaptura: new Date(position.timestamp || Date.now()).toISOString(),
    mapsUrl: `https://www.google.com/maps?q=${latitud},${longitud}`,
    geoOrigen: 'browser'
  };
}

function getMensajeGeoError(error) {
  if (error?.message === 'geolocation_unavailable') {
    return 'Este dispositivo no tiene geolocalización disponible.';
  }

  if (error?.code === 1) {
    return 'Permiso de ubicación denegado. El informe se puede generar sin GPS.';
  }

  if (error?.code === 2) {
    return 'No se pudo obtener la ubicación actual. Revisa el GPS del dispositivo.';
  }

  if (error?.code === 3) {
    return 'La ubicación tardó demasiado. Puedes intentar nuevamente.';
  }

  return 'No se pudo obtener la ubicación.';
}

async function serverResetSession(curId) {
  if (!curId) return false;

  try {
    const data = await http.post(`/pdf/session/reset/${encodeURIComponent(curId)}`, undefined, {
      timeoutMs: API_TIMEOUTS.upload
    });
    return data?.ok === true;
  } catch (e) {
    console.error('No se pudo resetear la sesión en servidor:', e);
    return false;
  }
}

function limpiarSesionLocal() {
  localStorage.removeItem('token');
  localStorage.removeItem('sesionId');
  localStorage.removeItem('nombreTecnico');
  localStorage.removeItem('isAdmin');
  localStorage.removeItem('userId');
  localStorage.removeItem('usuario');
  localStorage.removeItem('rol');
  localStorage.removeItem('dashStep');
  localStorage.removeItem('numeroIncidencia');
}

const DashboardPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [intentoInicial] = useState(leerIntentoPendiente);

  const [step, setStep] = useState(() => {
    if (intentoInicial) return 5;
    const v = Number(localStorage.getItem('dashStep') || 1);
    return Number.isFinite(v) && v >= 1 && v <= 5 ? v : 1;
  });

  const [sesionId, setSesionId] = useState(() => localStorage.getItem('sesionId') || '');
  const [numeroIncidencia, setNumeroIncidencia] = useState(() => intentoInicial?.numeroIncidencia || localStorage.getItem('numeroIncidencia') || '');
  const token = localStorage.getItem('token') || '';
  const nombreTecnico = localStorage.getItem('nombreTecnico') || 'Técnico';
  const isAdmin = localStorage.getItem('isAdmin') === '1' || localStorage.getItem('isAdmin') === 'true';

  const [imagenesEvidencia, setImagenesEvidencia] = useState([]);
  const imagen = imagenesEvidencia[0]?.file || null;
  const [evidenceProgress, setEvidenceProgress] = useState({ confirmed: 0, total: 0 });
  const nextFileId = useRef(0);
  const [tipo, setTipo] = useState('previa');
  const [observacion, setObservacion] = useState('');

  const [cntPrevias, setCntPrevias] = useState(intentoInicial?.details.cntPrevias || 0);
  const [cntPosteriores, setCntPosteriores] = useState(intentoInicial?.details.cntPosteriores || 0);
  const [bumpPrev, setBumpPrev] = useState(false);
  const [bumpPost, setBumpPost] = useState(false);

  const [acta, setActa] = useState(null);
  const [actaImgs, setActaImgs] = useState([]);
  const [actaOK, setActaOK] = useState(intentoInicial?.details.actaOK || false);
  const [actaError, setActaError] = useState('');

  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [imgPreviewUrl, setImgPreviewUrl] = useState(null);
  const [evidPreviewUrl, setEvidPreviewUrl] = useState(null);

  const pdfRef = useRef(null);
  const imgsRef = useRef(null);
  const evidenciaRef = useRef(null);
  const flowProgressRef = useRef(null);
  const evidenceCardRef = useRef(null);
  const actaUploadRef = useRef(null);
  const uploadStatusRef = useRef(null);
  const previousStepRef = useRef(step);

  const scrollToFlowTarget = useCallback((targetRef, alignment = 'start') => {
    if (!isMobile || !targetRef?.current) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    window.requestAnimationFrame(() => {
      const target = targetRef.current;
      if (!target) return;

      const headerBottom = document.querySelector('.dash-root .topbar')?.getBoundingClientRect().bottom || 0;
      const targetRect = target.getBoundingClientRect();
      const topOffset = headerBottom + 14;
      const availableHeight = Math.max(0, window.innerHeight - topOffset - 14);
      const alignedOffset = alignment === 'center'
        ? topOffset + Math.max(0, (availableHeight - targetRect.height) / 2)
        : topOffset;

      window.scrollTo({
        top: Math.max(0, window.scrollY + targetRect.top - alignedOffset),
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
    });
  }, [isMobile]);

  useEffect(() => {
    if (previousStepRef.current === step) return;
    previousStepRef.current = step;
    scrollToFlowTarget(flowProgressRef);
  }, [step, scrollToFlowTarget]);

  const [mensaje, setMensaje] = useState('');
  const [mensajeActa, setMensajeActa] = useState('');
  const [cargando, setCargando] = useState(false);
  const [cargandoActa, setCargandoActa] = useState(false);
  const [preparando, setPreparando] = useState('');
  const [reseteando, setReseteando] = useState(false);
  const operationRef = useRef(null);

  const [genLoading, setGenLoading] = useState(false);
  const [generatedReport, setGeneratedReport] = useState(null);
  const [genPreviewUrl, setGenPreviewUrl] = useState('');
  const [genErr, setGenErr] = useState('');
  const [genStatus, setGenStatus] = useState(intentoInicial ? 'uncertain' : 'idle');
  const [genMessage, setGenMessage] = useState(intentoInicial ? 'Resultado incierto. Consulta si el informe quedó guardado antes de continuar.' : '');
  const intentoRef = useRef(intentoInicial);
  const [generatedReportDetails, setGeneratedReportDetails] = useState(null);
  const ocupado = Boolean(cargando || cargandoActa || preparando || genLoading || reseteando);
  const bloqueado = ocupado || genStatus === 'uncertain';
  const bloqueadoAhora = () => Boolean(operationRef.current) || genStatus === 'uncertain';

  useEffect(() => {
    if (!bloqueado) return;
    const beforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [bloqueado]);

  const [geoStatus, setGeoStatus] = useState(intentoInicial?.geolocalizacion ? 'ready' : 'idle');
  const [geoMessage, setGeoMessage] = useState('');
  const [geolocalizacion, setGeolocalizacion] = useState(intentoInicial?.geolocalizacion || null);

  const [tiendas, setTiendas] = useState([]);
  const [selectedTienda, setSelectedTienda] = useState(intentoInicial?.tiendaId || '');
  const [searchText, setSearchText] = useState('');
  const [tiendaSuggestOpen, setTiendaSuggestOpen] = useState(false);
  const [showVersionNotes, setShowVersionNotes] = useState(false);
  const [geoConfirmOpen, setGeoConfirmOpen] = useState(false);
  const geoConfirmResolveRef = useRef(null);
    useEffect(() => {
    if (!token || !sesionId) {
      navigate('/');
    }
  }, [navigate, token, sesionId]);

  useEffect(() => {
    const versionVista = localStorage.getItem(VERSION_STORAGE_KEY);

    if (versionVista !== APP_VERSION) {
      setShowVersionNotes(true);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (geoConfirmResolveRef.current) {
        geoConfirmResolveRef.current(false);
        geoConfirmResolveRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('dashStep', String(step));
  }, [step]);

  useEffect(() => {
    localStorage.setItem('numeroIncidencia', numeroIncidencia || '');
  }, [numeroIncidencia]);

  useEffect(() => {
    const fetchTiendas = async () => {
      try {
        const data = await http.get('/tiendas');
        const lista = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        setTiendas(lista);
      } catch (error) {
        console.error('Error al obtener tiendas del backend:', error);
        setTiendas([]);
      }
    };

    fetchTiendas();
  }, []);

  const filteredTiendas = useMemo(() => {
    const q = norm(searchText).trim();

    return tiendas
      .filter((tienda) => !q || norm(tienda?.nombre).trim().includes(q))
      .sort((a, b) => {
        const nombreA = norm(a?.nombre).trim();
        const nombreB = norm(b?.nombre).trim();
        const comienzaA = q && nombreA.startsWith(q) ? 0 : 1;
        const comienzaB = q && nombreB.startsWith(q) ? 0 : 1;

        return comienzaA - comienzaB ||
          (a?.nombre || '').localeCompare((b?.nombre || ''), 'es', { sensitivity: 'base' });
      });
  }, [tiendas, searchText]);

  const selectedTiendaObj = useMemo(() => {
    return tiendas.find((t) => t._id === selectedTienda) || null;
  }, [tiendas, selectedTienda]);

  const tiendaSuggestions = useMemo(() => {
    return filteredTiendas.slice(0, isMobile ? 8 : 10);
  }, [filteredTiendas, isMobile]);

  const showTiendaSuggestions =
    step === 2 &&
    tiendaSuggestOpen &&
    String(searchText || '').trim().length > 0;

  const seleccionarTiendaSugerida = (tienda) => {
    if (!tienda?._id || step > 2 || bloqueadoAhora() || cntPrevias + cntPosteriores > 0) return;

    setSelectedTienda(tienda._id);
    setSearchText(tienda.nombre || '');
    setTiendaSuggestOpen(false);
    // Los contadores corresponden a subidas confirmadas; no se borran al reabrir el selector.
    setGeolocalizacion(null);
    setGeoStatus('idle');
    setGeoMessage('');
  };

  useEffect(() => {
    if (!bloqueado && tiendas.length > 0 && selectedTienda && !filteredTiendas.some((t) => t._id === selectedTienda)) {
      setSelectedTienda('');
      setGeolocalizacion(null);
      setGeoStatus('idle');
      setGeoMessage('');
    }
  }, [filteredTiendas, selectedTienda, bloqueado, tiendas.length]);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);

  useEffect(() => {
    if (!acta) {
      setPdfPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(acta);

    setPdfPreviewUrl(url);
  }, [acta]);

  useEffect(() => {
    return () => {
      if (imgPreviewUrl) URL.revokeObjectURL(imgPreviewUrl);
    };
  }, [imgPreviewUrl]);

  useEffect(() => {
    if (!actaImgs || actaImgs.length === 0) {
      setImgPreviewUrl(null);
      return;
    }

    const first = actaImgs[0]?.file;

    if (first && first.type?.startsWith('image/')) {
      const url = URL.createObjectURL(first);

      setImgPreviewUrl(url);
    } else {
      setImgPreviewUrl(null);
    }
  }, [actaImgs]);

  useEffect(() => {
    return () => {
      if (evidPreviewUrl) URL.revokeObjectURL(evidPreviewUrl);
    };
  }, [evidPreviewUrl]);

  useEffect(() => {
    if (!imagen) {
      setEvidPreviewUrl(null);
      return;
    }

    if (imagen && imagen.type?.startsWith('image/')) {
      const url = URL.createObjectURL(imagen);

      setEvidPreviewUrl(url);
    } else {
      setEvidPreviewUrl(null);
    }
  }, [imagen]);

  const animPrev = useAnimatedNumber(cntPrevias, 450);
  const animPost = useAnimatedNumber(cntPosteriores, 450);

  useEffect(() => {
    if (cntPrevias >= 0) {
      setBumpPrev(true);
      const t = setTimeout(() => setBumpPrev(false), 340);
      return () => clearTimeout(t);
    }
  }, [cntPrevias]);

  useEffect(() => {
    if (cntPosteriores >= 0) {
      setBumpPost(true);
      const t = setTimeout(() => setBumpPost(false), 340);
      return () => clearTimeout(t);
    }
  }, [cntPosteriores]);

  const clearEvid = (e) => {
    e?.stopPropagation?.();
    if (bloqueadoAhora()) return;
    setImagenesEvidencia([]);
    setEvidenceProgress({ confirmed: 0, total: 0 });

    if (evidenciaRef.current) evidenciaRef.current.value = '';

    if (evidPreviewUrl) {
      URL.revokeObjectURL(evidPreviewUrl);
      setEvidPreviewUrl(null);
    }
  };

  const clearPdf = (e, opts = {}) => {
    e?.stopPropagation?.();
    if (!opts.keepStatus && bloqueadoAhora()) return;

    const keepStatus = !!opts.keepStatus;

    setActa(null);
    setActaError('');

    if (!keepStatus) setActaOK(false);

    if (pdfRef.current) pdfRef.current.value = '';

    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
  };

  const clearImgs = (e, opts = {}) => {
    e?.stopPropagation?.();
    if (!opts.keepStatus && bloqueadoAhora()) return;

    const keepStatus = !!opts.keepStatus;

    setActaImgs([]);

    if (!keepStatus) setActaOK(false);

    if (imgsRef.current) imgsRef.current.value = '';

    if (imgPreviewUrl) {
      URL.revokeObjectURL(imgPreviewUrl);
      setImgPreviewUrl(null);
    }
  };

  const onSelectEvidencia = async (e) => {
    if (bloqueadoAhora()) return;
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    operationRef.current = 'prepare-evidence';
    setPreparando('evidence');
    try {
      setMensaje(`Optimizando ${files.length} imágenes...`);
      const results = await optimizeMany(files);
      setImagenesEvidencia(results.map((item) => ({
        ...item,
        id: ++nextFileId.current,
        status: item.error ? 'invalid' : 'ready'
      })));
      setEvidenceProgress({ confirmed: 0, total: files.length });
      setMensaje(results.some((item) => item.error)
        ? 'Hay archivos que no pudieron procesarse. Quítalos o corrige la selección; no se enviarán los originales.'
        : `${files.length} imágenes listas para subir.`);
      scrollToFlowTarget(evidenceCardRef, 'center');
    } finally {
      operationRef.current = null;
      setPreparando('');
    }
  };

  const quitarEvidencia = (id) => {
    if (bloqueadoAhora()) return;
    setImagenesEvidencia((items) => items.filter((item) => item.id !== id));
    setEvidenceProgress((progress) => ({ ...progress, total: progress.total - 1 }));
  };

  const handleSubirImagen = async (e) => {
    e.preventDefault();
    if (bloqueadoAhora()) return;
    const imagenesParaSubir = imagenesEvidencia.filter((item) => item.file);
    if (imagenesParaSubir.length === 0 || !tipo || !selectedTienda) {
      setMensaje('Por favor completa todos los campos.');
      return;
    }
    const contexto = { tipo, sesionId, ubicacion: selectedTienda, observacion };
    operationRef.current = 'evidence';
    setCargando(true);
    setMensaje('Subiendo imágenes de forma secuencial...');
    scrollToFlowTarget(flowProgressRef);
    let actual;
    try {
      for (const item of imagenesParaSubir) {
        actual = item;
        const datos = item.contexto || contexto;
        setImagenesEvidencia((items) => items.map((entry) => entry.id === item.id
          ? { ...entry, contexto: datos, status: 'uploading', error: '' } : entry));
        await validarImagen(item.file);
        const formData = new FormData();
        formData.append('imagen', item.file);
        Object.entries(datos).forEach(([key, value]) => formData.append(key, value));
        const data = await http.post('/imagenes/subir', formData, { timeoutMs: API_TIMEOUTS.upload });
        if (!data?.url || data.sesionId !== datos.sesionId || data.tipo !== datos.tipo || data.ubicacion !== datos.ubicacion) {
          const error = new Error('El servidor no confirmó el guardado de la imagen.');
          error.kind = 'protocol';
          throw error;
        }
        // Confirmar cada archivo antes de continuar. El reintento solo usa la cola restante.
        setImagenesEvidencia((items) => items.filter((entry) => entry.id !== item.id));
        setEvidenceProgress((progress) => ({ ...progress, confirmed: progress.confirmed + 1 }));
        if (datos.tipo === 'previa') setCntPrevias((value) => value + 1);
        else setCntPosteriores((value) => value + 1);
      }
      if (imagenesParaSubir.length === imagenesEvidencia.length) {
        setTipo(tipo === 'previa' ? 'posterior' : 'previa');
        setObservacion('');
        if (evidenciaRef.current) evidenciaRef.current.value = '';
        setMensaje('Imágenes y observaciones guardadas correctamente.');
      } else {
        setMensaje('Subidas confirmadas. Corrige o quita los archivos que no pudieron procesarse.');
      }
    } catch (error) {
      const incierto = resultadoIncierto(error);
      const detalle = `${actual.original.name}: ${mensajeError(error)}`;
      setImagenesEvidencia((items) => items.map((item) => item.id === actual.id
        ? { ...item, status: incierto ? 'uncertain' : 'error', error: detalle } : item));
      setMensaje(`${detalle} Se conservaron las subidas confirmadas y los archivos pendientes.${
        incierto ? ' El servidor podría haber guardado este archivo: reintentarlo manualmente podría duplicarlo. No se reintentará automáticamente.' : ''
      }`);
    } finally {
      operationRef.current = null;
      setCargando(false);
    }
  };

  const handleSeleccionarPdf = async (e) => {
    if (bloqueadoAhora()) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setActaOK(false);
    setActa(file);
    setActaError('');
    operationRef.current = 'prepare-acta';
    setPreparando('acta');
    try {
      setActa(await validarPdf(file));
      setMensajeActa('Comprobación preliminar del PDF superada. El backend debe validar su estructura definitiva.');
    } catch (error) {
      setActaError(mensajeError(error));
      setMensajeActa(mensajeError(error));
    } finally {
      operationRef.current = null;
      setPreparando('');
    }
  };

  const handleSeleccionarImagenesActa = async (e) => {
    if (bloqueadoAhora()) return;
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setActaOK(false);
    operationRef.current = 'prepare-acta';
    setPreparando('acta');
    setMensajeActa(`Preparando ${files.length} imágenes del acta...`);
    try {
      const results = await optimizeMany(files, {
        maxWidth: 1800,
        quality: 0.85,
        maxBytes: ACTA_MAX_BYTES,
        fallbacks: [{ maxWidth: 1600, quality: 0.8 }]
      });
      setActaImgs(results);
      setMensajeActa(results.some((item) => item.error)
        ? 'Corrige o quita las imágenes indicadas antes de subir el acta. No se enviarán los originales.'
        : `${results.length} imágenes listas para subir.`);
      scrollToFlowTarget(actaUploadRef, 'center');
    } finally {
      operationRef.current = null;
      setPreparando('');
    }
  };

  const handleSubirActa = async (e) => {
    e.preventDefault();
    if (bloqueadoAhora()) return;
    setActaOK(false);
    if (!acta && actaImgs.length === 0) {
      setMensajeActa('Selecciona un PDF o una imagen del acta');
      return;
    }
    if (actaError || actaImgs.some((item) => item.error)) {
      setMensajeActa('Corrige o quita los archivos que no pudieron validarse.');
      return;
    }
    operationRef.current = 'acta';
    setCargandoActa(true);
    setMensajeActa('Subiendo acta...');
    scrollToFlowTarget(flowProgressRef);
    try {
      const formData = new FormData();
      formData.append('sesionId', sesionId);
      if (acta) formData.append('acta', await validarPdf(acta));
      for (const item of actaImgs) {
        formData.append('imagenes', await validarImagen(item.file, ACTA_MAX_BYTES));
      }
      const data = await http.post('/acta/subir', formData, { timeoutMs: API_TIMEOUTS.upload });
      if (data?.ok !== true || data?.persistido !== true) {
        setMensajeActa('El servidor no confirmó la persistencia del acta. No está lista; se conserva la selección. Revisa el guardado antes de reintentar: algunas páginas podrían haberse almacenado.');
        return;
      }
      setMensajeActa('Acta guardada y persistida correctamente.');
      clearPdf(null, { keepStatus: true });
      clearImgs(null, { keepStatus: true });
      setActaOK(true);
      scrollToFlowTarget(flowProgressRef);
    } catch (error) {
      setMensajeActa(`${mensajeError(error)} Se conserva la selección.${
        resultadoIncierto(error) ? ' El guardado es incierto; un reintento manual podría duplicar páginas.' : ''
      }`);
    } finally {
      operationRef.current = null;
      setCargandoActa(false);
    }
  };

  const pedirConfirmacionGeolocalizacion = () => {
    if (geoConfirmResolveRef.current) {
      geoConfirmResolveRef.current(false);
    }

    return new Promise((resolve) => {
      geoConfirmResolveRef.current = resolve;
      setGeoConfirmOpen(true);
    });
  };

  const responderConfirmacionGeolocalizacion = (respuesta) => {
    if (geoConfirmResolveRef.current) {
      geoConfirmResolveRef.current(respuesta);
    }

    geoConfirmResolveRef.current = null;
    setGeoConfirmOpen(false);
  };

  const solicitarGeolocalizacion = async () => {
    if (!navigator.geolocation) {
      setGeoStatus('unavailable');
      setGeoMessage('Este dispositivo no tiene geolocalización disponible.');
      return null;
    }

    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      setGeoStatus('unavailable');
      setGeoMessage('La geolocalización requiere HTTPS para funcionar.');
      return null;
    }

    setGeoStatus('loading');
    setGeoMessage('Solicitando ubicación GPS...');

    try {
      const position = await obtenerUbicacionActual();
      const geo = normalizarUbicacion(position);

      if (!geo) {
        setGeoStatus('error');
        setGeoMessage('No se pudo leer la ubicación del dispositivo.');
        return null;
      }

      const precisionTexto =
        geo.precision !== null
          ? `Precisión aproximada: ${Math.round(geo.precision)} m`
          : 'Ubicación capturada correctamente';

      setGeolocalizacion(geo);
      setGeoStatus('ready');
      setGeoMessage(precisionTexto);

      return geo;
    } catch (error) {
      console.error('Error obteniendo geolocalización:', error);

      const msg = getMensajeGeoError(error);

      setGeoStatus('error');
      setGeoMessage(msg);

      return null;
    }
  };

  const confirmarYCapturarGeolocalizacion = async () => {
    const estaEnTienda = await pedirConfirmacionGeolocalizacion();

    if (!estaEnTienda) {
      setGeolocalizacion(null);
      setGeoStatus('skipped');
      setGeoMessage('No se capturó la ubicación porque indicaste que no estás en la tienda. El informe se generará sin GPS.');
      return null;
    }

    return await solicitarGeolocalizacion();
  };

  const handleCapturarUbicacion = async () => {
    if (bloqueadoAhora()) return;
    operationRef.current = 'geo';
    setPreparando('geo');
    try {
      await confirmarYCapturarGeolocalizacion();
    } finally {
      operationRef.current = null;
      setPreparando('');
    }
  };

  const limpiarCamposInforme = (preserveGeneratedReport = false) => {
    try {
      if (evidenciaRef.current) evidenciaRef.current.value = '';
      if (pdfRef.current) pdfRef.current.value = '';
      if (imgsRef.current) imgsRef.current.value = '';

      if (evidPreviewUrl) URL.revokeObjectURL(evidPreviewUrl);
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      if (imgPreviewUrl) URL.revokeObjectURL(imgPreviewUrl);
    } catch {}

    setImagenesEvidencia([]);
    setEvidenceProgress({ confirmed: 0, total: 0 });
    setActa(null);
    setActaError('');
    setActaImgs([]);
    setEvidPreviewUrl(null);
    setPdfPreviewUrl(null);
    setImgPreviewUrl(null);
    setNumeroIncidencia('');
    setSelectedTienda('');
    setSearchText('');
    setTiendaSuggestOpen(false);
    setTipo('previa');
    setObservacion('');
    setCntPrevias(0);
    setCntPosteriores(0);
    setActaOK(false);
    setMensaje('');
    setMensajeActa('');
    setCargando(false);
    setCargandoActa(false);
    setGeoStatus('idle');
    setGeoMessage('');
    setGeolocalizacion(null);
    setGeoConfirmOpen(false);
    setStep(preserveGeneratedReport ? 5 : 1);
    if (!preserveGeneratedReport) setGenLoading(false);
    localStorage.removeItem('numeroIncidencia');
    localStorage.setItem('dashStep', preserveGeneratedReport ? '5' : '1');

    if (geoConfirmResolveRef.current) {
      geoConfirmResolveRef.current(false);
      geoConfirmResolveRef.current = null;
    }

    if (!preserveGeneratedReport) {
      setGeneratedReport(null);
      setGenPreviewUrl('');
      setGenErr('');
      setGenStatus('idle');
      setGenMessage('');
      setGeneratedReportDetails(null);
    }
  };

  const olvidarIntento = () => {
    intentoRef.current = null;
    try {
      sessionStorage.removeItem(intentoStorageKey(sesionId));
    } catch {}
  };

  const confirmarInformeGenerado = async (data, intento) => {
    const id = data.id || data._id;
    setGeneratedReport({ id, filename: data.filename || '' });
    setGenPreviewUrl(data.previewUrl || '');
    setGeneratedReportDetails(intento.details);
    setGenStatus('success');
    setGenMessage('Informe guardado correctamente.');
    olvidarIntento();

    // Solo tras confirmar el informe se descartan también las evidencias sobrantes.
    limpiarCamposInforme(true);
    const avisos = [];
    try {
      const preview = await obtenerVistaPreviaInforme(id);
      setGenPreviewUrl(preview.previewUrl);
      setGeneratedReport({ id, filename: preview.filename || data.filename || '' });
    } catch (error) {
      if (!data.previewUrl) avisos.push(`Informe guardado. No se pudo obtener la vista previa: ${mensajeError(error)} Usa “Ver PDF” para consultarla nuevamente.`);
    }
    if (!await serverResetSession(intento.sesionId)) {
      avisos.push('El informe está guardado, pero no se confirmó la limpieza de la sesión. “Nuevo informe” volverá a intentar la limpieza.');
    }
    setGenErr(avisos.join(' '));
  };

  const consultarResultado = async (intento) => {
    setGenStatus('checking');
    setGenErr('');
    try {
      const informe = await recuperarInformePorIntento(intento, {
        onCheck: (index, total) => setGenMessage(`Comprobando si el informe se guardó (${index}/${total}). Puede seguir generándose...`)
      });
      if (informe) {
        await confirmarInformeGenerado(informe, intento);
        return;
      }
    } catch (error) {
      setGenErr(mensajeError(error));
    }
    setGenStatus('uncertain');
    setGenMessage('Resultado incierto: todavía no se pudo confirmar un informe de este intento. Un 404 no significa que haya fallado. Conservamos los datos; consulta nuevamente antes de continuar.');
  };

  const handleConsultarResultado = async () => {
    if (operationRef.current || !intentoRef.current) return;
    operationRef.current = 'check-report';
    setGenLoading(true);
    try {
      await consultarResultado(intentoRef.current);
    } finally {
      operationRef.current = null;
      setGenLoading(false);
    }
  };

  const handleGenerarPDF = async () => {
    if (bloqueadoAhora() || generatedReport) return;
    if (!numeroIncidencia || !String(numeroIncidencia).trim()) {
      window.alert('Ingresa la incidencia antes de generar el PDF.');
      return;
    }

    if (!selectedTienda) {
      window.alert('Selecciona una tienda antes de generar el PDF.');
      return;
    }

    if (cntPrevias < 1 || cntPosteriores < 1) {
      window.alert('Debes subir al menos 1 imagen PREVIA y 1 POSTERIOR para generar el informe.');
      return;
    }
    if (!actaOK || acta || actaImgs.length || imagenesEvidencia.length) {
      setGenErr('Completa las subidas pendientes y confirma el guardado del acta antes de generar.');
      return;
    }

    operationRef.current = 'generate';
    setGenErr('');
    setGenPreviewUrl('');
    setGenLoading(true);
    setGenStatus('generating');
    setGenMessage('Generando informe. Los lotes grandes pueden tardar varios minutos; mantén esta página abierta.');

    try {
      let geoParaInforme = geolocalizacion;

      if (!geoParaInforme) {
        geoParaInforme = await confirmarYCapturarGeolocalizacion();
      }

      const params = {
        tiendaId: selectedTienda,
        format: 'json',
        numeroIncidencia: String(numeroIncidencia).trim()
      };

      if (geoParaInforme) {
        params.latitud = geoParaInforme.latitud;
        params.longitud = geoParaInforme.longitud;
        params.precision = geoParaInforme.precision;
        params.altitud = geoParaInforme.altitud;
        params.precisionAltitud = geoParaInforme.precisionAltitud;
        params.fechaCaptura = geoParaInforme.fechaCaptura;
        params.mapsUrl = geoParaInforme.mapsUrl;
        params.geoOrigen = geoParaInforme.geoOrigen;
      }

      const tiendaLabel = selectedTiendaObj
        ? `${selectedTiendaObj.nombre} - ${selectedTiendaObj.regional ? `${selectedTiendaObj.regional} | ` : ''}${selectedTiendaObj.departamento}, ${selectedTiendaObj.ciudad}`
        : '';
      const intento = {
        sesionId,
        tiendaId: selectedTienda,
        numeroIncidencia: params.numeroIncidencia,
        startedAt: new Date().toISOString(),
        geolocalizacion: geoParaInforme,
        details: { numeroIncidencia: params.numeroIncidencia, cntPrevias, cntPosteriores, actaOK, tiendaLabel }
      };
      intentoRef.current = intento;
      try {
        sessionStorage.setItem(intentoStorageKey(sesionId), JSON.stringify(intento));
      } catch {}
      const data = await generarInforme(sesionId, params);
      if (data?.ok !== true || !data?.id) {
        const error = new Error('El servidor no confirmó el informe generado.');
        error.kind = 'protocol';
        throw error;
      }
      await confirmarInformeGenerado(data, intento);
    } catch (err) {
      if (intentoRef.current && resultadoIncierto(err)) {
        await consultarResultado(intentoRef.current);
      } else {
        olvidarIntento();
        setGenStatus('idle');
        setGenMessage('');
        setGenErr(mensajeError(err));
      }
    } finally {
      operationRef.current = null;
      setGenLoading(false);
    }
  };

  const resetFlow = async () => {
    if (bloqueadoAhora()) return;
    operationRef.current = 'reset';
    setReseteando(true);
    try {
      if (await serverResetSession(sesionId)) {
        limpiarCamposInforme();
      } else {
        setGenErr('No se confirmó la limpieza. Conservamos los datos y el enlace del informe; vuelve a intentar “Nuevo informe”.');
      }
    } finally {
      operationRef.current = null;
      setReseteando(false);
    }
  };

  const handleVerInforme = async (event) => {
    event.preventDefault();
    if (!generatedReport?.id) return;
    try {
      const preview = await abrirVistaPreviaInforme(generatedReport.id);
      setGenPreviewUrl(preview.previewUrl);
      setGeneratedReport((report) => ({ ...report, filename: preview.filename || report.filename }));
    } catch (error) {
      setGenErr(mensajeError(error));
    }
  };

  const handleShareWhatsApp = () => {
    const urlCompartir = genPreviewUrl;

    if (!urlCompartir) return;

    const tiendaLabel = generatedReportDetails?.tiendaLabel || '';
    const texto = `Informe técnico${tiendaLabel ? ` - ${tiendaLabel}` : ''}\n${urlCompartir}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(texto)}`;

    const popup = window.open(waUrl, '_blank');

    if (popup) {
      popup.opener = null;
    } else {
      window.location.href = waUrl;
    }
  };

  const cerrarVersionNotes = () => {
    localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);
    setShowVersionNotes(false);
  };

  const handleCerrarSesion = async () => {
    if (bloqueadoAhora()) return;
    operationRef.current = 'logout';
    setReseteando(true);
    try {
      await serverResetSession(sesionId);
    } catch (e) {
      console.error('Falló limpieza backend al cerrar sesión:', e);
    }

    try {
      if (pdfRef.current) pdfRef.current.value = '';
      if (imgsRef.current) imgsRef.current.value = '';
      if (evidenciaRef.current) evidenciaRef.current.value = '';

      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      if (imgPreviewUrl) URL.revokeObjectURL(imgPreviewUrl);
      if (evidPreviewUrl) URL.revokeObjectURL(evidPreviewUrl);
    } catch {}

    setImagenesEvidencia([]);
    setActa(null);
    setActaImgs([]);
    setActaOK(false);
    setCntPrevias(0);
    setCntPosteriores(0);
    setGenLoading(false);
    setGeneratedReport(null);
    setGenPreviewUrl('');
    setGenErr('');
    setGeoStatus('idle');
    setGeoMessage('');
    setGeolocalizacion(null);
    setSelectedTienda('');
    setSearchText('');
    setTipo('previa');
    setObservacion('');

    limpiarSesionLocal();
    setSesionId('');
    operationRef.current = null;
    setReseteando(false);

    navigate('/');
  };

  const pickPdf = () => !bloqueadoAhora() && pdfRef.current?.click();
  const pickImgs = () => !bloqueadoAhora() && imgsRef.current?.click();
  const pickEvid = () => !bloqueadoAhora() && evidenciaRef.current?.click();

  const canNextFrom1 = !!(numeroIncidencia && String(numeroIncidencia).trim().length > 0);
  const canNextFrom2 = !!selectedTienda;
  const canNextFrom3 = cntPrevias > 0 && cntPosteriores > 0 && imagenesEvidencia.length === 0;
  const canNextFrom4 = actaOK && !acta && actaImgs.length === 0;

  const goNext = () => !bloqueadoAhora() && setStep((s) => Math.min(5, s + 1));
  const goBack = () => !bloqueadoAhora() && setStep((s) => Math.max(1, s - 1));

  return (
    <div className="dash-root modern-ui tech-bg">
      <header className="topbar">
        <div className="dashboard-brand">
          <img
            className="dashboard-brand-logo"
            src="https://res.cloudinary.com/drygjoxaq/image/upload/v1788878195/LOGO_CUBICA_TRANSPARENTE_gfjdep.png"
            alt=""
            aria-hidden="true"
            draggable={false}
          />
          <div>
            <h1>Cubica PDF App</h1>
            <p>{nombreTecnico}</p>
          </div>
        </div>

        <AppMenu
          active="dashboard"
          isAdmin={isAdmin}
          userName={nombreTecnico}
          onNavigate={navigate}
          onLogout={handleCerrarSesion}
          disabled={bloqueado}
        />
      </header>

      <main className="dash-container">
        <section className="hero">
          <div>
            <h2>Generación de informe técnico</h2>
            <p>Completa los pasos para generar el PDF con evidencia fotográfica.</p>
          </div>

          <div className="session-chip">
            <span>Sesión</span>
            <strong>{sesionId || 'Sin sesión'}</strong>
          </div>
        </section>

        <section className="flow-progress" ref={flowProgressRef}>
          <div className="flow-progress-copy" role="status" aria-live="polite" aria-atomic="true">
            <span>PASO {step} DE {FLOW_STEP_LABELS.length}</span>
            <strong>{FLOW_STEP_LABELS[step - 1]}</strong>
          </div>
          <div
            className="steps"
            role="progressbar"
            aria-label="Progreso de creación del informe"
            aria-valuemin="1"
            aria-valuemax={FLOW_STEP_LABELS.length}
            aria-valuenow={step}
            aria-valuetext={`Paso ${step} de ${FLOW_STEP_LABELS.length}: ${FLOW_STEP_LABELS[step - 1]}`}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className={`step-dot ${step === n ? 'active' : ''} ${step > n ? 'done' : ''}`} aria-hidden="true">
                <span>{n}</span>
              </div>
            ))}
          </div>
        </section>

        {step === 1 && (
          <section className="card step-card">
            <h3>Número de incidencia</h3>
            <p>Ingresa el número de incidencia que aparecerá en el informe.</p>

            <div className="field">
              <label htmlFor="numero-incidencia">Incidencia</label>
              <input
                id="numero-incidencia"
                type="text"
                value={numeroIncidencia}
                disabled={bloqueado}
                maxLength={120}
                onChange={(e) => setNumeroIncidencia(e.target.value)}
                placeholder="Ejemplo: 123456"
              />
            </div>

            <div className="actions">
              <button type="button" className="btn primary" disabled={bloqueado || !canNextFrom1} onClick={goNext}>
                Continuar
                <Icon name="next" />
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="card step-card">
            <h3>Selección de tienda</h3>
            <p>Escribe el nombre y selecciona la tienda correspondiente.</p>

            <div className="field store-search-field">
              <label htmlFor="store-search">Nombre de la tienda</label>

              <div className="autocomplete-box">
                <input
                  id="store-search"
                  type="text"
                  value={searchText}
                  disabled={bloqueado || cntPrevias + cntPosteriores > 0}
                  onChange={(e) => {
                    setSearchText(e.target.value);
                    setTiendaSuggestOpen(true);
                    setSelectedTienda('');
                    setGeolocalizacion(null);
                    setGeoStatus('idle');
                    setGeoMessage('');
                  }}
                  onFocus={() => setTiendaSuggestOpen(true)}
                  onBlur={() => {
                    setTimeout(() => setTiendaSuggestOpen(false), 160);
                  }}
                  placeholder="Empieza a escribir el nombre de la tienda"
                  autoComplete="off"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-controls="store-suggestions"
                  aria-expanded={showTiendaSuggestions}
                  aria-haspopup="listbox"
                />

                {showTiendaSuggestions && (
                  <div className="suggestions-panel" id="store-suggestions" role="listbox">
                    {tiendaSuggestions.length > 0 ? (
                      tiendaSuggestions.map((tienda) => (
                        <button
                          type="button"
                          key={tienda._id}
                          className={`suggestion-item ${selectedTienda === tienda._id ? 'selected' : ''}`}
                          role="option"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => seleccionarTiendaSugerida(tienda)}
                          aria-selected={selectedTienda === tienda._id}
                        >
                          <strong>{tienda.nombre || 'Tienda sin nombre'}</strong>
                          <span>
                            {tienda.regional ? `${tienda.regional} | ` : ''}
                            {tienda.departamento || 'Sin departamento'}, {tienda.ciudad || 'Sin ciudad'}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="suggestion-empty">
                        No se encontraron tiendas con ese nombre
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selectedTiendaObj && (
                <div className="selected-store">
                  <span>Tienda seleccionada</span>
                  <strong>{selectedTiendaObj.nombre}</strong>
                  <p>
                    {selectedTiendaObj.regional ? `${selectedTiendaObj.regional} | ` : ''}
                    {selectedTiendaObj.departamento}, {selectedTiendaObj.ciudad}
                  </p>
                </div>
              )}
            </div>

            {cntPrevias + cntPosteriores > 0 && <p>La tienda tiene evidencias confirmadas. Usa “Nuevo informe” para cambiarla.</p>}
            {genErr && <p className="error-message" role="alert">{genErr}</p>}
            <div className="actions between">
              <button type="button" className="btn secondary" disabled={bloqueado} onClick={goBack}>
                <Icon name="back" />
                Atrás
              </button>

              <div className="right-actions">
                {cntPrevias + cntPosteriores > 0 && (
                  <button type="button" className="btn ghost" disabled={bloqueado} onClick={resetFlow}>Nuevo informe</button>
                )}
                <button type="button" className="btn primary" disabled={bloqueado || !canNextFrom2} onClick={goNext}>
                  Continuar
                  <Icon name="next" />
                </button>
              </div>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="card step-card">
            <h3>Evidencia fotográfica</h3>
            <p>Sube imágenes previas y posteriores de la instalación.</p>

              <div className="counter-grid">
              <div className={`counter-box ${bumpPrev ? 'bump' : ''}`}>
                <span>Previas</span>
                <strong aria-label={`${cntPrevias} previas confirmadas`}>{animPrev}</strong>
              </div>

              <div className={`counter-box ${bumpPost ? 'bump' : ''}`}>
                <span>Posteriores</span>
                <strong aria-label={`${cntPosteriores} posteriores confirmadas`}>{animPost}</strong>
                </div>
              </div>

              {mensaje && <p className="message upload-status" ref={uploadStatusRef} role="status" aria-live="polite">{mensaje}</p>}
              {evidenceProgress.total > 0 && (
                <p className="upload-status" role="status" aria-live="polite">
                  {evidenceProgress.confirmed} de {evidenceProgress.total} imágenes subidas
                </p>
              )}

              <form onSubmit={handleSubirImagen} className="upload-form">
              <div className="field">
                <label>Tipo de imagen</label>
                <GlassSelect
                  value={tipo}
                  onChange={setTipo}
                  disabled={bloqueado || imagenesEvidencia.some((item) => item.contexto)}
                  options={[
                    { value: 'previa', label: 'Previa' },
                    { value: 'posterior', label: 'Posterior' }
                  ]}
                  placeholder="Tipo"
                  ariaLabel="Tipo de imagen"
                />
              </div>

              <div className="field">
                <label htmlFor="evidence-observation">Observación</label>
                <textarea
                  id="evidence-observation"
                  value={observacion}
                  disabled={bloqueado || imagenesEvidencia.some((item) => item.contexto)}
                  onChange={(e) => setObservacion(e.target.value)}
                  placeholder="Describe la evidencia"
                  rows={4}
                />
              </div>

              <input
                ref={evidenciaRef}
                type="file"
                accept="image/*"
                multiple
                aria-label="Seleccionar evidencias"
                disabled={bloqueado}
                onChange={onSelectEvidencia}
                className="hidden-input"
              />

              <div className="file-card" ref={evidenceCardRef} onClick={pickEvid} role="button" tabIndex={bloqueado ? -1 : 0} aria-disabled={bloqueado}>
                {evidPreviewUrl ? (
                  <img src={evidPreviewUrl} alt="Vista previa evidencia" />
                ) : (
                  <div className="file-placeholder">
                    <strong>Seleccionar imágenes</strong>
                    <span>
                      {imagenesEvidencia.length > 0
                        ? `${imagenesEvidencia.length} imágenes seleccionadas`
                        : 'JPG, PNG o imagen compatible'}
                    </span>
                                     </div>
                )}

                {imagenesEvidencia.length > 1 && (
                  <div className="file-count">
                    {imagenesEvidencia.length} imágenes seleccionadas
                  </div>
                )}

                {imagenesEvidencia.length > 0 && (
                  <button type="button" className="file-clear" onClick={clearEvid} disabled={bloqueado}>
                    Quitar
                  </button>
                )}
              </div>

              {imagenesEvidencia.length > 0 && (
                <ul className="upload-queue" aria-label="Archivos pendientes">
                  {imagenesEvidencia.map((item) => (
                    <li key={item.id}>
                      <span>
                        <strong>{item.original.name}</strong>
                        <small>{item.error || (item.status === 'uploading' ? 'Subiendo...' : 'Pendiente')}</small>
                      </span>
                      <button type="button" className="btn ghost" disabled={bloqueado}
                        onClick={() => quitarEvidencia(item.id)} aria-label={`Quitar ${item.original.name}`}>Quitar</button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="actions between">
                <button type="button" className="btn secondary" disabled={bloqueado} onClick={goBack}>
                  <Icon name="back" />
                  Atrás
                </button>

                <div className="right-actions">
                  <button
                    type="submit"
                    className={`btn primary upload-submit ${cargando ? 'is-uploading' : ''}`}
                    disabled={bloqueado || !imagenesEvidencia.some((item) => item.file)}
                    aria-busy={cargando}
                  >
                    {cargando ? <span className="upload-spinner" aria-hidden="true" /> : <Icon name="upload" />}
                    {cargando
                      ? 'Subiendo...'
                      : imagenesEvidencia.some((item) => ['error', 'uncertain'].includes(item.status))
                        ? 'Reintentar no confirmadas'
                        : imagenesEvidencia.length > 1
                        ? 'Subir imágenes'
                        : 'Subir imagen'}
                  </button>

                  <button type="button" className="btn primary" disabled={bloqueado || !canNextFrom3} onClick={goNext}>
                    Continuar
                    <Icon name="next" />
                  </button>
                </div>
              </div>
            </form>
          </section>
        )}

        {step === 4 && (
          <section className="card step-card">
            <h3>Acta o soporte</h3>
            <p>Adjunta un PDF o imágenes del acta si aplica.</p>

            <form onSubmit={handleSubirActa} className="upload-form">
              <input
                ref={pdfRef}
                type="file"
                accept="application/pdf"
                aria-label="Seleccionar PDF del acta"
                disabled={bloqueado}
                className="hidden-input"
                onChange={handleSeleccionarPdf}
              />

              <input
                ref={imgsRef}
                type="file"
                accept="image/*"
                multiple
                aria-label="Seleccionar imágenes del acta"
                disabled={bloqueado}
                className="hidden-input"
                onChange={handleSeleccionarImagenesActa}
              />

              {mensajeActa && <p className="message upload-status" role="status" aria-live="polite">{mensajeActa}</p>}
              {actaOK && <p className="success-message upload-status" role="status">Acta cargada correctamente</p>}

              <div className="dual-upload" ref={actaUploadRef}>
                <div className="file-card small" onClick={pickPdf} role="button" tabIndex={bloqueado ? -1 : 0} aria-disabled={bloqueado}>
                  {acta ? (
                    <div className="file-placeholder selected-file">
                      <strong>{acta.name}</strong>
                      <span>{actaError || 'PDF seleccionado; validación estructural a cargo del backend'}</span>
                    </div>
                  ) : (
                    <div className="file-placeholder">
                      <strong>Seleccionar PDF</strong>
                      <span>Acta en PDF</span>
                    </div>
                  )}

                  {acta && (
                    <button type="button" className="file-clear" onClick={clearPdf} disabled={bloqueado}>
                      Quitar
                    </button>
                  )}
                </div>

                <div className="file-card small" onClick={pickImgs} role="button" tabIndex={bloqueado ? -1 : 0} aria-disabled={bloqueado}>
                  {imgPreviewUrl ? (
                    <img src={imgPreviewUrl} alt="Vista previa acta" />
                  ) : (
                    <div className="file-placeholder">
                      <strong>Seleccionar imágenes</strong>
                      <span>{actaImgs.length > 0 ? `${actaImgs.length} imágenes seleccionadas` : 'Acta en imagen'}</span>
                    </div>
                  )}

                  {actaImgs.length > 0 && (
                    <button type="button" className="file-clear" onClick={clearImgs} disabled={bloqueado}>
                      Quitar
                    </button>
                  )}
                </div>
              </div>

              {actaImgs.length > 0 && (
                <ul className="upload-queue" aria-label="Imágenes del acta seleccionadas">
                  {actaImgs.map((item, index) => (
                    <li key={index}>
                      <span><strong>{item.original.name}</strong><small>{item.error || 'Lista para subir'}</small></span>
                      <button type="button" className="btn ghost" disabled={bloqueado}
                        aria-label={`Quitar ${item.original.name}`} onClick={() => {
                          if (bloqueadoAhora()) return;
                          setActaOK(false);
                          setActaImgs((items) => items.filter((_, i) => i !== index));
                        }}>Quitar</button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="actions between">
                <button type="button" className="btn secondary" disabled={bloqueado} onClick={goBack}>
                  <Icon name="back" />
                  Atrás
                </button>

                <div className="right-actions">
                  <button
                    type="submit"
                    className={`btn primary upload-submit ${cargandoActa ? 'is-uploading' : ''}`}
                    disabled={bloqueado || (!acta && !actaImgs.length) || !!actaError || actaImgs.some((item) => item.error)}
                    aria-busy={cargandoActa}
                  >
                    {cargandoActa ? <span className="upload-spinner" aria-hidden="true" /> : <Icon name="upload" />}
                    {cargandoActa ? 'Subiendo...' : 'Subir acta'}
                  </button>

                  <button type="button" className="btn primary" disabled={bloqueado || !canNextFrom4} onClick={goNext}>
                    Continuar
                    <Icon name="next" />
                  </button>
                </div>
              </div>
            </form>
          </section>
        )}

        {step === 5 && (
          <section className="card step-card">
            <h3>Generar informe</h3>
            <p>
              {generatedReport
                ? 'El informe está listo para compartir o iniciar uno nuevo.'
                : 'Verifica la información y genera el PDF final.'}
            </p>

            <div className="summary-grid">
              <div>
                <span>Incidencia</span>
                <strong>{generatedReportDetails?.numeroIncidencia || numeroIncidencia || 'Sin incidencia'}</strong>
              </div>

              <div>
                <span>Previas</span>
                <strong>{generatedReportDetails?.cntPrevias ?? cntPrevias}</strong>
              </div>

              <div>
                <span>Posteriores</span>
                <strong>{generatedReportDetails?.cntPosteriores ?? cntPosteriores}</strong>
              </div>

              <div>
                <span>Acta</span>
                <strong>{(generatedReportDetails?.actaOK ?? actaOK) ? 'Cargada' : 'Pendiente'}</strong>
              </div>
            </div>

            {!generatedReport && (
              <div className={`geo-box ${geoStatus}`}>
                <div>
                  <span>Geolocalización</span>
                  <strong>
                    {geolocalizacion
                      ? `${geolocalizacion.latitud.toFixed(6)}, ${geolocalizacion.longitud.toFixed(6)}`
                      : 'Sin ubicación capturada'}
                  </strong>
                  <p>
                    {geoMessage || 'La ubicación se solicitará al generar el informe.'}
                  </p>
                </div>

                <button
                  type="button"
                  className="btn ghost"
                  onClick={handleCapturarUbicacion}
                  disabled={bloqueado}
                >
                  <Icon name="pin" />
                  {geoStatus === 'loading'
                    ? 'Solicitando...'
                    : geolocalizacion
                      ? 'Actualizar ubicación'
                      : 'Capturar ubicación'}
                </button>
              </div>
            )}

            {genMessage && <p className="upload-status" role="status" aria-live="polite">{genMessage}</p>}
            {genErr && <p className="error-message" role="alert">{genErr}</p>}

            {generatedReport && (
              <div className="result-box">
                <span>Informe generado</span>
                <a href={genPreviewUrl || '#'} onClick={handleVerInforme} target="_blank" rel="noreferrer" title={generatedReport.filename}>
                  Ver PDF
                </a>
              </div>
            )}

            <div className="actions between">
              {!generatedReport && (
                <button type="button" className="btn secondary" disabled={bloqueado} onClick={goBack}>
                  <Icon name="back" />
                  Atrás
                </button>
              )}

              <div className="right-actions">
                {!generatedReport && (
                  <button type="button" className="btn primary" disabled={bloqueado} onClick={handleGenerarPDF}>
                    <Icon name="pdf" />
                    {genStatus === 'checking' ? 'Comprobando...' : genLoading ? 'Generando...' : 'Generar PDF'}
                  </button>
                )}

                {genStatus === 'uncertain' && (
                  <button type="button" className="btn primary" disabled={ocupado} onClick={handleConsultarResultado}>
                    Consultar resultado
                  </button>
                )}

                {generatedReport && (
                  <>
                    <button type="button" className="btn primary" disabled={!genPreviewUrl} onClick={handleShareWhatsApp}>
                      <Icon name="share" />
                      Compartir por WhatsApp
                    </button>

                    <button type="button" className="btn ghost" disabled={bloqueado} onClick={resetFlow}>
                      {reseteando ? 'Limpiando...' : 'Nuevo informe'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      {step > 1 && !generatedReport && (
        <button type="button" className="floating-start" disabled={bloqueado} onClick={() => !bloqueadoAhora() && setStep(1)}>
          Volver al inicio
        </button>
      )}

      {geoConfirmOpen && createPortal(
        <div className="geo-modal-backdrop" role="presentation">
          <div
            className="geo-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="geo-confirm-title"
            aria-describedby="geo-confirm-description"
          >
            <div className="geo-modal-badge">GPS</div>

            <h3 id="geo-confirm-title">Confirmar ubicación</h3>

            <p id="geo-confirm-description">
              ¿Te encuentras en la tienda donde realizaste el mantenimiento en este momento?
            </p>

            {selectedTiendaObj && (
              <div className="geo-store-card">
                <span>Tienda seleccionada</span>
                <strong>{selectedTiendaObj.nombre}</strong>
                <p>
                  {selectedTiendaObj.regional ? `${selectedTiendaObj.regional} | ` : ''}
                  {selectedTiendaObj.departamento}, {selectedTiendaObj.ciudad}
                </p>
              </div>
            )}

            <div className="geo-modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => responderConfirmacionGeolocalizacion(false)}
              >
                No, generar sin GPS
              </button>

              <button
                type="button"
                className="btn primary"
                onClick={() => responderConfirmacionGeolocalizacion(true)}
              >
                Sí, capturar ubicación
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showVersionNotes && createPortal(
        <div className="version-modal-backdrop" role="presentation">
          <div className="version-modal" role="dialog" aria-modal="true" aria-labelledby="version-notes-title">
            <div className="version-pill">Versión {VERSION_NOTES.version}</div>
            <h3 id="version-notes-title">{VERSION_NOTES.title}</h3>
            <p>{VERSION_NOTES.subtitle}</p>

            <ul className="version-list">
              {VERSION_NOTES.items.map((item, index) => (
                <li key={`${VERSION_NOTES.version}-${index}`}>{item}</li>
              ))}
            </ul>

            <button type="button" className="btn primary version-action" onClick={cerrarVersionNotes}>
              Entendido
            </button>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        .upload-queue {
          list-style: none;
          padding: 0;
          max-height: 320px;
          overflow-y: auto;
        }
        .upload-queue li {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
        }
        .upload-queue span { min-width: 0; overflow-wrap: anywhere; }
        .upload-queue small { display: block; color: #c5c8ce; margin-top: 4px; }
        .file-card[aria-disabled="true"] { cursor: wait; opacity: 0.65; }
        *, *::before, *::after {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #0f1113;
        }

        .dash-root {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(255, 242, 0, 0.12), transparent 28%),
            linear-gradient(180deg, #101317 0%, #0b0d10 100%);
          color: #f4f4f5;
          font-family: Inter, Roboto, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
        }

        .topbar {
          width: min(1180px, calc(100% - 32px));
          margin: 0 auto;
          padding: 22px 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
        }

        .topbar h1 {
          margin: 0;
          font-size: clamp(22px, 3vw, 34px);
          letter-spacing: -0.04em;
        }

        .topbar p {
          margin: 4px 0 0;
          color: #b8bcc3;
          font-size: 14px;
        }

        .top-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .dash-container {
          width: min(980px, calc(100% - 32px));
          margin: 0 auto;
          padding: 10px 0 48px;
        }

        .hero {
          display: flex;
          align-items: stretch;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 18px;
        }

        .hero > div:first-child {
          flex: 1;
          padding: 24px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(18px);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
        }

        .hero h2 {
          margin: 0;
          font-size: clamp(24px, 4vw, 42px);
          letter-spacing: -0.05em;
        }

        .hero p {
          margin: 8px 0 0;
          color: #c5c8ce;
          max-width: 620px;
          line-height: 1.5;
        }

        .session-chip {
          min-width: 210px;
          padding: 18px;
          border-radius: 24px;
          background: rgba(255, 242, 0, 0.12);
          border: 1px solid rgba(255, 242, 0, 0.24);
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 6px;
        }

        .session-chip span {
          color: #c9c9c9;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .session-chip strong {
          word-break: break-all;
          font-size: 13px;
          color: #fff200;
        }

        .steps {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 10px;
          margin: 0;
        }

        .flow-progress {
          margin: 18px 0;
        }

        .flow-progress-copy {
          display: flex;
          align-items: baseline;
          gap: 10px;
          margin: 0 0 8px;
        }

        .flow-progress-copy span {
          color: #858585;
          font-size: 10px;
          font-weight: 650;
          letter-spacing: 0.1em;
          white-space: nowrap;
        }

        .flow-progress-copy strong {
          color: #ededed;
          font-size: 13px;
          font-weight: 600;
        }

        .step-dot {
          height: 8px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.12);
          position: relative;
          overflow: hidden;
          transition: background-color 280ms cubic-bezier(0.2, 0.75, 0.25, 1), transform 280ms cubic-bezier(0.2, 0.75, 0.25, 1);
        }

        .step-dot span {
          position: absolute;
          opacity: 0;
        }

        .step-dot.active {
          background: #fff200;
          transform: scaleY(1.25);
        }

        .step-dot.done {
          background: rgba(255, 242, 0, 0.45);
        }

        .card {
          background: rgba(255, 255, 255, 0.075);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 26px;
          box-shadow: 0 22px 70px rgba(0, 0, 0, 0.32);
          backdrop-filter: blur(22px);
        }

        .step-card {
          padding: clamp(20px, 4vw, 34px);
          animation: enter 320ms cubic-bezier(0.2, 0.75, 0.25, 1);
        }

        .step-card h3 {
          margin: 0;
          font-size: clamp(22px, 3vw, 32px);
          letter-spacing: -0.04em;
        }

        .step-card p {
          margin: 8px 0 22px;
          color: #c5c8ce;
          line-height: 1.5;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }

        .field label {
          font-size: 13px;
          color: #d7d9dd;
          font-weight: 700;
        }

        input,
        textarea {
          width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(255, 255, 255, 0.08);
          color: #f5f5f5;
          border-radius: 16px;
          padding: 14px 16px;
          font-size: 15px;
          outline: none;
          transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
        }

        input:focus,
        textarea:focus {
          border-color: rgba(255, 242, 0, 0.45);
          box-shadow: 0 0 0 4px rgba(255, 242, 0, 0.12);
          background: rgba(255, 255, 255, 0.1);
        }

        textarea { 
                  resize: vertical;
          min-height: 110px;
        }

        .store-search-field {
          position: relative;
        }

        .autocomplete-box {
          position: relative;
        }

        .suggestions-panel {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          z-index: 30;
          max-height: 310px;
          overflow: auto;
          padding: 8px;
          border-radius: 18px;
          background: rgba(22, 24, 29, 0.97);
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow: 0 24px 90px rgba(0, 0, 0, 0.46);
          backdrop-filter: blur(18px);
          animation: suggestions-in 180ms cubic-bezier(0.2, 0.75, 0.25, 1) both;
        }

        .suggestion-item {
          width: 100%;
          border: 0;
          border-radius: 14px;
          background: transparent;
          color: #f4f4f5;
          padding: 12px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 5px;
          cursor: pointer;
          text-align: left;
          transition: background 180ms cubic-bezier(0.2, 0.75, 0.25, 1);
        }

        .suggestion-item:hover,
        .suggestion-item.selected {
          background: rgba(255, 242, 0, 0.13);
        }

        .suggestion-item strong {
          color: #fff;
          font-size: 14px;
          line-height: 1.25;
        }

        .suggestion-item span {
          color: #c5c8ce;
          font-size: 12px;
          line-height: 1.25;
        }

        .suggestion-empty {
          padding: 13px;
          color: #c5c8ce;
          font-size: 14px;
          font-weight: 700;
        }

        .selected-store {
          margin-top: 12px;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255, 242, 0, 0.11);
          border: 1px solid rgba(255, 242, 0, 0.24);
        }

        .selected-store span {
          display: block;
          color: #fff200;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 5px;
        }

        .selected-store strong {
          display: block;
          color: #fff;
          font-size: 15px;
          overflow-wrap: anywhere;
        }

        .selected-store p {
          margin: 5px 0 0;
          color: #c5c8ce;
          font-size: 13px;
        }

        .actions {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 22px;
        }

        .actions.between {
          justify-content: space-between;
        }

        .right-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }

        .btn {
          min-height: 44px;
          border: 0;
          border-radius: 14px;
          padding: 0 18px;
          font-weight: 800;
          cursor: pointer;
          color: #111;
          transition: transform 120ms ease, opacity 120ms ease, box-shadow 160ms ease;
        }

        .upload-submit {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-width: 142px;
          white-space: nowrap;
        }

        .upload-submit.is-uploading,
        .upload-submit.is-uploading:hover {
          box-shadow: none !important;
          transform: none !important;
          background-image: none !important;
        }

        .upload-spinner {
          width: 14px;
          height: 14px;
          flex: 0 0 14px;
          border: 2px solid currentColor;
          border-right-color: transparent;
          border-radius: 50%;
          animation: upload-spin 700ms linear infinite;
        }

        @keyframes upload-spin {
          to { transform: rotate(360deg); }
        }

        .btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .btn:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .btn.primary {
          background: #fff200;
          box-shadow: 0 12px 28px rgba(255, 242, 0, 0.16);
        }

        .btn.secondary {
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.16);
        }

        .btn.ghost {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.14);
        }

        .btn.danger {
          background: rgba(255, 74, 74, 0.14);
          color: #ffb7b7;
          border: 1px solid rgba(255, 74, 74, 0.24);
        }

        .floating-start {
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 50;
          min-height: 48px;
          border: 1px solid rgba(255, 242, 0, 0.28);
          border-radius: 999px;
          padding: 0 18px;
          background: rgba(255, 242, 0, 0.16);
          color: #fff200;
          font-weight: 900;
          backdrop-filter: blur(18px);
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.36);
          cursor: pointer;
          transition: transform 140ms ease, background 140ms ease;
        }

        .floating-start:hover {
          transform: translateY(-2px);
          background: rgba(255, 242, 0, 0.22);
        }

        .counter-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin: 18px 0;
        }

        .counter-box {
          padding: 18px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .counter-box span {
          color: #c5c8ce;
          font-weight: 700;
        }

        .counter-box strong {
          font-size: 32px;
          color: #fff200;
        }

        .counter-box.bump {
          animation: bump 320ms ease-out;
        }

        .upload-form {
          margin-top: 10px;
        }

        .upload-status {
          scroll-margin-block: 18px;
          animation: enter 260ms cubic-bezier(0.2, 0.75, 0.25, 1);
        }

        .hidden-input {
          display: none;
        }

        .file-card {
          scroll-margin-block: 16px;
          position: relative;
          min-height: 280px;
          border-radius: 22px;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.075);
          border: 1px dashed rgba(255, 255, 255, 0.22);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: border-color 160ms ease, transform 160ms ease, background 160ms ease;
        }

        .file-card:hover {
          border-color: rgba(255, 242, 0, 0.5);
          background: rgba(255, 255, 255, 0.1);
          transform: translateY(-1px);
        }

        .file-card.small {
          min-height: 230px;
        }

        .file-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          position: absolute;
          inset: 0;
        }

        .file-placeholder {
          text-align: center;
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          color: #fff;
        }

        .file-placeholder strong {
          font-size: 18px;
        }

        .file-placeholder span {
          color: #c5c8ce;
          font-size: 14px;
        }

        .selected-file strong {
          word-break: break-word;
        }

        .file-clear {
          position: absolute;
          right: 12px;
          top: 12px;
          border: 0;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.72);
          color: #fff;
          padding: 8px 12px;
          cursor: pointer;
          z-index: 2;
          font-weight: 800;
        }

        .file-count {
          position: absolute;
          left: 12px;
          bottom: 12px;
          z-index: 2;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.72);
          color: #fff200;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 900;
        }

        .dual-upload {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .message,
        .success-message,
        .error-message {
          margin: 16px 0 0;
          padding: 12px 14px;
          border-radius: 14px;
          font-weight: 700;
        }

        .message {
          background: rgba(255, 255, 255, 0.08);
          color: #f1f1f1;
        }

        .success-message {
          background: rgba(38, 201, 111, 0.14);
          color: #aef2ca;
          border: 1px solid rgba(38, 201, 111, 0.22);
        }

        .error-message {
          background: rgba(255, 74, 74, 0.14);
          color: #ffb7b7;
          border: 1px solid rgba(255, 74, 74, 0.22);
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin: 20px 0;
        }

        .summary-grid > div {
          padding: 16px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .summary-grid span {
          color: #b8bcc3;
          font-size: 13px;
          font-weight: 700;
        }

        .summary-grid strong {
          color: #fff;
          font-size: 17px;
          word-break: break-word;
        }

        .geo-box {
          margin: 18px 0 0;
          padding: 16px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }

        .geo-box.ready {
          background: rgba(38, 201, 111, 0.12);
          border-color: rgba(38, 201, 111, 0.24);
        }

        .geo-box.error,
        .geo-box.unavailable,
        .geo-box.skipped {
          background: rgba(255, 174, 0, 0.11);
          border-color: rgba(255, 174, 0, 0.24);
        }

        .geo-box span {
          display: block;
          color: #b8bcc3;
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 6px;
        }

        .geo-box strong {
          display: block;
          color: #fff;
          font-size: 15px;
          overflow-wrap: anywhere;
        }

        .geo-box p {
          margin: 6px 0 0;
          color: #c5c8ce;
          font-size: 13px;
          line-height: 1.35;
        }

        .result-box {
          margin-top: 18px;
          padding: 18px;
          border-radius: 18px;
          background: rgba(255, 242, 0, 0.11);
          border: 1px solid rgba(255, 242, 0, 0.24);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
        }

        .result-box span {
          color: #fff;
          font-weight: 800;
        }

        .result-box a {
          color: #fff200;
          font-weight: 900;
          text-decoration: none;
        }

        .glass-select {
          position: relative;
        }

        .glass-select.disabled {
          opacity: 0.6;
          pointer-events: none;
        }

        .select-trigger {
          width: 100%;
          min-height: 48px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
          border-radius: 16px;
          padding: 0 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          cursor: pointer;
          text-align: left;
        }

        .select-trigger:focus {
          outline: none;
          border-color: rgba(255, 242, 0, 0.45);
          box-shadow: 0 0 0 4px rgba(255, 242, 0, 0.12);
        }

        .selected {
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .selected.placeholder {
          color: #b8bcc3;
        }

        .chev {
          flex: 0 0 auto;
          opacity: 0.8;
        }

        .dropdown-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
        }

        .dropdown-panel {
          position: fixed;
          max-height: min(360px, calc(100vh - 40px));
          overflow: auto;
          border-radius: 18px;
          background: rgba(22, 24, 29, 0.96);
          border: 1px solid rgba(255, 255, 255, 0.14);
                    box-shadow: 0 24px 90px rgba(0, 0, 0, 0.46);
          backdrop-filter: blur(18px);
          padding: 8px;
        }

        .dropdown-panel:focus {
          outline: none;
        }

        .option {
          min-height: 44px;
          padding: 11px 12px;
          border-radius: 12px;
          color: #f4f4f5;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          cursor: pointer;
        }

        .option.active {
          background: rgba(255, 255, 255, 0.08);
        }

        .option.selected {
          background: rgba(255, 242, 0, 0.13);
          color: #fff200;
        }

        .option.empty {
          color: #b8bcc3;
          cursor: default;
        }

        .option .label {
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .option .check {
          font-size: 11px;
          color: #fff200;
          font-weight: 900;
        }

        .geo-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 10001;
          padding: 18px;
          background: rgba(0, 0, 0, 0.72);
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(12px);
        }

        .geo-modal {
          width: min(100%, 500px);
          max-height: min(88vh, 720px);
          overflow: auto;
          border-radius: 26px;
          padding: 24px;
          background: rgba(22, 24, 29, 0.98);
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow: 0 28px 90px rgba(0, 0, 0, 0.55);
          color: #f4f4f5;
          animation: enter 220ms ease-out;
        }

        .geo-modal-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 32px;
          padding: 0 14px;
          border-radius: 999px;
          background: rgba(255, 242, 0, 0.13);
          border: 1px solid rgba(255, 242, 0, 0.26);
          color: #fff200;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.12em;
          margin-bottom: 14px;
        }

        .geo-modal h3 {
          margin: 0;
          font-size: clamp(24px, 4vw, 34px);
          letter-spacing: -0.04em;
        }

        .geo-modal > p {
          margin: 10px 0 18px;
          color: #c5c8ce;
          line-height: 1.5;
        }

        .geo-store-card {
          margin: 16px 0 0;
          padding: 15px;
          border-radius: 18px;
          background: rgba(255, 242, 0, 0.11);
          border: 1px solid rgba(255, 242, 0, 0.24);
        }

        .geo-store-card span {
          display: block;
          color: #fff200;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 6px;
        }

        .geo-store-card strong {
          display: block;
          color: #fff;
          font-size: 15px;
          overflow-wrap: anywhere;
        }

        .geo-store-card p {
          margin: 5px 0 0;
          color: #c5c8ce;
          font-size: 13px;
        }

        .geo-modal-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 22px;
        }

        .version-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 10000;
          padding: 18px;
          background: rgba(0, 0, 0, 0.72);
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(10px);
        }

        .version-modal {
          width: min(100%, 520px);
          max-height: min(88vh, 720px);
          overflow: auto;
          border-radius: 26px;
          padding: 24px;
          background: rgba(22, 24, 29, 0.98);
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow: 0 28px 90px rgba(0, 0, 0, 0.52);
          color: #f4f4f5;
        }

        .version-pill {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          padding: 0 12px;
          border-radius: 999px;
          background: rgba(255, 242, 0, 0.13);
          border: 1px solid rgba(255, 242, 0, 0.24);
          color: #fff200;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 14px;
        }

        .version-modal h3 {
          margin: 0;
          font-size: clamp(24px, 4vw, 34px);
          letter-spacing: -0.04em;
        }

        .version-modal p {
          margin: 8px 0 18px;
          color: #c5c8ce;
          line-height: 1.45;
        }

        .version-list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 10px;
        }

        .version-list li {
          position: relative;
          padding: 12px 12px 12px 36px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #f4f4f5;
          line-height: 1.38;
        }

        .version-list li::before {
          content: '';
          position: absolute;
          left: 14px;
          top: 17px;
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #fff200;
          box-shadow: 0 0 18px rgba(255, 242, 0, 0.45);
        }

        .version-action {
          width: 100%;
          margin-top: 18px;
        }

        @keyframes enter {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.99);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes suggestions-in {
          from {
            opacity: 0;
            transform: translateY(5px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes bump {
          0% {
            transform: scale(1);
          }

          45% {
            transform: scale(1.035);
          }

          100% {
            transform: scale(1);
          }
        }

        @media (max-width: 760px) {
          .dash-root .topbar {
            flex-direction: row;
            align-items: center;
          }

          .hero {
            flex-direction: column;
          }

          .session-chip {
            min-width: 0;
          }

          .dual-upload,
          .summary-grid {
            grid-template-columns: 1fr;
          }

          .actions.between {
            flex-direction: column;
            align-items: stretch;
          }

          .right-actions {
            justify-content: stretch;
            flex-direction: column;
          }

          .right-actions .btn,
          .actions > .btn {
            width: 100%;
          }

          .counter-grid {
            grid-template-columns: 1fr 1fr;
          }

          .geo-box {
            align-items: stretch;
            flex-direction: column;
          }

          .geo-box .btn {
            width: 100%;
          }

          .file-card {
            min-height: 230px;
          }

          .floating-start {
            display: none;
          }
        }

        @media (max-width: 420px) {
          .dash-container,
          .topbar {
            width: min(100% - 22px, 980px);
          }

          .step-card {
            border-radius: 22px;
          }

          .counter-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          body {
            overflow-x: hidden;
          }

          .dash-root {
            padding-bottom: 0;
          }

          .topbar {
            width: min(100% - 20px, 980px);
            padding: 16px 0 12px;
            gap: 12px;
          }

          .topbar h1 {
            font-size: 26px;
            line-height: 1.05;
          }

          .topbar p {
            font-size: 13px;
          }

          .top-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            width: 100%;
          }

          .top-actions .btn {
            width: 100%;
            min-height: 46px;
            padding: 0 10px;
            font-size: 13px;
          }

          .top-actions .btn.danger {
            grid-column: 1 / -1;
          }

          .dash-container {
            width: min(100% - 20px, 980px);
            padding: 4px 0 28px;
          }

          .hero {
            gap: 12px;
            margin-bottom: 14px;
          }

          .hero > div:first-child,
          .session-chip,
          .card {
            border-radius: 20px;
          }

          .hero > div:first-child {
            padding: 18px;
          }

          .hero h2 {
            font-size: 26px;
            line-height: 1.05;
          }

          .hero p,
          .step-card p {
            font-size: 14px;
            line-height: 1.45;
          }

          .session-chip {
            padding: 14px;
          }

          .steps {
            gap: 7px;
          }

          .flow-progress {
            margin: 12px 0 14px;
          }

          .flow-progress-copy {
            margin-bottom: 7px;
          }

          .flow-progress-copy span {
            font-size: 9px;
          }

          .flow-progress-copy strong {
            font-size: 13px;
          }

          .step-dot {
            height: 9px;
          }

          .step-card {
            padding: 18px;
          }

          .step-card h3 {
            font-size: 24px;
            line-height: 1.08;
          }

          .field {
            margin-bottom: 14px;
          }

          input,
          textarea,
          .select-trigger {
            min-height: 50px;
            border-radius: 14px;
            font-size: 16px;
          }

          textarea {
            min-height: 118px;
          }

          .suggestions-panel {
            max-height: 42vh;
            border-radius: 16px;
          }

          .suggestion-item {
            min-height: 58px;
            padding: 13px;
          }

          .selected-store {
            border-radius: 16px;
          }

          .actions {
            margin-top: 18px;
          }

          .actions.between,
          .right-actions {
            gap: 9px;
          }

          .btn {
            min-height: 50px;
            border-radius: 14px;
            padding: 0 14px;
            font-size: 14px;
          }

          .counter-grid {
            gap: 10px;
          }

          .counter-box {
            padding: 14px;
            border-radius: 18px;
          }

          .counter-box strong {
            font-size: 28px;
          }

          .file-card {
            min-height: 210px;
            border-radius: 18px;
          }

          .file-card.small {
            min-height: 190px;
          }

          .file-placeholder {
            padding: 18px;
          }

          .file-placeholder strong {
            font-size: 16px;
          }

          .file-placeholder span {
            font-size: 13px;
          }

          .summary-grid {
            gap: 10px;
          }

          .summary-grid > div {
            border-radius: 16px;
            padding: 14px;
          }

          .geo-box,
          .result-box {
            border-radius: 16px;
            padding: 14px;
          }

          .geo-modal {
            border-radius: 24px;
            padding: 20px;
          }

          .geo-modal-actions {
            flex-direction: column-reverse;
            align-items: stretch;
          }

          .geo-modal-actions .btn {
            width: 100%;
          }

          .dropdown-panel {
            left: 10px !important;
            right: 10px !important;
            width: calc(100% - 20px) !important;
            max-height: 48vh;
            border-radius: 16px;
          }

          .option {
            min-height: 50px;
          }

          .floating-start {
            display: none;
          }
        }

        @media (max-width: 360px) {
          .top-actions {
            grid-template-columns: 1fr;
          }

          .top-actions .btn.danger {
            grid-column: auto;
          }

          .hero h2,
          .step-card h3 {
            font-size: 22px;
          }
        }
      `}</style>
    </div>
  );
};

export default DashboardPage;
