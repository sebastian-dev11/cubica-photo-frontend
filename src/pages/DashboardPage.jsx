import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { http } from '../services/http';

async function loadImageBitmap(file) {
  if ('createImageBitmap' in window) {
    try {
      const bmp = await createImageBitmap(file);
      return { width: bmp.width, height: bmp.height, source: bmp, isBitmap: true };
    } catch {}
  }

  return await loadHTMLImageElement(file);
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

async function loadHTMLImageElement(file) {
  const src = await readAsDataURL(file);

  await new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res();
    img.onerror = rej;
    img.src = src;
  });

  const img2 = new Image();
  img2.src = src;
  await img2.decode?.();

  return {
    width: img2.naturalWidth || img2.width,
    height: img2.naturalHeight || img2.height,
    source: img2,
    isBitmap: false
  };
}

function drawToCanvas(source, sw, sh, maxW) {
  const ratio = Math.min(1, maxW / Math.max(sw, sh));
  const outW = Math.max(1, Math.round(sw * ratio));
  const outH = Math.max(1, Math.round(sh * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, outW, outH);

  return canvas;
}

function blobToFile(blob, name, type) {
  try {
    return new File([blob], name, { type });
  } catch {
    blob.name = name;
    blob.type = type;
    return blob;
  }
}

async function optimizeImage(file, {
  maxWidth = 1600,
  quality = 0.75,
  format = 'image/jpeg',
  fallbacks = [{ maxWidth: 1280, quality: 0.7 }]
} = {}) {
  if (!file || !file.type?.startsWith('image/')) return file;

  const { width, height, source, isBitmap } = await loadImageBitmap(file);

  let canvas = drawToCanvas(source, width, height, maxWidth);

  if (isBitmap && source.close) {
    try {
      source.close();
    } catch {}
  }

  const canvasToBlob = (c, q) => new Promise((res, rej) => {
    c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob null'))), format, q);
  });

  let outBlob = await canvasToBlob(canvas, quality);

  for (const fb of fallbacks) {
    if (outBlob.size <= 10 * 1024 * 1024) break;

    canvas = drawToCanvas(canvas, canvas.width, canvas.height, fb.maxWidth);
    outBlob = await canvasToBlob(canvas, fb.quality);
  }

  const base = (file.name || 'image').replace(/\.[a-z0-9]+$/i, '');
  const outName = `${base}-opt.jpg`;

  return blobToFile(outBlob, outName, 'image/jpeg');
}

async function optimizeMany(files, opts) {
  const arr = Array.from(files || []);
  const out = [];

  for (const f of arr) {
    try {
      out.push(await optimizeImage(f, opts));
    } catch {
      out.push(f);
    }
  }

  return out;
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
    return 'Este dispositivo no tiene geolocalizacion disponible.';
  }

  if (error?.code === 1) {
    return 'Permiso de ubicacion denegado. El informe se puede generar sin GPS.';
  }

  if (error?.code === 2) {
    return 'No se pudo obtener la ubicacion actual. Revisa el GPS del dispositivo.';
  }

  if (error?.code === 3) {
    return 'La ubicacion tardo demasiado. Puedes intentar nuevamente.';
  }

  return 'No se pudo obtener la ubicacion.';
}

