// DashboardPage.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

/* =============================
   GlassSelect (JSX/JS puro)
============================= */
const GlassSelect = ({ value, onChange, options, placeholder = 'Selecciona…', disabled = false, ariaLabel }) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 280 });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const idx = options.findIndex(o => o.value === value);
    setActiveIndex(idx >= 0 ? idx : 0);

    const rect = triggerRef.current?.getBoundingClientRect?.() || {};
    const vw = window.innerWidth, vh = window.innerHeight;
    const width = Math.min(Math.max(rect.width || 280, 260), 520);
    const left = Math.min(Math.max((rect.left || 0), 8), vw - width - 8);
    const topCandidate = (rect.bottom || 0) + 6;
    setPanelPos({ top: Math.min(topCandidate, vh - 120), left, width });

    setTimeout(() => panelRef.current?.focus?.(), 0);
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onResize = () => setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); };
  }, [open, value, options]);

  const handleSelect = (val) => { onChange(val); setOpen(false); triggerRef.current?.focus?.(); };

  const onKeyDownTrigger = (e) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); }
  };

  const onKeyDownPanel = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const opt = options[activeIndex]; if (opt) handleSelect(opt.value); }
  };

  const selectedLabel = options.find(o => o.value === value)?.label;

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
        <span className={`selected ${!selectedLabel ? 'placeholder' : ''}`}>{selectedLabel || placeholder}</span>
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
            style={{ top: panelPos.top, left: panelPos.left, width: panelPos.width }}
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
                  {isSel && <span className="check">✓</span>}
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

/* =============================
   Helpers
============================= */
const norm = (s) => String(s || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

/* Número animado para contadores */
const useAnimatedNumber = (value, duration = 500) => {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef(null);

  useEffect(() => {
    const from = display;
    const to = value;
    const start = performance.now();

    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = t * (2 - t);
      const v = Math.round(from + (to - from) * eased);
      setDisplay(v);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return display;
};

/* =============================
   DashboardPage (JSX)
============================= */
const DashboardPage = () => {
  const navigate = useNavigate();

  /* Paso y estados */
  const [step, setStep] = useState(() => {
    const v = Number(localStorage.getItem('dashStep') || 1);
    return Number.isFinite(v) && v >= 1 && v <= 4 ? v : 1;
  });

  const [imagen, setImagen] = useState(null);
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

  const [tiendas, setTiendas] = useState([]);
  const [selectedTienda, setSelectedTienda] = useState('');
  const [filtroDepartamento, setFiltroDepartamento] = useState('');
  const [filtroCiudad, setFiltroCiudad] = useState('');
  const [searchText, setSearchText] = useState('');

  const sesionId = localStorage.getItem('sesionId') || '';
  const nombreTecnico = localStorage.getItem('nombreTecnico') || 'Técnico';
  const isAdmin = sesionId.toLowerCase() === 'admin';

  useEffect(() => { if (!sesionId) navigate('/'); }, [navigate, sesionId]);
  useEffect(() => { localStorage.setItem('dashStep', String(step)); }, [step]);

  /* Cargar tiendas */
  useEffect(() => {
    const fetchTiendas = async () => {
      try {
        const res = await axios.get('https://cubica-photo-app.onrender.com/tiendas');
        setTiendas(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error('Error al obtener tiendas del backend:', error);
        setTiendas([]);
      }
    };
    fetchTiendas();
  }, []);

  /* Derivados */
  const departamentos = useMemo(() => {
    const set = new Set(tiendas.map(t => (t?.departamento ?? '').toString().trim()).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [tiendas]);

  const ciudades = useMemo(() => {
    const base = filtroDepartamento ? tiendas.filter(t => (t?.departamento ?? '').trim() === filtroDepartamento) : tiendas;
    const set = new Set(base.map(t => (t?.ciudad ?? '').toString().trim()).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [tiendas, filtroDepartamento]);

  const filteredTiendas = useMemo(() => {
    const q = norm(searchText);
    return tiendas
      .filter(t => {
        const okDept = filtroDepartamento ? (t?.departamento ?? '').trim() === filtroDepartamento : true;
        const okCity = filtroCiudad ? (t?.ciudad ?? '').trim() === filtroCiudad : true;
        if (!(okDept && okCity)) return false;
        if (!q) return true;
        const hay = [t?.nombre, t?.ciudad, t?.departamento].map(norm).some(s => s.includes(q));
        return hay;
      })
      .sort((a, b) => (a?.nombre || '').localeCompare((b?.nombre || ''), 'es', { sensitivity: 'base' }));
  }, [tiendas, filtroDepartamento, filtroCiudad, searchText]);

  useEffect(() => {
    if (selectedTienda && !filteredTiendas.some(t => t._id === selectedTienda)) setSelectedTienda('');
  }, [filteredTiendas, selectedTienda]);

  /* Previews */
  useEffect(() => () => { if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl); }, [pdfPreviewUrl]);
  useEffect(() => {
    if (!acta) {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(acta);
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    setPdfPreviewUrl(url);
  }, [acta]);

  useEffect(() => () => { if (imgPreviewUrl) URL.revokeObjectURL(imgPreviewUrl); }, [imgPreviewUrl]);
  useEffect(() => {
    if (!actaImgs || actaImgs.length === 0) {
      if (imgPreviewUrl) URL.revokeObjectURL(imgPreviewUrl);
      setImgPreviewUrl(null);
      return;
    }
    const first = actaImgs[0];
    if (first && first.type?.startsWith('image/')) {
      const url = URL.createObjectURL(first);
      if (imgPreviewUrl) URL.revokeObjectURL(imgPreviewUrl);
      setImgPreviewUrl(url);
    } else {
      if (imgPreviewUrl) URL.revokeObjectURL(imgPreviewUrl);
      setImgPreviewUrl(null);
    }
  }, [actaImgs]);

  useEffect(() => () => { if (evidPreviewUrl) URL.revokeObjectURL(evidPreviewUrl); }, [evidPreviewUrl]);
  useEffect(() => {
    if (!imagen) {
      if (evidPreviewUrl) URL.revokeObjectURL(evidPreviewUrl);
      setEvidPreviewUrl(null);
      return;
    }
    if (imagen && imagen.type?.startsWith('image/')) {
      const url = URL.createObjectURL(imagen);
      if (evidPreviewUrl) URL.revokeObjectURL(evidPreviewUrl);
      setEvidPreviewUrl(url);
    } else {
      if (evidPreviewUrl) URL.revokeObjectURL(evidPreviewUrl);
      setEvidPreviewUrl(null);
    }
  }, [imagen]);

  /* Contadores animados */
  const animPrev = useAnimatedNumber(cntPrevias, 450);
  const animPost = useAnimatedNumber(cntPosteriores, 450);
  useEffect(() => { if (cntPrevias >= 0) { setBumpPrev(true); const t = setTimeout(() => setBumpPrev(false), 340); return () => clearTimeout(t); } }, [cntPrevias]);
  useEffect(() => { if (cntPosteriores >= 0) { setBumpPost(true); const t = setTimeout(() => setBumpPost(false), 340); return () => clearTimeout(t); } }, [cntPosteriores]);

  /* Acciones */
  const limpiarFiltros = () => { setFiltroDepartamento(''); setFiltroCiudad(''); setSearchText(''); };

  const handleCerrarSesion = () => {
    try {
      localStorage.removeItem('sesionId');
      localStorage.removeItem('nombreTecnico');
      localStorage.removeItem('dashStep');
    } catch {}
    navigate('/');
  };

  const pickEvid = () => evidenciaRef.current && evidenciaRef.current.click();

  const clearEvid = (e) => {
    e?.stopPropagation?.();
    setImagen(null);
    if (evidenciaRef.current) evidenciaRef.current.value = '';
    if (evidPreviewUrl) { URL.revokeObjectURL(evidPreviewUrl); setEvidPreviewUrl(null); }
  };

  const handleSubirImagen = async (e) => {
    e.preventDefault();
    if (!imagen || !tipo || !selectedTienda) { setMensaje('Por favor completa todos los campos.'); return; }

    const formData = new FormData();
    formData.append('imagen', imagen);
    formData.append('tipo', tipo);
    formData.append('sesionId', sesionId);
    formData.append('ubicacion', selectedTienda);
    formData.append('observacion', observacion);

    const tipoEnviado = tipo;
    setCargando(true);
    try {
      const res = await fetch('https://cubica-photo-app.onrender.com/imagenes/subir', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        if (tipoEnviado === 'previa') setCntPrevias(x => x + 1);
        else setCntPosteriores(x => x + 1);
      }
      setMensaje(data.mensaje || (res.ok ? 'Imagen y observación enviadas correctamente' : 'Error al subir la imagen'));
      setImagen(null); setObservacion('');
      if (evidenciaRef.current) evidenciaRef.current.value = '';
      setTipo(tipoEnviado === 'previa' ? 'posterior' : 'previa');
      setTimeout(() => setMensaje(''), 3000);
    } catch (error) {
      console.error(error);
      setMensaje('Error al subir la imagen');
    } finally {
      setCargando(false);
    }
  };

  const clearPdf = (e, opts = {}) => {
    e?.stopPropagation?.();
    const keepStatus = !!opts.keepStatus;
    setActa(null);
    if (!keepStatus) setActaOK(false);
    if (pdfRef.current) pdfRef.current.value = '';
    if (pdfPreviewUrl) { URL.revokeObjectURL(pdfPreviewUrl); setPdfPreviewUrl(null); }
  };

  const clearImgs = (e, opts = {}) => {
    e?.stopPropagation?.();
    const keepStatus = !!opts.keepStatus;
    setActaImgs([]);
    if (!keepStatus) setActaOK(false);
    if (imgsRef.current) imgsRef.current.value = '';
    if (imgPreviewUrl) { URL.revokeObjectURL(imgPreviewUrl); setImgPreviewUrl(null); }
  };

  const handleSubirActa = async (e) => {
    e.preventDefault();
    if (!acta && actaImgs.length === 0) { setMensajeActa('Selecciona un PDF o una imagen del acta'); return; }

    const formData = new FormData();
    formData.append('sesionId', sesionId);
    if (acta) formData.append('acta', acta);
    actaImgs.forEach(img => formData.append('imagenes', img));

    setCargandoActa(true);
    try {
      const res = await fetch('https://cubica-photo-app.onrender.com/acta/subir', { method: 'POST', body: formData });
      const data = await res.json();
      setMensajeActa(data?.mensaje || (res.ok ? 'Archivo(s) subido(s) correctamente' : 'Error al subir'));
      if (res.ok) {
        clearPdf(null, { keepStatus: true });
        clearImgs(null, { keepStatus: true });
        setActaOK(true);
      }
      setTimeout(() => setMensajeActa(''), 3000);
    } catch (error) {
      console.error(error);
      setMensajeActa('Error en la conexión con el servidor');
    } finally {
      setCargandoActa(false);
    }
  };

  const handleGenerarPDF = async () => {
    if (!selectedTienda) { window.alert('Selecciona una tienda antes de generar el PDF.'); return; }
    if (cntPrevias < 1 || cntPosteriores < 1) { window.alert('Debes subir al menos 1 imagen PREVIA y 1 POSTERIOR para generar el informe.'); return; }

    setGenErr(''); setGenUrl(''); setGenLoading(true);
    try {
      const jsonUrl = `https://cubica-photo-app.onrender.com/pdf/generar/${sesionId}?tiendaId=${selectedTienda}&format=json`;
      const res = await fetch(jsonUrl, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('No se pudo obtener el enlace del informe');
      const data = await res.json();
      const cloudUrl = data?.url;
      if (!cloudUrl) throw new Error('Respuesta sin URL de informe');
      setGenUrl(cloudUrl);
    } catch (err) {
      console.error(err);
      setGenErr('Error al generar/obtener el enlace del informe. Intenta de nuevo.');
    } finally {
      setGenLoading(false);
    }
  };

  const handleShareWhatsApp = () => {
    if (!genUrl) return;

    const tiendaOptsLocal = filteredTiendas.map(t => ({ value: t._id, label: `${t.nombre} — ${t.departamento}, ${t.ciudad}` }));
    const tiendaLabel = (tiendaOptsLocal.find(o => o.value === selectedTienda)?.label || '').trim();
    const texto = `Informe técnico${tiendaLabel ? ` - ${tiendaLabel}` : ''}\n${genUrl}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(texto)}`;

    const cleanupAll = () => {
      try {
        resetFlow();
        localStorage.removeItem('sesionId');
        localStorage.removeItem('nombreTecnico');
        localStorage.removeItem('dashStep');
      } catch {}
    };

    const popup = window.open(waUrl, '_blank', 'noopener,noreferrer');
    if (popup && !popup.closed) {
      popup.opener = null;
      setTimeout(() => { cleanupAll(); navigate('/'); }, 400);
    } else {
      cleanupAll();
      window.location.href = waUrl;
    }
  };

  /* Opciones */
  const departamentosOptions = useMemo(() => [{ value: '', label: 'Todos' }, ...departamentos.map(d => ({ value: d, label: d }))], [departamentos]);
  const ciudadesOptions = useMemo(() => [{ value: '', label: 'Todas' }, ...ciudades.map(c => ({ value: c, label: c }))], [ciudades]);
  const tiendaOptions = useMemo(() => filteredTiendas.map(t => ({ value: t._id, label: `${t.nombre} — ${t.departamento}, ${t.ciudad}` })), [filteredTiendas]);
  const tipoOptions = [{ value: 'previa', label: 'Previa' }, { value: 'posterior', label: 'Posterior' }];

  const pickPdf = () => pdfRef.current && pdfRef.current.click();
  const pickImgs = () => imgsRef.current && imgsRef.current.click();

  const onSelectTienda = (val) => {
    if (step > 1) return;
    setSelectedTienda(val);
    setCntPrevias(0);
    setCntPosteriores(0);
    setActaOK(false);
  };

  const canNextFrom1 = !!selectedTienda;
  const hasAnyEvidence = (cntPrevias + cntPosteriores) > 0;
  const canNextFrom2 = hasAnyEvidence;
  const canNextFrom3 = actaOK;

  const goNext = () => setStep(s => Math.min(4, s + 1));
  const goBack = () => setStep(s => Math.max(1, s - 1));
  const resetFlow = () => {
    setStep(1);
    setCntPrevias(0);
    setCntPosteriores(0);
    setActaOK(false);
    setGenLoading(false);
    setGenUrl('');
    setGenErr('');
  };

  return (
    <div className="dash-root">
      <div className="topbar">
        <div className="hello">Hola, <strong>{nombreTecnico}</strong></div>
        <div className="actions">
          {isAdmin && <button className="btn-outline" onClick={() => navigate('/informes')}>Ver Informes</button>}
          <button className="btn-danger" onClick={handleCerrarSesion}>Cerrar sesión</button>
        </div>
      </div>

      <div className="content">
        <div className="stack">
          <h1 className="title">Dashboard</h1>

          <div className="stepper card">
            <div className="steps">
              <div className={`step ${step >= 1 ? 'done' : ''} ${step === 1 ? 'current' : ''}`}><span>1</span> Ubicación</div>
              <div className={`step ${step >= 2 ? 'done' : ''} ${step === 2 ? 'current' : ''}`}><span>2</span> Evidencias</div>
              <div className={`step ${step >= 3 ? 'done' : ''} ${step === 3 ? 'current' : ''}`}><span>3</span> Acta</div>
              <div className={`step ${step >= 4 ? 'done' : ''} ${step === 4 ? 'current' : ''}`}><span>4</span> PDF</div>
            </div>

            <div className="step-quick">
              <div className="counters">
                <span className={`badge ${bumpPrev ? 'bump' : ''}`} aria-live="polite" aria-atomic="true">
                  <span className="dot pre" aria-hidden="true" />
                  <span className="num">{animPrev}</span> previas
                </span>
                <span className={`badge ${bumpPost ? 'bump' : ''}`} aria-live="polite" aria-atomic="true">
                  <span className="dot post" aria-hidden="true" />
                  <span className="num">{animPost}</span> posteriores
                </span>
              </div>
              <div>Acta: {actaOK ? 'Lista' : 'Pendiente'}</div>
              <button type="button" className="btn-outline" onClick={resetFlow}>Reiniciar flujo</button>
            </div>
          </div>

          {step === 1 && (
            <div className="card">
              <h2 className="subtitle">Ubicación — Filtros</h2>

              <div className="filters-grid">
                <div className="field">
                  <label className="label">Departamento</label>
                  <GlassSelect
                    value={filtroDepartamento}
                    onChange={(val) => { setFiltroDepartamento(val); setFiltroCiudad(''); }}
                    options={departamentosOptions}
                    placeholder="Todos"
                    ariaLabel="Filtrar por departamento"
                  />
                </div>
                <div className="field">
                  <label className="label">Ciudad</label>
                  <GlassSelect
                    value={filtroCiudad}
                    onChange={(val) => setFiltroCiudad(val)}
                    options={ciudadesOptions}
                    placeholder="Todas"
                    ariaLabel="Filtrar por ciudad"
                    disabled={ciudadesOptions.length <= 1}
                  />
                </div>
              </div>

              <div className="field">
                <label className="label">Buscar tienda</label>
                <input
                  className="input"
                  type="search"
                  inputMode="search"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="Nombre, ciudad o departamento"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>

              <div className="field">
                <label className="label"><strong>Ubicación del D1</strong></label>
                <GlassSelect
                  value={selectedTienda}
                  onChange={onSelectTienda}
                  options={tiendaOptions}
                  placeholder={`Selecciona una tienda (${filteredTiendas.length})`}
                  ariaLabel="Seleccionar tienda"
                  disabled={tiendaOptions.length === 0}
                />
              </div>

              <div className="filters-actions">
                <div className="hint">{filteredTiendas.length} resultado{filteredTiendas.length === 1 ? '' : 's'}</div>
                <button type="button" className="btn-outline" onClick={limpiarFiltros}>Limpiar filtros</button>
              </div>

              <div className="wizard-actions">
                <button className="btn" onClick={() => canNextFrom1 && goNext()} disabled={!canNextFrom1}>Continuar</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubirImagen} className={`card ${cargando ? 'is-busy' : ''}`}>
              {cargando && <div className="md-progress" aria-hidden="true" />}
              <h2 className="subtitle">Subir Imagen</h2>

              <div className="info-row">
                <div>Tienda: <strong>{tiendaOptions.find(o => o.value === selectedTienda)?.label || 'Sin tienda'}</strong></div>
                <div className="counters">
                  <span className={`badge ${bumpPrev ? 'bump' : ''}`}><span className="dot pre" />{animPrev} previas</span>
                  <span className={`badge ${bumpPost ? 'bump' : ''}`}><span className="dot post" />{animPost} posteriores</span>
                </div>
              </div>

              <div className="upload-toggles upload-toggles--center">
                <button type="button" className="upload-btn" onClick={pickEvid} aria-label="Seleccionar imagen de evidencia">
                  <span className="thumb-wrap">
                    {evidPreviewUrl ? (
                      <span className="thumb-box-lg" aria-label="Imagen de evidencia seleccionada">
                        <img src={evidPreviewUrl} alt="Previsualización evidencia" className="thumb-img-lg" />
                        <span
                          className="clear-x"
                          role="button"
                          tabIndex={0}
                          onClick={(e) => clearEvid(e)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clearEvid(e); } }}
                          aria-label="Quitar imagen"
                        >×</span>
                      </span>
                    ) : (
                      <span className="icon-slab" aria-hidden="true">
                        <svg className="upload-icon" viewBox="0 0 48 48">
                          <path d="M24 30V12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none"/>
                          <path d="M17 18l7-8 7 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                          <rect x="12" y="32" width="24" height="6" rx="3" fill="currentColor" opacity=".95"/>
                        </svg>
                      </span>
                    )}
                  </span>
                  <span className="upload-label">Subir imagen de evidencia</span>
                </button>
              </div>

              <input
                ref={evidenciaRef}
                id="evidencia-input"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                required
                onChange={(e) => setImagen(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
              />

              {imagen && <div className="hint" style={{ marginTop: 10 }}>Imagen: {imagen.name}</div>}

              <div className="field" style={{ marginTop: 10 }}>
                <label className="label"><strong>Tipo de imagen</strong></label>
                <GlassSelect
                  value={tipo}
                  onChange={(v) => setTipo(v)}
                  options={tipoOptions}
                  placeholder="Selecciona tipo"
                  ariaLabel="Seleccionar tipo de imagen"
                />
              </div>

              <div className="field">
                <label className="label"><strong>Observación (opcional)</strong></label>
                <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} rows={3} className="textarea" />
              </div>

              <button type="submit" className={`btn ${cargando ? 'is-loading' : ''}`} disabled={cargando}>
                {cargando ? <span className="md-spinner" aria-label="Cargando" /> : 'Subir Imagen'}
              </button>
              {mensaje && <p className="msg">{mensaje}</p>}

              <div className="wizard-actions">
                <button type="button" className="btn-outline" onClick={goBack}>Regresar</button>
                <button type="button" className="btn" onClick={() => canNextFrom2 && goNext()} disabled={!canNextFrom2}>Continuar</button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleSubirActa} className={`card ${cargandoActa ? 'is-busy' : ''}`}>
              {cargandoActa && <div className="md-progress" aria-hidden="true" />}
              <h2 className="subtitle">Subir Acta</h2>

              <div className="info-row">
                <div className="counters">
                  <span className={`badge ${bumpPrev ? 'bump' : ''}`}><span className="dot pre" />{animPrev} previas</span>
                  <span className={`badge ${bumpPost ? 'bump' : ''}`}><span className="dot post" />{animPost} posteriores</span>
                </div>
                <div>Acta: {actaOK ? 'Lista' : 'Pendiente'}</div>
              </div>

              <div className="upload-toggles">
                <button type="button" className="upload-btn" onClick={pickPdf} aria-label="Subir acta formato PDF">
                  <span className="thumb-wrap">
                    {acta ? (
                      <span className="thumb-box-lg pdf" aria-label="PDF seleccionado">
                        <span className="pdf-badge">PDF</span>
                        <span
                          className="clear-x"
                          role="button"
                          tabIndex={0}
                          onClick={(e) => clearPdf(e)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clearPdf(e); } }}
                          aria-label="Quitar PDF"
                        >×</span>
                      </span>
                    ) : (
                      <span className="icon-slab" aria-hidden="true">
                        <svg className="upload-icon" viewBox="0 0 48 48">
                          <path d="M24 30V12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none"/>
                          <path d="M17 18l7-8 7 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                          <rect x="12" y="32" width="24" height="6" rx="3" fill="currentColor" opacity=".95"/>
                        </svg>
                      </span>
                    )}
                  </span>
                  <span className="upload-label">Subir acta formato PDF</span>
                </button>

                <button type="button" className="upload-btn" onClick={pickImgs} aria-label="Subir acta formato imagen">
                  <span className="thumb-wrap">
                    {imgPreviewUrl ? (
                      <span className="thumb-box-lg" aria-label="Imagen de acta seleccionada">
                        <img src={imgPreviewUrl} alt="Previsualización acta" className="thumb-img-lg" />
                        {actaImgs.length > 1 && <span className="thumb-count-lg">+{actaImgs.length - 1}</span>}
                        <span
                          className="clear-x"
                          role="button"
                          tabIndex={0}
                          onClick={(e) => clearImgs(e)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clearImgs(e); } }}
                          aria-label="Quitar imágenes"
                        >×</span>
                      </span>
                    ) : (
                      <span className="icon-slab" aria-hidden="true">
                        <svg className="upload-icon" viewBox="0 0 48 48">
                          <path d="M24 30V12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none"/>
                          <path d="M17 18l7-8 7 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                          <rect x="12" y="32" width="24" height="6" rx="3" fill="currentColor" opacity=".95"/>
                        </svg>
                      </span>
                    )}
                  </span>
                  <span className="upload-label">Subir acta formato imagen</span>
                </button>
              </div>

              <input
                ref={pdfRef}
                id="pdf-input"
                type="file"
                accept="application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => setActa(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
              />
              <input
                ref={imgsRef}
                id="acta-images-input"
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => setActaImgs(Array.from(e.target.files || []))}
              />

              {(acta || actaImgs.length > 0) && (
                <div className="hint" style={{ marginTop: 10 }}>
                  {acta ? `PDF: ${acta.name}` : ''}{acta && actaImgs.length > 0 ? ' • ' : ''}{actaImgs.length > 0 ? `${actaImgs.length} imagen${actaImgs.length === 1 ? '' : 'es'}` : ''}
                </div>
              )}

              <button type="submit" className={`btn ${cargandoActa ? 'is-loading' : ''}`} disabled={cargandoActa}>
                {cargandoActa ? <span className="md-spinner" aria-label="Cargando" /> : 'Subir Acta'}
              </button>
              {mensajeActa && <p className="msg">{mensajeActa}</p>}

              <div className="wizard-actions">
                <button type="button" className="btn-outline" onClick={goBack}>Regresar</button>
                <button type="button" className="btn" onClick={() => canNextFrom3 && goNext()} disabled={!canNextFrom3}>Continuar</button>
              </div>
            </form>
          )}

          {step === 4 && (
            <>
              {!genLoading && !genUrl && !genErr && (
                <>
                  <div className="card">
                    <h2 className="subtitle">Resumen</h2>
                    <div className="hint">Ubicación: <strong>{tiendaOptions.find(o => o.value === selectedTienda)?.label || 'Sin tienda'}</strong></div>
                    <div className="hint">Evidencias: {animPrev} previas · {animPost} posteriores</div>
                    <div className="hint">Acta: {actaOK ? 'Lista' : 'Pendiente'}</div>
                    <div className="wizard-actions">
                      <button type="button" className="btn-outline" onClick={goBack}>Regresar</button>
                    </div>
                  </div>
                  <button onClick={handleGenerarPDF} className="btn-primary" disabled={cntPrevias < 1 || cntPosteriores < 1}>
                    Generar informe
                  </button>
                </>
              )}

              {genLoading && (
                <div className="card is-busy">
                  <div className="md-progress" aria-hidden="true" />
                  <h2 className="subtitle">Generando informe</h2>
                  <div className="loader-wrap">
                    <div className="md-spinner" aria-label="Cargando" />
                    <div className="hint" style={{ marginTop: 8 }}>Esto puede tardar unos segundos…</div>
                  </div>
                </div>
              )}

              {!genLoading && genErr && (
                <div className="card">
                  <h2 className="subtitle">Error</h2>
                  <p className="msg">{genErr}</p>
                  <div className="wizard-actions">
                    <button type="button" className="btn-outline" onClick={() => { setGenErr(''); setGenUrl(''); }}>Intentar de nuevo</button>
                    <button type="button" className="btn-outline" onClick={goBack}>Regresar</button>
                  </div>
                </div>
              )}

              {!genLoading && genUrl && (
                <>
                  <div className="card">
                    <h2 className="subtitle">Vista previa</h2>
                    <div className="hint" style={{ marginBottom: 8 }}>Si el visor no carga, puedes abrir el PDF en otra pestaña.</div>
                    <iframe title="Informe PDF" src={genUrl} className="pdf-preview" />
                    <div className="wizard-actions" style={{ marginTop: 10 }}>
                      <a className="btn-outline" href={genUrl} target="_blank" rel="noreferrer">Abrir en pestaña</a>
                      <button type="button" className="btn" onClick={handleShareWhatsApp}>Compartir por WhatsApp</button>
                    </div>
                  </div>

                  <div className="wizard-actions">
                    <button type="button" className="btn-outline" onClick={resetFlow}>Reiniciar flujo</button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Estilos */}
      <style>{`
        /* --- No scroll horizontal, solo vertical --- */
        :where(html, body){ margin:0; height:100%; overflow-x:hidden; overflow-y:auto; }
        :where(.dash-root, .content, .stack){ overflow-x:hidden; }
        *{ box-sizing:border-box; min-width:0; }
        img, video, canvas{ max-width:100%; height:auto; display:block; }
        .hint, .msg, .label, .title, .subtitle{ overflow-wrap:anywhere; word-break:break-word; }

        html, body, #root { height: 100%; }
        html, body { background: #0f1113; }

        :root{
          --primary:#fff200;
          --on-primary:#111111;
          --bg:#0f1113;
          --surface:#15181c;
          --on-surface:#e9eaec;
          --outline:rgba(255,255,255,0.18);
          --outline-strong:rgba(255,255,255,0.28);
          --label:#b8bcc3;
          --danger:#ef4444;
          --focus:rgba(255,242,0,0.35);
          --upload-fg:#111111;
        }
        @media (prefers-color-scheme: dark){
          :root{ --upload-fg:#ffffff; }
        }

        .dash-root{
          min-height:100svh; min-height:100dvh; width:100%;
          background:var(--bg); color:var(--on-surface);
          font-family: Inter, Roboto, system-ui, -apple-system, Segoe UI, Helvetica, Arial;
          -webkit-tap-highlight-color: transparent;
          overscroll-behavior-x: none;
        }

        .topbar{
          position:sticky; top:max(8px, env(safe-area-inset-top,0px));
          display:flex; align-items:center; justify-content:space-between; gap:8px; margin:6px auto 10px;
          width:min(100%,960px); padding:10px 12px; border-radius:14px; background:rgba(255,255,255,0.06);
          border:1px solid var(--outline); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
          box-shadow:0 8px 24px rgba(0,0,0,0.18);
        }
        .hello{ font-weight:600; }
        .actions{ display:flex; gap:8px; flex-wrap:wrap; }

        .content{ display:flex; justify-content:center; width:100%; }
        .stack{ width:min(100%,960px); display:flex; flex-direction:column; align-items:center; gap:16px; padding:12px 12px 28px; }

        .title{ margin:6px 0 0 0; font-weight:800; font-size:clamp(18px,4.5vw,28px); letter-spacing:.2px; text-align:center; }
        .subtitle{ margin:0 0 10px 0; font-size:clamp(16px,4vw,20px); font-weight:700; }

        .card{
          position:relative;
          width:100%; max-width:560px; padding:16px; border-radius:16px; background:var(--surface);
          border:1px solid var(--outline); color:var(--on-surface);
          box-shadow:0 10px 36px rgba(0,0,0,0.30); transition:transform 160ms ease, box-shadow 180ms ease;
          animation: md-enter 260ms cubic-bezier(.2,.8,.2,1);
        }
        .card:hover{ transform: translateY(-1px); box-shadow: 0 12px 42px rgba(0,0,0,0.34); }
        .card.is-busy{ animation: md-busy 700ms ease-out 1; }

        .md-progress{
          position:absolute; top:0; left:0; right:0; height:3px; overflow:hidden;
          border-top-left-radius:16px; border-top-right-radius:16px; background:transparent;
        }
        .md-progress::before{
          content:""; position:absolute; inset:0;
          background: linear-gradient(90deg, transparent 0, rgba(255,242,0,.2) 30%, var(--primary) 52%, rgba(255,242,0,.2) 74%, transparent 100%);
          transform: translateX(-100%);
          animation: md-indeterminate 1.2s cubic-bezier(.4,0,.2,1) infinite;
        }

        .filters-grid{ display:grid; grid-template-columns:1fr; gap:10px; }
        @media (min-width:640px){ .filters-grid{ grid-template-columns:1fr 1fr; } }
        .filters-actions{ margin-top:6px; display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .hint{ font-size:.95rem; color:var(--label); }

        .field{ margin-bottom:10px; }
        .label{ display:block; font-weight:600; color:var(--label); margin-bottom:6px; }

        .input, .textarea{
          width:100%; border-radius:12px; border:1px solid var(--outline); background:transparent; color:var(--on-surface);
          font-size:16px; outline:none; transition:border-color 150ms ease, box-shadow 150ms ease, background 150ms ease;
        }
        .input{ height:48px; padding:10px 12px; }
        .textarea{ padding:10px 12px; resize:vertical; min-height:84px; }
        .input:focus, .textarea:focus{ box-shadow:0 0 0 4px var(--focus); border-color:var(--outline-strong); }

        .btn{
          width:100%; height:52px; padding:12px; background:var(--primary); color:var(--on-primary); border:none; border-radius:12px;
          font-weight:800; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;
          transition:transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease; user-select:none;
          box-shadow:0 8px 24px rgba(0,0,0,0.18);
        }
        .btn:hover{ transform:translateY(-1px); }
        .btn:active{ transform:translateY(0); }
        .btn:disabled{ opacity:.7; cursor:not-allowed; }
        .btn.is-loading{ animation: md-pulse 1.2s ease-in-out infinite; }

        .btn-primary{
          width:100%; max-width:560px; height:52px; padding:12px; background:var(--primary); color:var(--on-primary); border:none; border-radius:12px;
          font-weight:800; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;
          transition:transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease; user-select:none; box-shadow:0 8px 24px rgba(0,0,0,0.18);
        }
        .btn-primary:hover{ transform:translateY(-1px); }
        .btn-primary:active{ transform:translateY(0); }

        .btn-outline{
          height:44px; padding:8px 14px; border-radius:12px; font-weight:700; cursor:pointer;
          background:rgba(255,255,255,0.08); color:var(--on-surface); border:1px solid var(--outline);
          backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
          transition:transform 120ms ease, opacity 120ms ease, background 150ms ease, border-color 150ms ease;
        }
        .btn-outline:hover{ transform:translateY(-1px); }

        .msg{ margin-top:10px; font-weight:700; text-align:center; }

        .upload-toggles{ display:grid; grid-template-columns:1fr; gap:10px; margin-bottom:8px; }
        @media (min-width:520px){ .upload-toggles{ grid-template-columns:1fr 1fr; } }
        .upload-toggles--center{ grid-template-columns:1fr; justify-items:center; }
        @media (min-width:520px){ .upload-toggles--center{ grid-template-columns:1fr; } }
        .upload-toggles--center .upload-btn{ width:100%; max-width:440px; margin-inline:auto; }

        .upload-btn{
          position:relative; display:flex; align-items:center; gap:12px; width:100%; min-height:76px; padding:12px;
          border-radius:14px; background:rgba(255,255,255,0.10); border:1px solid var(--outline);
          backdrop-filter: blur(14px) saturate(135%); -webkit-backdrop-filter: blur(14px) saturate(135%);
          box-shadow: 0 10px 24px rgba(0,0,0,0.22); cursor:pointer; font-weight:800;
          color: var(--upload-fg);
          transition: transform 120ms ease, box-shadow 150ms ease, background 150ms ease, border-color 150ms ease, color 150ms ease;
          overflow: hidden;
        }
        .upload-btn:hover{ transform: translateY(-1px); box-shadow: 0 14px 32px rgba(0,0,0,0.28); }
        .upload-btn:active::after{
          content:""; position:absolute; inset:0; background: radial-gradient(120px 120px at var(--x,50%) var(--y,50%), rgba(255,255,255,0.18), transparent 70%);
          pointer-events:none;
        }
        .upload-btn:focus{ outline:none; box-shadow: 0 0 0 4px var(--focus); }

        .thumb-wrap{ position:relative; display:inline-grid; place-items:center; }
        .icon-slab{
          width:84px; height:64px; border-radius:12px; display:grid; place-items:center;
          background: linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.10));
          border:1px solid var(--outline);
          backdrop-filter: blur(10px) saturate(120%); -webkit-backdrop-filter: blur(10px) saturate(120%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 18px rgba(0,0,0,0.14);
          color: var(--upload-fg);
        }
        .upload-icon{ opacity:.95; }

        .thumb-box-lg{
          width:128px; height:84px; border-radius:12px; overflow:hidden; position:relative; display:grid; place-items:center;
          background: linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06)); border:1px solid var(--outline);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
        }
        .thumb-box-lg.pdf{ background:#e94f37; color:#fff; }
        .thumb-img-lg{ width:100%; height:100%; object-fit:cover; display:block; }
        .thumb-count-lg{
          position:absolute; right:-6px; bottom:-6px; background:rgba(0,0,0,0.78); color:#fff; font-size:12px; border-radius:10px; padding:2px 6px; line-height:1;
        }

        .pdf-badge{
          display:inline-block; padding:6px 10px; border-radius:10px;
          background:#e94f37; color:#fff; font-weight:800; font-size:13px; letter-spacing:.4px;
          box-shadow:0 4px 12px rgba(0,0,0,0.18);
        }

        .clear-x{
          position:absolute; top:6px; right:6px; width:24px; height:24px; line-height:22px; text-align:center; border-radius:10px;
          background: rgba(255,255,255,0.12); border:1px solid var(--outline);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          font-weight:800; cursor:pointer; user-select:none; color: var(--upload-fg);
        }

        .upload-label{ flex:1; text-align:left; font-weight:800; letter-spacing:.2px; }

        .counters{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
        .badge{
          display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:999px;
          background:rgba(255,255,255,0.10); border:1px solid var(--outline); font-weight:800; font-size:13px;
        }
        .badge .num{ min-width: 1ch; text-align:right; }
        .badge .dot{ width:8px; height:8px; border-radius:999px; display:inline-block; }
        .badge .dot.pre{ background:#60a5fa; }
        .badge .dot.post{ background:#34d399; }
        .badge.bump{ animation: badge-bump 340ms ease; }

        .glass-select { position: relative; }
        .select-trigger{
          width:100%; height:48px; padding:10px 12px; font-size:16px; border-radius:12px; border:1px solid var(--outline);
          background:transparent; color:var(--on-surface); display:flex; align-items:center; justify-content:space-between; gap:8px; cursor:pointer;
          transition:border-color 150ms ease, box-shadow 150ms ease, background 150ms ease;
        }
        .select-trigger:focus{ outline:none; box-shadow:0 0 0 4px var(--focus); }
        .select-trigger .selected.placeholder{ opacity:.75; }
        .select-trigger .chev{ flex-shrink:0; opacity:.75; }

        .dropdown-overlay{ position:fixed; inset:0; z-index:2147483647; background:rgba(0,0,0,0.12);
          backdrop-filter:blur(2.5px) saturate(120%); -webkit-backdrop-filter:blur(2.5px) saturate(120%); animation:fadeIn 120ms ease forwards; }
        .dropdown-panel{
          position:fixed; max-height:60svh; overflow:auto; -webkit-overflow-scrolling:touch; background:rgba(21,24,28,0.98); border:1px solid var(--outline);
          border-radius:14px; box-shadow:0 16px 40px rgba(0,0,0,0.28); padding:6px; animation:pop 140ms ease; color:var(--on-surface);
          max-width: calc(100vw - 16px);
        }
        .option{ display:flex; align-items:center; justify-content:space-between; gap:8px; padding:10px 12px; border-radius:10px; font-size:16px; cursor:pointer; transition:background 120ms ease, transform 120ms ease; }
        .option:hover, .option.active{ background:rgba(255,255,255,0.10); }
        .option.selected{ font-weight:700; }
        .option.empty{ opacity:.7; cursor:default; }
        .option .check{ opacity:.9; }

        .info-row{
          display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px; color:var(--label);
          font-size:.95rem; flex-wrap:wrap;
        }

        .wizard-actions{
          display:flex; gap:10px; justify-content:space-between; align-items:center; margin-top:12px;
        }

        .stepper .steps{
          display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:8px;
        }
        .stepper .step{
          display:flex; align-items:center; gap:8px; padding:8px; border-radius:12px; border:1px solid var(--outline); background:rgba(255,255,255,0.06);
          font-weight:700; font-size:clamp(12px,3.2vw,14px);
        }
        .stepper .step span{ width:22px; height:22px; display:inline-grid; place-items:center; border-radius:999px; background:rgba(0,0,0,0.15); }
        .stepper .step.current{ outline:2px solid var(--outline); }
        .stepper .step.done span{ background:#9ae6b4; }
        .step-quick{
          display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-top:6px; font-size:clamp(12px,3.2vw,14px);
        }

        .md-spinner{
          --sz: 22px;
          width: var(--sz);
          height: var(--sz);
          border-radius: 50%;
          background: conic-gradient(from 0deg, transparent 0 28%, var(--on-primary) 32% 64%, transparent 68% 100%);
          -webkit-mask: radial-gradient(farthest-side, transparent calc(50% - 4px), #000 calc(50% - 3px));
                  mask: radial-gradient(farthest-side, transparent calc(50% - 4px), #000 calc(50% - 3px));
          animation: md-rotate .9s linear infinite;
        }

        .pdf-preview{
          width:100%;
          display:block;
          height: clamp(320px, 65dvh, 80dvh);
          border:none; border-radius:12px; background:#fff;
        }
        @media (max-width: 600px){ .pdf-preview{ height: clamp(220px, 48dvh, 58dvh); } }
        @media (max-width: 380px){ .pdf-preview{ height: clamp(200px, 42dvh, 52dvh); } }

        @keyframes badge-bump{ 0%{ transform:scale(1);} 30%{ transform:scale(1.08);} 100%{ transform:scale(1);} }
        @keyframes md-enter{ from{ opacity:0; transform: translateY(4px) scale(.995);} to{ opacity:1; transform: translateY(0) scale(1);} }
        @keyframes md-busy{ 0%{transform:translateY(0) scale(1);} 40%{transform:translateY(-1px) scale(1.005);} 100%{transform:translateY(0) scale(1);} }
        @keyframes md-pulse{ 0%,100%{ box-shadow:0 8px 24px rgba(0,0,0,0.18); transform:translateY(0);} 50%{ box-shadow:0 12px 28px rgba(0,0,0,0.22); transform:translateY(-1px);} }
        @keyframes md-indeterminate{ to { transform: translateX(100%); } }
        @keyframes md-rotate{ to { transform: rotate(360deg); } }
      `}</style>

      {/* Ripple para botones de upload en JS puro */}
      <script dangerouslySetInnerHTML={{__html: `
        document.addEventListener('click', function(e){
          var target = e.target;
          if (!target || !target.closest) return;
          var btn = target.closest('.upload-btn');
          if (!btn) return;
          var rect = btn.getBoundingClientRect();
          btn.style.setProperty('--x', (e.clientX - rect.left) + 'px');
          btn.style.setProperty('--y', (e.clientY - rect.top) + 'px');
        }, { passive: true });
      `}} />
    </div>
  );
};

export default DashboardPage;