async function serverResetSession(curId) {
  if (!curId) return;

  try {
    await http.post(`/pdf/session/reset/${encodeURIComponent(curId)}`);
  } catch (e) {
    console.error('No se pudo resetear la sesion en servidor:', e);
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

  const [step, setStep] = useState(() => {
    const v = Number(localStorage.getItem('dashStep') || 1);
    return Number.isFinite(v) && v >= 1 && v <= 5 ? v : 1;
  });

  const [sesionId, setSesionId] = useState(() => localStorage.getItem('sesionId') || '');
  const [numeroIncidencia, setNumeroIncidencia] = useState(() => localStorage.getItem('numeroIncidencia') || '');
  const token = localStorage.getItem('token') || '';
  const nombreTecnico = localStorage.getItem('nombreTecnico') || 'Tecnico';
  const isAdmin = localStorage.getItem('isAdmin') === '1' || localStorage.getItem('isAdmin') === 'true';

  const [imagen, setImagen] = useState(null);
  const [imagenesEvidencia, setImagenesEvidencia] = useState([]);
  const [tipo, setTipo] = useState('previa');
  const [observacion, setObservacion] = useState('');

  const [cntPrevias, setCntPrevias] = useState(0);
  const [cntPosteriores, setCntPosteriores] = useState(0);
  const [bumpPrev, setBumpPrev] = useState(false);
  const [bumpPost, setBumpPost] = useState(false);

  const [acta, setActa] = useState(null);
  const [actaImgs, setActaImgs] = useState([]);
  const [actaOK, setActaOK] = useState(false);

  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [imgPreviewUrl, setImgPreviewUrl] = useState(null);
  const [evidPreviewUrl, setEvidPreviewUrl] = useState(null);

  const pdfRef = useRef(null);
  const imgsRef = useRef(null);
  const evidenciaRef = useRef(null);

  const [mensaje, setMensaje] = useState('');
  const [mensajeActa, setMensajeActa] = useState('');
  const [cargando, setCargando] = useState(false);
  const [cargandoActa, setCargandoActa] = useState(false);

  const [genLoading, setGenLoading] = useState(false);
  const [genUrl, setGenUrl] = useState('');
  const [genErr, setGenErr] = useState('');
  const [geoStatus, setGeoStatus] = useState('idle');
  const [geoMessage, setGeoMessage] = useState('');
  const [geolocalizacion, setGeolocalizacion] = useState(null);

  const [tiendas, setTiendas] = useState([]);
  const [selectedTienda, setSelectedTienda] = useState('');
  const [filtroRegional, setFiltroRegional] = useState('');
  const [filtroDepartamento, setFiltroDepartamento] = useState('');
  const [filtroCiudad, setFiltroCiudad] = useState('');
  const [searchText, setSearchText] = useState('');
  const [tiendaSuggestOpen, setTiendaSuggestOpen] = useState(false);

  useEffect(() => {
    if (!token || !sesionId) {
      navigate('/');
    }
  }, [navigate, token, sesionId]);

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

  const regionales = useMemo(() => {
    const set = new Set(
      tiendas
        .map((t) => (t?.regional ?? '').toString().trim())
        .filter(Boolean)
    );

    return [...set].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [tiendas]);

  const ciudades = useMemo(() => {
    const base = filtroRegional
      ? tiendas.filter((t) => (t?.regional ?? '').trim() === filtroRegional)
      : tiendas;

    const set = new Set(
      base
        .map((t) => (t?.ciudad ?? '').toString().trim())
        .filter(Boolean)
    );

    return [...set].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [tiendas, filtroRegional]);

  const departamentos = useMemo(() => {
    let base = tiendas;

    if (filtroRegional) {
      base = base.filter((t) => (t?.regional ?? '').trim() === filtroRegional);
    }

    if (filtroCiudad) {
      base = base.filter((t) => (t?.ciudad ?? '').trim() === filtroCiudad);
    }

    const set = new Set(
      base
        .map((t) => (t?.departamento ?? '').toString().trim())
        .filter(Boolean)
    );

    return [...set].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [tiendas, filtroRegional, filtroCiudad]);

  const filteredTiendas = useMemo(() => {
    const q = norm(searchText);

    return tiendas
      .filter((t) => {
        const okReg = filtroRegional ? (t?.regional ?? '').trim() === filtroRegional : true;
        const okCity = filtroCiudad ? (t?.ciudad ?? '').trim() === filtroCiudad : true;
        const okDept = filtroDepartamento ? (t?.departamento ?? '').trim() === filtroDepartamento : true;

        if (!(okReg && okCity && okDept)) return false;
        if (!q) return true;

        return [t?.nombre, t?.ciudad, t?.departamento, t?.regional]
          .map(norm)
          .some((s) => s.includes(q));
      })
      .sort((a, b) => (a?.nombre || '').localeCompare((b?.nombre || ''), 'es', { sensitivity: 'base' }));
  }, [tiendas, filtroRegional, filtroCiudad, filtroDepartamento, searchText]);

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
    if (!tienda?._id || step > 2) return;

    setSelectedTienda(tienda._id);
    setSearchText(tienda.nombre || '');
    setTiendaSuggestOpen(false);
    setCntPrevias(0);
    setCntPosteriores(0);
    setActaOK(false);
  };

  useEffect(() => {
    if (selectedTienda && !filteredTiendas.some((t) => t._id === selectedTienda)) {
      setSelectedTienda('');
    }
  }, [filteredTiendas, selectedTienda]);

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

    const first = actaImgs[0];

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

  const limpiarFiltros = () => {
    setFiltroRegional('');
    setFiltroDepartamento('');
    setFiltroCiudad('');
    setSearchText('');
    setSelectedTienda('');
    setTiendaSuggestOpen(false);
  };

  const clearEvid = (e) => {
    e?.stopPropagation?.();
    setImagen(null);
    setImagenesEvidencia([]);

    if (evidenciaRef.current) evidenciaRef.current.value = '';

    if (evidPreviewUrl) {
      URL.revokeObjectURL(evidPreviewUrl);
      setEvidPreviewUrl(null);
    }
  };

  const clearPdf = (e, opts = {}) => {
    e?.stopPropagation?.();

    const keepStatus = !!opts.keepStatus;

    setActa(null);

    if (!keepStatus) setActaOK(false);

    if (pdfRef.current) pdfRef.current.value = '';

    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
  };

  const clearImgs = (e, opts = {}) => {
    e?.stopPropagation?.();

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
    const files = Array.from(e.target.files || []);

    if (files.length === 0) {
      setImagen(null);
      setImagenesEvidencia([]);
      return;
    }

    const invalidas = files.filter((file) => !file.type?.startsWith('image/'));

    if (invalidas.length > 0) {
      setMensaje('Todos los archivos seleccionados deben ser imagenes');
      setImagen(null);
      setImagenesEvidencia([]);
      return;
    }

    try {
      setMensaje(files.length > 1 ? `Optimizando ${files.length} imagenes...` : 'Optimizando imagen...');

      const optimized = await optimizeMany(files, {
        maxWidth: 1600,
        quality: 0.75,
        format: 'image/jpeg',
        fallbacks: [{ maxWidth: 1280, quality: 0.7 }]
      });

      setImagenesEvidencia(optimized);
      setImagen(optimized[0] || null);
      setMensaje(files.length > 1 ? `${files.length} imagenes listas para subir` : '');
    } catch (err) {
      console.error(err);
      setMensaje('No se pudieron optimizar las imagenes. Se intentara subir los archivos originales.');
      setImagenesEvidencia(files);
      setImagen(files[0] || null);
    }
  };

  const handleSubirImagen = async (e) => {
    e.preventDefault();

    const imagenesParaSubir = imagenesEvidencia.length > 0 ? imagenesEvidencia : imagen ? [imagen] : [];

    if (imagenesParaSubir.length === 0 || !tipo || !selectedTienda) {
      setMensaje('Por favor completa todos los campos.');
      return;
    }

    const tipoEnviado = tipo;

    setCargando(true);
    setMensaje(imagenesParaSubir.length > 1 ? `Subiendo ${imagenesParaSubir.length} imagenes...` : 'Subiendo imagen...');

    try {
      let subidas = 0;

      for (const img of imagenesParaSubir) {
        const formData = new FormData();

        formData.append('imagen', img);
        formData.append('tipo', tipoEnviado);
        formData.append('sesionId', sesionId);
        formData.append('ubicacion', selectedTienda);
        formData.append('observacion', observacion);

        await http.post('/imagenes/subir', formData);
        subidas += 1;
      }

      if (tipoEnviado === 'previa') {
        setCntPrevias((x) => x + subidas);
      } else {
        setCntPosteriores((x) => x + subidas);
      }

      setTipo(tipoEnviado === 'previa' ? 'posterior' : 'previa');

      setMensaje(
        subidas === 1
          ? 'Imagen y observacion enviadas correctamente'
          : `${subidas} imagenes ${tipoEnviado === 'previa' ? 'previas' : 'posteriores'} enviadas correctamente`
      );

      setImagen(null);
      setImagenesEvidencia([]);
      setObservacion('');

      if (evidenciaRef.current) evidenciaRef.current.value = '';

      setTimeout(() => setMensaje(''), 3000);
    } catch (error) {
      console.error(error);
      setMensaje(error?.response?.data?.mensaje || error?.response?.data?.error || 'Error al subir la imagen');
    } finally {
      setCargando(false);
    }
  };

  const handleSubirActa = async (e) => {
    e.preventDefault();

    if (!acta && actaImgs.length === 0) {
      setMensajeActa('Selecciona un PDF o una imagen del acta');
      return;
    }

    const formData = new FormData();
    formData.append('sesionId', sesionId);

    if (acta) {
      formData.append('acta', acta);
    }

    let imgsParaSubir = actaImgs;

    if (actaImgs.length > 0) {
      try {
        setMensajeActa('Optimizando imagenes del acta...');

        imgsParaSubir = await optimizeMany(actaImgs, {
          maxWidth: 1600,
          quality: 0.75,
          format: 'image/jpeg',
          fallbacks: [{ maxWidth: 1280, quality: 0.7 }]
        });
      } catch (err) {
        console.error('Fallo optimizando imagenes del acta:', err);
      }
    }

    imgsParaSubir.forEach((img) => formData.append('imagenes', img));

    setCargandoActa(true);

    try {
      const data = await http.post('/acta/subir', formData);

      setMensajeActa(data?.mensaje || 'Archivo subido correctamente');
      clearPdf(null, { keepStatus: true });
      clearImgs(null, { keepStatus: true });
      setActaOK(true);
      setTimeout(() => setMensajeActa(''), 3000);
    } catch (error) {
      console.error(error);
      setMensajeActa(error?.response?.data?.mensaje || error?.response?.data?.error || 'Error en la conexion con el servidor');
    } finally {
      setCargandoActa(false);
    }
  };

  const solicitarGeolocalizacion = async () => {
    if (!navigator.geolocation) {
      setGeoStatus('unavailable');
      setGeoMessage('Este dispositivo no tiene geolocalizacion disponible.');
      return null;
    }

    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      setGeoStatus('unavailable');
      setGeoMessage('La geolocalizacion requiere HTTPS para funcionar.');
      return null;
    }

    setGeoStatus('loading');
    setGeoMessage('Solicitando ubicacion GPS...');

    try {
      const position = await obtenerUbicacionActual();
      const geo = normalizarUbicacion(position);

      if (!geo) {
        setGeoStatus('error');
        setGeoMessage('No se pudo leer la ubicacion del dispositivo.');
        return null;
      }

      const precisionTexto =
        geo.precision !== null
          ? `Precision aproximada: ${Math.round(geo.precision)} m`
          : 'Ubicacion capturada correctamente';

      setGeolocalizacion(geo);
      setGeoStatus('ready');
      setGeoMessage(precisionTexto);

      return geo;
    } catch (error) {
      console.error('Error obteniendo geolocalizacion:', error);

      const msg = getMensajeGeoError(error);

      setGeoStatus('error');
      setGeoMessage(msg);

      return null;
    }
  };

  const handleGenerarPDF = async () => {
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

    setGenErr('');
    setGenUrl('');
    setGenLoading(true);

    try {
      let geoParaInforme = geolocalizacion;

      if (!geoParaInforme) {
        geoParaInforme = await solicitarGeolocalizacion();
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

      const data = await http.get(`/pdf/generar/${encodeURIComponent(sesionId)}`, params);

      const cloudUrl = data?.url;

      if (!cloudUrl) {
        throw new Error('Respuesta sin URL de informe');
      }

      setGenUrl(cloudUrl);
    } catch (err) {
      console.error(err);
      setGenErr(err?.response?.data?.error || err?.response?.data?.mensaje || 'Error al generar el informe. Intenta de nuevo.');
    } finally {
      setGenLoading(false);
    }
  };

  const resetFlow = async (skipRotate = false) => {
    try {
      await serverResetSession(sesionId);
    } catch (e) {
      console.error('Fallo al limpiar en backend durante resetFlow:', e);
    }

    try {
      if (evidenciaRef.current) evidenciaRef.current.value = '';
      if (pdfRef.current) pdfRef.current.value = '';
      if (imgsRef.current) imgsRef.current.value = '';

      if (evidPreviewUrl) URL.revokeObjectURL(evidPreviewUrl);
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      if (imgPreviewUrl) URL.revokeObjectURL(imgPreviewUrl);
    } catch {}

    setImagen(null);
    setImagenesEvidencia([]);
    setActa(null);
    setActaImgs([]);
    setEvidPreviewUrl(null);
    setPdfPreviewUrl(null);
    setImgPreviewUrl(null);
    setStep(1);
    setCntPrevias(0);
    setCntPosteriores(0);
    setActaOK(false);
    setGenLoading(false);
    setGenUrl('');
    setGenErr('');
    setGeoStatus('idle');
    setGeoMessage('');
    setGeolocalizacion(null);
    setTipo('previa');
    setObservacion('');

    if (!skipRotate) {
      const current = localStorage.getItem('sesionId') || sesionId;
      setSesionId(current);
    }
  };

  const handleShareWhatsApp = () => {
    if (!genUrl) return;

    const tiendaOptsLocal = filteredTiendas.map((t) => ({
      value: t._id,
      label: `${t.nombre} - ${t.regional ? t.regional + ' | ' : ''}${t.departamento}, ${t.ciudad}`
    }));

    const tiendaLabel = (tiendaOptsLocal.find((o) => o.value === selectedTienda)?.label || '').trim();
    const texto = `Informe tecnico${tiendaLabel ? ` - ${tiendaLabel}` : ''}\n${genUrl}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(texto)}`;

    const cleanupAll = async () => {
      try {
        await serverResetSession(sesionId);
      } catch (e) {
        console.error('Fallo limpieza backend en compartir:', e);
      }

      try {
        await resetFlow(true);
        limpiarSesionLocal();
      } catch {}
    };

    const popup = window.open(waUrl, '_blank', 'noopener,noreferrer');

    if (popup && !popup.closed) {
      popup.opener = null;
      setTimeout(() => {
        cleanupAll();
        navigate('/');
      }, 400);
    } else {
      cleanupAll();
      window.location.href = waUrl;
    }
  };

  const handleCerrarSesion = async () => {
    try {
      await serverResetSession(sesionId);
    } catch (e) {
      console.error('Fallo limpieza backend al cerrar sesion:', e);
    }

    try {
      if (pdfRef.current) pdfRef.current.value = '';
      if (imgsRef.current) imgsRef.current.value = '';
      if (evidenciaRef.current) evidenciaRef.current.value = '';

      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      if (imgPreviewUrl) URL.revokeObjectURL(imgPreviewUrl);
      if (evidPreviewUrl) URL.revokeObjectURL(evidPreviewUrl);
    } catch {}

    setImagen(null);
    setImagenesEvidencia([]);
    setActa(null);
    setActaImgs([]);
    setActaOK(false);
    setCntPrevias(0);
    setCntPosteriores(0);
    setGenLoading(false);
    setGenUrl('');
    setGenErr('');
    setGeoStatus('idle');
    setGeoMessage('');
    setGeolocalizacion(null);
    setSelectedTienda('');
    setSearchText('');
    setFiltroRegional('');
    setFiltroDepartamento('');
    setFiltroCiudad('');
    setTipo('previa');
    setObservacion('');

    limpiarSesionLocal();
    setSesionId('');

    navigate('/');
  };

  const pickPdf = () => pdfRef.current && pdfRef.current.click();
  const pickImgs = () => imgsRef.current && imgsRef.current.click();
  const pickEvid = () => evidenciaRef.current && evidenciaRef.current.click();

  const canNextFrom1 = !!(numeroIncidencia && String(numeroIncidencia).trim().length > 0);
  const canNextFrom2 = !!selectedTienda;
  const hasAnyEvidence = (cntPrevias + cntPosteriores) > 0;
  const canNextFrom3 = hasAnyEvidence;
  const canNextFrom4 = actaOK;

  const goNext = () => setStep((s) => Math.min(5, s + 1));
  const goBack = () => setStep((s) => Math.max(1, s - 1));
    return (
    <div className="dash-root">
      <header className="topbar">
        <div>
          <h1>Cubica PDF App</h1>
          <p>{nombreTecnico}</p>
        </div>

        <div className="top-actions">
          <button type="button" className="btn ghost" onClick={() => navigate('/informes')}>
            {isAdmin ? 'Informes' : 'Mis Informes'}
          </button>

          {isAdmin && (
            <>
              <button type="button" className="btn ghost" onClick={() => navigate('/usuarios')}>
                Usuarios
              </button>

              <button type="button" className="btn ghost" onClick={() => navigate('/tiendas')}>
                Tiendas
              </button>
            </>
          )}

          <button type="button" className="btn danger" onClick={handleCerrarSesion}>
            Cerrar sesion
          </button>
        </div>
      </header>

      <main className="dash-container">
        <section className="hero">
          <div>
            <h2>Generacion de informe tecnico</h2>
            <p>Completa los pasos para generar el PDF con evidencia fotografica.</p>
          </div>

          <div className="session-chip">
            <span>Sesion</span>
            <strong>{sesionId || 'Sin sesion'}</strong>
          </div>
        </section>

        <section className="steps">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className={`step-dot ${step === n ? 'active' : ''} ${step > n ? 'done' : ''}`}>
              <span>{n}</span>
            </div>
          ))}
        </section>

        {step === 1 && (
          <section className="card step-card">
            <h3>Numero de incidencia</h3>
            <p>Ingresa el numero de incidencia que aparecera en el informe.</p>

            <div className="field">
              <label>Incidencia</label>
              <input
                type="text"
                value={numeroIncidencia}
                onChange={(e) => setNumeroIncidencia(e.target.value)}
                placeholder="Ejemplo: 123456"
              />
            </div>

            <div className="actions">
              <button type="button" className="btn primary" disabled={!canNextFrom1} onClick={goNext}>
                Continuar
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="card step-card">
            <h3>Seleccion de tienda</h3>
            <p>Filtra y selecciona la tienda donde se realizo la instalacion.</p>

            <div className="filters-grid">
              <div className="field">
                <label>Regional</label>
                <GlassSelect
                  value={filtroRegional}
                  onChange={(val) => {
                    setFiltroRegional(val);
                    setFiltroDepartamento('');
                    setFiltroCiudad('');
                    setSelectedTienda('');
                  }}
                  options={[
                    { value: '', label: 'Todas las regionales' },
                    ...regionales.map((r) => ({ value: r, label: r }))
                  ]}
                  placeholder="Regional"
                  ariaLabel="Regional"
                />
              </div>

              <div className="field">
                <label>Ciudad</label>
                <GlassSelect
                  value={filtroCiudad}
                  onChange={(val) => {
                    setFiltroCiudad(val);
                    setFiltroDepartamento('');
                    setSelectedTienda('');
                  }}
                  options={[
                    { value: '', label: 'Todas las ciudades' },
                    ...ciudades.map((c) => ({ value: c, label: c }))
                  ]}
                  placeholder="Ciudad"
                  ariaLabel="Ciudad"
                />
              </div>

              <div className="field">
                <label>Departamento</label>
                <GlassSelect
                  value={filtroDepartamento}
                  onChange={(val) => {
                    setFiltroDepartamento(val);
                    setSelectedTienda('');
                  }}
                  options={[
                    { value: '', label: 'Todos los departamentos' },
                    ...departamentos.map((d) => ({ value: d, label: d }))
                  ]}
                  placeholder="Departamento"
                  ariaLabel="Departamento"
                />
              </div>
            </div>

            <div className="field store-search-field">
              <label>Buscar y seleccionar tienda</label>

              <div className="autocomplete-box">
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => {
                    setSearchText(e.target.value);
                    setTiendaSuggestOpen(true);
                    setSelectedTienda('');
                  }}
                  onFocus={() => setTiendaSuggestOpen(true)}
                  onBlur={() => {
                    setTimeout(() => setTiendaSuggestOpen(false), 160);
                  }}
                  placeholder="Escribe el nombre de la tienda"
                  autoComplete="off"
                />

                {showTiendaSuggestions && (
                  <div className="suggestions-panel">
                    {tiendaSuggestions.length > 0 ? (
                      tiendaSuggestions.map((tienda) => (
                        <button
                          type="button"
                          key={tienda._id}
                          className={`suggestion-item ${selectedTienda === tienda._id ? 'selected' : ''}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => seleccionarTiendaSugerida(tienda)}
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

            <div className="actions between">
              <button type="button" className="btn secondary" onClick={goBack}>
                Atras
              </button>

              <div className="right-actions">
                <button type="button" className="btn ghost" onClick={limpiarFiltros}>
                  Limpiar filtros
                </button>

                <button type="button" className="btn primary" disabled={!canNextFrom2} onClick={goNext}>
                  Continuar
                </button>
              </div>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="card step-card">
            <h3>Evidencia fotografica</h3>
            <p>Sube imagenes previas y posteriores de la instalacion.</p>

            <div className="counter-grid">
              <div className={`counter-box ${bumpPrev ? 'bump' : ''}`}>
                <span>Previas</span>
                <strong>{animPrev}</strong>
              </div>

              <div className={`counter-box ${bumpPost ? 'bump' : ''}`}>
                <span>Posteriores</span>
                <strong>{animPost}</strong>
              </div>
            </div>

            <form onSubmit={handleSubirImagen} className="upload-form">
              <div className="field">
                <label>Tipo de imagen</label>
                <GlassSelect
                  value={tipo}
                  onChange={setTipo}
                  options={[
                    { value: 'previa', label: 'Previa' },
                    { value: 'posterior', label: 'Posterior' }
                  ]}
                  placeholder="Tipo"
                  ariaLabel="Tipo de imagen"
                />
              </div>

              <div className="field">
                <label>Observacion</label>
                <textarea
                  value={observacion}
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
                onChange={onSelectEvidencia}
                className="hidden-input"
              />

              <div className="file-card" onClick={pickEvid} role="button" tabIndex={0}>
                {evidPreviewUrl ? (
                  <img src={evidPreviewUrl} alt="Vista previa evidencia" />
                ) : (
                  <div className="file-placeholder">
                    <strong>Seleccionar imagenes</strong>
                    <span>
                      {imagenesEvidencia.length > 0
                        ? `${imagenesEvidencia.length} imagenes seleccionadas`
                        : 'JPG, PNG o imagen compatible'}
                    </span>
                  </div>
                )}

                {imagenesEvidencia.length > 1 && (
                  <div className="file-count">
                    {imagenesEvidencia.length} imagenes seleccionadas
                  </div>
                )}

                {imagenesEvidencia.length > 0 && (
                  <button type="button" className="file-clear" onClick={clearEvid}>
                    Quitar
                  </button>
                )}
              </div>

              {mensaje && <p className="message">{mensaje}</p>}

              <div className="actions between">
                <button type="button" className="btn secondary" onClick={goBack}>
                  Atras
                </button>

                <div className="right-actions">
                  <button type="submit" className="btn primary" disabled={cargando || imagenesEvidencia.length === 0}>
                    {cargando
                      ? 'Subiendo...'
                      : imagenesEvidencia.length > 1
                        ? 'Subir imagenes'
                        : 'Subir imagen'}
                  </button>

                  <button type="button" className="btn primary" disabled={!canNextFrom3} onClick={goNext}>
                    Continuar
                  </button>
                </div>
              </div>
            </form>
          </section>
        )}

        {step === 4 && (
          <section className="card step-card">
            <h3>Acta o soporte</h3>
            <p>Adjunta un PDF o imagenes del acta si aplica.</p>

            <form onSubmit={handleSubirActa} className="upload-form">
              <input
                ref={pdfRef}
                type="file"
                accept="application/pdf"
                className="hidden-input"
                onChange={(e) => setActa(e.target.files?.[0] || null)}
              />

              <input
                ref={imgsRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden-input"
                onChange={(e) => setActaImgs(Array.from(e.target.files || []))}
              />

              <div className="dual-upload">
                <div className="file-card small" onClick={pickPdf} role="button" tabIndex={0}>
                  {acta ? (
                    <div className="file-placeholder selected-file">
                      <strong>{acta.name}</strong>
                      <span>PDF seleccionado</span>
                    </div>
                  ) : (
                    <div className="file-placeholder">
                      <strong>Seleccionar PDF</strong>
                      <span>Acta en PDF</span>
                    </div>
                  )}

                  {acta && (
                    <button type="button" className="file-clear" onClick={clearPdf}>
                      Quitar
                    </button>
                  )}
                </div>

                <div className="file-card small" onClick={pickImgs} role="button" tabIndex={0}>
                  {imgPreviewUrl ? (
                    <img src={imgPreviewUrl} alt="Vista previa acta" />
                  ) : (
                    <div className="file-placeholder">
                      <strong>Seleccionar imagenes</strong>
                      <span>{actaImgs.length > 0 ? `${actaImgs.length} imagenes seleccionadas` : 'Acta en imagen'}</span>
                    </div>
                  )}

                  {actaImgs.length > 0 && (
                    <button type="button" className="file-clear" onClick={clearImgs}>
                      Quitar
                    </button>
                  )}
                </div>
              </div>

              {mensajeActa && <p className="message">{mensajeActa}</p>}

              {actaOK && (
                <p className="success-message">
                  Acta cargada correctamente
                </p>
              )}

              <div className="actions between">
                <button type="button" className="btn secondary" onClick={goBack}>
                  Atras
                </button>

                <div className="right-actions">
                  <button type="submit" className="btn primary" disabled={cargandoActa}>
                    {cargandoActa ? 'Subiendo...' : 'Subir acta'}
                  </button>

                  <button type="button" className="btn primary" disabled={!canNextFrom4} onClick={goNext}>
                    Continuar
                  </button>
                </div>
              </div>
            </form>
          </section>
        )}

        {step === 5 && (
          <section className="card step-card">
            <h3>Generar informe</h3>
            <p>Verifica la informacion y genera el PDF final.</p>

            <div className="summary-grid">
              <div>
                <span>Incidencia</span>
                <strong>{numeroIncidencia || 'Sin incidencia'}</strong>
              </div>

              <div>
                <span>Previas</span>
                <strong>{cntPrevias}</strong>
              </div>

              <div>
                <span>Posteriores</span>
                <strong>{cntPosteriores}</strong>
              </div>

              <div>
                <span>Acta</span>
                <strong>{actaOK ? 'Cargada' : 'Pendiente'}</strong>
              </div>
            </div>

            <div className={`geo-box ${geoStatus}`}>
              <div>
                <span>Geolocalizacion</span>
                <strong>
                  {geolocalizacion
                    ? `${geolocalizacion.latitud.toFixed(6)}, ${geolocalizacion.longitud.toFixed(6)}`
                    : 'Sin ubicacion capturada'}
                </strong>
                <p>
                  {geoMessage || 'La ubicacion se solicitara al generar el informe.'}
                </p>
              </div>

              <button
                type="button"
                className="btn ghost"
                onClick={solicitarGeolocalizacion}
                disabled={geoStatus === 'loading' || genLoading}
              >
                {geoStatus === 'loading'
                  ? 'Solicitando...'
                  : geolocalizacion
                    ? 'Actualizar ubicacion'
                    : 'Capturar ubicacion'}
              </button>
            </div>

            {genErr && <p className="error-message">{genErr}</p>}

            {genUrl && (
              <div className="result-box">
                <span>Informe generado</span>
                <a href={genUrl} target="_blank" rel="noreferrer">
                  Ver PDF
                </a>
              </div>
            )}

            <div className="actions between">
              <button type="button" className="btn secondary" onClick={goBack}>
                Atras
              </button>

              <div className="right-actions">
                {!genUrl && (
                  <button type="button" className="btn primary" disabled={genLoading} onClick={handleGenerarPDF}>
                    {genLoading ? 'Generando...' : 'Generar PDF'}
                  </button>
                )}

                {genUrl && (
                  <>
                    <button type="button" className="btn primary" onClick={handleShareWhatsApp}>
                      Compartir por WhatsApp
                    </button>

                    <button type="button" className="btn ghost" onClick={() => resetFlow(false)}>
                      Nuevo informe
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      {step > 1 && (
        <button type="button" className="floating-start" onClick={() => setStep(1)}>
          Volver al inicio
        </button>
      )}

      <style>{`
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
          margin: 18px 0;
        }

        .step-dot {
          height: 8px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.12);
          position: relative;
          overflow: hidden;
        }

        .step-dot span {
          position: absolute;
          opacity: 0;
        }

        .step-dot.active {
          background: #fff200;
          box-shadow: 0 0 24px rgba(255, 242, 0, 0.35);
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
          animation: enter 220ms ease-out;
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

        .filters-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
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

        .hidden-input {
          display: none;
        }

        .file-card {
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
        .geo-box.unavailable {
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

        @keyframes enter {
          from {
            opacity: 0;
            transform: translateY(6px);
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
          .topbar {
            flex-direction: column;
            align-items: stretch;
          }

          .top-actions {
            justify-content: stretch;
          }

          .top-actions .btn {
            flex: 1;
          }

          .hero {
            flex-direction: column;
          }

          .session-chip {
            min-width: 0;
          }

          .filters-grid,
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
            left: 18px;
            right: 18px;
            bottom: 16px;
            width: calc(100% - 36px);
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
      `}</style>
    </div>
  );
};

export default DashboardPage;