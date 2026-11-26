/* App de formulario — Compras: solicitud de ecocardiograma ambulatorio por Trabajo Social.
   Esta app solo ENVÍA solicitudes. No tiene forma de leer datos de pacientes. */
(function () {
  'use strict';

  const CFG = window.APP_CONFIG || {};
  const $app = document.getElementById('app');
  const MAX_BYTES = 8 * 1024 * 1024;
  const LLAVE_SOLICITANTE = 'cardio_compras_solicitante';

  /* ---- Lista de hospitales. Debe coincidir con backend/formulario-api/Code.gs y backend/gestion-api/Code.gs ---- */
  const HOSPITALES = [
    'Consulta externa de Cardiología',
    'Consulta externa de Hemato/Oncología',
    'Consulta externa de Infectología',
    'H.N. "Dr. Juan Jose Fernandez", Zacamil',
    'H.N. "Dr. Luis Edmundo Vasquez", Chalatenango',
    'H.N. Neumologico "Dr. Jose Saldaña"',
    'H.N. Psiquiatrico "Dr. Jose Molina", Soyapango',
    'H.N. "Enf. Angelica Vidal", Ilopango',
    'H.N. "Nuestra Sra de Fatima", Cojutepeque',
    'H.N. "Dr. Francisco Menéndez", Ahuachapan',
    'H.N. "Dr. Jorge Mazzini Villacorta", Sonsonate',
    'H.N. "San Juan de Dios", Santa Ana',
    'H.N. "Dr. Arturo Morales", Metapán, Santa Ana',
    'H.N. De Chalchuapa, Santa Ana',
    'H.N. "San Rafael", Santa Tecla, La Libertad',
    'H.N. Nueva Concepcion, Chalatenango',
    'H.N. De Niños "Benjamin Bloom"',
    'H.N. De La Mujer "Dra. Maria Isabel Rodriguez"',
    'H.N. De Suchitoto, Cuscatlan',
    'H.N. "Santa Gertrudis", San Vicente',
    'H.N. "Santa Teresa", Zacatecoluca, La Paz',
    'H.N. "San Jerónimo Emiliani" De Sensuntepeque, Cabañas',
    'H.N. "Dr. José Luís Saca", Ilobasco, Cabañas',
    'H.N. "San Pedro", Usulután',
    'H.N. De Jiquilisco, Usulutan',
    'H.N. "Dr. Jorge Arturo Mena", Santiago de María, Usulután',
    'H.N. "San Juan de Dios", San Miguel',
    'H.N. Nueva Guadalupe, San Miguel',
    'H.N. "Monseñor Oscar Arnulfo Romero y Galdámez", Ciudad Barrios, San Miguel',
    'H.N. "Dr. Héctor Antonio Hernández Flores", San Francisco Gotera, Morazán',
    'H.N. De La Union',
    'H.N. Santa Rosa De Lima, La Union',
    'H.N. Rosales'
  ];
  const OTRO = 'Otro';
  const OTRO_TEXTO = 'Otro (introducir manualmente)';
  const SEXOS = ['Femenino', 'Masculino'];

  /* ---- Texto que se muestra después de enviar (se puede editar aquí) ---- */
  const AVISO_CITA = 'En cuanto le sea asignada una cita se le notificará por teléfono';

  // "op: true" = no obligatorio. "seccion" agrupa visualmente las preguntas.
  const CAMPOS = [
    { k: 'hospital', t: 'Hospital que refiere', tipo: 'hospital', ancho: true, seccion: 'Paciente',
      ayuda: 'Escriba parte del nombre o del lugar, por ejemplo "Zacamil", "Bloom" o "consulta". Si no está en la lista, elija "Otro".' },
    { k: 'expediente', t: 'Expediente del paciente', tipo: 'texto', max: 30, mayus: true },
    { k: 'nombre', t: 'Nombre completo del paciente', tipo: 'texto', max: 120 },
    { k: 'fecha_nacimiento', t: 'Fecha de nacimiento', tipo: 'fecha', ayuda: 'Día / mes / año. La edad se calcula sola.' },
    { k: 'sexo', t: 'Sexo', tipo: 'radio', op: SEXOS },
    { k: 'motivo', t: 'Motivo del estudio', tipo: 'area', ancho: true, opcional: true },
    { k: 'ekg', t: 'Electrocardiograma', tipo: 'archivo', opcional: true },
    { k: 'rx', t: 'Placa de rayos X', tipo: 'archivo', opcional: true },
    { k: 'peso', t: 'Peso', tipo: 'decimal', enteros: 3, decimales: 2, sufijo: 'kg', opcional: true },
    { k: 'talla', t: 'Talla', tipo: 'decimal', enteros: 3, decimales: 2, sufijo: 'cm', opcional: true, ayuda: 'En centímetros, por ejemplo 158' },
    { k: 'contacto', t: 'Teléfono de contacto del paciente', tipo: 'telefono', ancho: true,
      ayuda: 'Si no es de El Salvador, escríbalo con el código de país, por ejemplo +504…' },
    { k: 'ts_nombre', t: 'Nombre del Lic. de Trabajo Social que solicita', tipo: 'texto', max: 120, seccion: 'Trabajo Social que solicita' },
    { k: 'ts_contacto', t: 'Teléfono de contacto del Lic. de Trabajo Social', tipo: 'telefono',
      ayuda: 'A este número se notificará la fecha de la cita.' }
  ];
  const RECORDADOS = ['hospital', 'hospital_otro', 'ts_nombre', 'ts_contacto'];

  const E = { estado: null, errorEstado: '', cargando: false, form: null, instalar: null };

  /* ---------- utilidades ---------- */
  function h(tag, attrs) {
    const el = document.createElement(tag);
    const a = attrs || {};
    Object.keys(a).forEach(function (k) {
      const v = a[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    });
    for (let i = 2; i < arguments.length; i++) agregar(el, arguments[i]);
    return el;
  }
  function agregar(el, hijo) {
    if (hijo === null || hijo === undefined || hijo === false) return;
    if (Array.isArray(hijo)) hijo.forEach(function (x) { agregar(el, x); });
    else el.appendChild(hijo.nodeType ? hijo : document.createTextNode(String(hijo)));
  }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function tamano(bytes) { return bytes < 1048576 ? Math.max(1, Math.round(bytes / 1024)) + ' KB' : (bytes / 1048576).toFixed(1) + ' MB'; }
  function telefono(t) {
    const s = String(t || '');
    if (s.charAt(0) === '+') { const d = s.slice(1); return d.length === 11 ? '+' + d.slice(0, 3) + ' ' + d.slice(3, 7) + '-' + d.slice(7) : s; }
    const d = s.replace(/\D/g, '');
    return d.length === 8 ? d.slice(0, 4) + '-' + d.slice(4) : d;
  }
  /** "7123-4567" para El Salvador; "+504 9873-7544" (o el número con +) para otros países. */
  function formatoTelefono(valor) {
    const internacional = /^\s*\+/.test(valor);
    let d = valor.replace(/\D/g, '');
    if (internacional && !(d.slice(0, 3) === '503' && d.length === 11)) return '+' + d.slice(0, 15);
    if (d.length > 8 && d.slice(0, 3) === '503') d = d.slice(3); // pegado con código de país
    d = d.slice(0, 8);
    return d.length > 4 ? d.slice(0, 4) + '-' + d.slice(4) : d;
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'c-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }
  function leerRecordados() {
    try { return JSON.parse(localStorage.getItem(LLAVE_SOLICITANTE) || '{}') || {}; } catch (e) { return {}; }
  }
  function guardarRecordados(v) {
    try { if (v) localStorage.setItem(LLAVE_SOLICITANTE, JSON.stringify(v)); else localStorage.removeItem(LLAVE_SOLICITANTE); } catch (e) { /* sin almacenamiento */ }
  }

  async function api(action, datos) {
    if (!CFG.API_URL || /PEGAR_AQUI/.test(CFG.API_URL)) {
      const e0 = new Error('La app aún no está conectada. Falta pegar la dirección de la API en el archivo config.js.');
      e0.code = 'CONFIG';
      throw e0;
    }
    let res;
    try {
      res = await fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ action: action }, datos || {})) });
    } catch (e) {
      const e1 = new Error('No hay conexión con el servidor. Revise su internet e intente de nuevo.');
      e1.code = 'RED';
      throw e1;
    }
    let j;
    try { j = await res.json(); } catch (e) {
      const e2 = new Error('El servidor respondió de forma inesperada. Intente de nuevo en un momento.');
      e2.code = 'RED';
      throw e2;
    }
    if (!j.ok) { const e3 = new Error(j.error || 'Ocurrió un error.'); e3.code = j.code; throw e3; }
    return j.data;
  }

  /** Edad a partir de DD/MM/AAAA: {anios, meses, dias} o null si la fecha no es válida o es futura. */
  function edadDe(s) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s || ''));
    if (!m) return null;
    const d = Number(m[1]), mes = Number(m[2]), a = Number(m[3]);
    if (a < 1900 || mes < 1 || mes > 12 || d < 1 || d > new Date(a, mes, 0).getDate()) return null;
    const nac = new Date(a, mes - 1, d), hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (nac > hoy) return null;
    let meses = (hoy.getFullYear() - a) * 12 + (hoy.getMonth() - (mes - 1));
    if (hoy.getDate() < d) meses--;
    return { anios: Math.floor(meses / 12), meses: meses, dias: Math.round((hoy - nac) / 86400000) };
  }
  function textoEdad(e) {
    if (!e) return '';
    if (e.anios >= 2) return e.anios + ' años';
    if (e.anios === 1) return '1 año (' + e.meses + ' meses)';
    if (e.meses >= 1) return e.meses === 1 ? '1 mes' : e.meses + ' meses';
    return e.dias === 1 ? '1 día' : e.dias + ' días';
  }

  /* ---------- estado del formulario ---------- */
  async function cargarEstado(silencioso) {
    if (E.cargando) return;
    E.cargando = true;
    try {
      E.estado = await api('estado');
      E.errorEstado = '';
    } catch (e) {
      E.errorEstado = e.message;
    }
    E.cargando = false;
    // No se repinta mientras la persona escribe: solo cambia algo si el formulario se cerró o pide código.
    if (!silencioso || !E.form || (!E.form.sucio && !E.form.enviado)) pintar();
  }

  /* ---------- pantallas ---------- */
  function barra() {
    return h('header', { class: 'barra' }, h('div', { class: 'barra-int' },
      h('img', { class: 'logo', src: 'icons/icon-192.png', alt: '' }),
      h('h1', null, 'Compras · Ecocardiograma ambulatorio', h('small', null, 'Solicitud de Trabajo Social')),
      E.instalar ? h('button', { class: 'btn-barra', onclick: instalarApp }, 'Instalar') : null));
  }

  function pintar() {
    $app.textContent = '';
    $app.appendChild(barra());
    const main = h('main', { class: 'contenido' });
    $app.appendChild(main);
    if (E.form && E.form.enviado) { pintarExito(main); return; }
    if (E.estado && !E.estado.activo) { pintarCerrado(main); return; }
    if (!E.form) nuevoFormulario();
    main.appendChild(h('section', { class: 'leyenda' },
      h('h2', null, 'SOLICITUD DE ECOCARDIOGRAMA'),
      h('p', null, 'Para Trabajo Social de los hospitales de la red y de la consulta externa. Las preguntas marcadas "opcional" pueden quedar en blanco.'),
      E.form.recordados ? h('div', { class: 'recordados' }, h('span', null, 'Hospital, nombre y teléfono de Trabajo Social se llenaron con su última solicitud en este dispositivo.'),
        h('button', { type: 'button', onclick: olvidarRecordados }, 'Borrarlos')) : null));
    if (E.errorEstado) {
      main.appendChild(h('div', { class: 'aviso alerta', role: 'status' }, h('strong', null, 'Sin conexión con el servidor por ahora'),
        'Puede ir llenando la solicitud; se enviará cuando haya conexión.'));
    }
    main.appendChild(construirFormulario());
  }

  function pintarCerrado(main) {
    main.appendChild(h('div', { class: 'tarjeta' },
      h('div', { class: 'encabezado-form' }, h('h2', null, 'Solicitud de ecocardiograma'), h('span', { class: 'pastilla cerrado' }, 'Cerrado')),
      h('div', { class: 'aviso alerta' }, h('strong', null, 'El formulario no está recibiendo solicitudes en este momento.'), E.estado.mensaje || ''),
      h('p', { class: 'nota-oblig' }, 'Si el caso no puede esperar, comuníquese directamente con el Servicio de Cardiología.'),
      h('div', { class: 'acciones' }, h('button', { class: 'btn primario', onclick: function () { cargarEstado(); } }, E.cargando ? 'Actualizando…' : 'Volver a consultar'))));
  }

  function nuevoFormulario() {
    const previos = leerRecordados();
    const valores = {};
    RECORDADOS.forEach(function (k) { if (previos[k]) valores[k] = previos[k]; });
    if (valores.hospital && valores.hospital !== OTRO && HOSPITALES.indexOf(valores.hospital) < 0) delete valores.hospital;
    if (valores.hospital !== OTRO) delete valores.hospital_otro;
    E.form = { valores: valores, archivos: {}, errores: {}, sucio: false, idCliente: uuid(), codigo: previos.codigo || '', enviado: null,
      recordados: Object.keys(valores).length > 0 };
  }

  function olvidarRecordados() {
    guardarRecordados(null);
    RECORDADOS.forEach(function (k) { delete E.form.valores[k]; });
    E.form.recordados = false;
    pintar();
  }

  /* ---------- formulario ---------- */
  function construirFormulario() {
    const F = E.form;
    const rejilla = h('div', { class: 'rejilla' });
    const cajaError = h('div');
    if (E.estado && E.estado.requiere_codigo) {
      rejilla.appendChild(h('div', { class: 'campo ancho', id: 'campo-codigo' },
        h('label', { for: 'in-codigo' }, 'Código de acceso'),
        h('input', { id: 'in-codigo', type: 'text', autocomplete: 'off', maxlength: 20, value: F.codigo,
          oninput: function (ev) { F.codigo = ev.target.value.trim(); limpiarError('codigo'); } }),
        h('div', { class: 'ayuda' }, 'Lo proporciona el Servicio de Cardiología.'),
        h('div', { class: 'msg', id: 'msg-codigo', role: 'alert' }, F.errores.codigo || '')));
      if (F.errores.codigo) rejilla.lastChild.classList.add('mal');
    }
    CAMPOS.forEach(function (c, i) {
      if (c.seccion) rejilla.appendChild(h('div', { class: 'seccion-form' }, c.seccion));
      rejilla.appendChild(construirCampo(c, i + 1));
    });
    const btn = h('button', { class: 'btn primario grande', type: 'submit' }, 'Enviar solicitud');
    return h('form', { novalidate: true, autocomplete: 'off', onsubmit: function (ev) { ev.preventDefault(); enviar(cajaError, btn); } },
      h('div', { class: 'tarjeta' }, rejilla), cajaError, btn);
  }

  function marcarSucio() { if (E.form) E.form.sucio = true; }
  function soloDigitos(el, max) {
    const v = el.value.replace(/\D/g, '').slice(0, max);
    if (v !== el.value) el.value = v;
    return v;
  }

  function construirCampo(c, n) {
    const F = E.form;
    const id = 'in-' + c.k;
    const etiqueta = [h('span', { class: 'num' }, n + '.'), c.t, c.opcional ? h('span', { class: 'opc' }, '(opcional)') : null];
    const msg = h('div', { class: 'msg', id: 'msg-' + c.k, role: 'alert' });
    const caja = h('div', { class: 'campo' + (c.ancho ? ' ancho' : ''), id: 'campo-' + c.k });
    const poner = function (v) { F.valores[c.k] = v; marcarSucio(); limpiarError(c.k); };
    let control;

    if (c.tipo === 'radio') {
      control = h('div', { class: 'opciones dos', role: 'radiogroup', 'aria-labelledby': 'etq-' + c.k },
        c.op.map(function (o, i) {
          return h('label', { class: 'opcion' },
            h('input', { type: 'radio', name: c.k, value: o, checked: F.valores[c.k] === o, onchange: function () { poner(o); } }), o);
        }));
      agregar(caja, [h('div', { class: 'etq', id: 'etq-' + c.k }, etiqueta), control]);
    } else if (c.tipo === 'hospital') {
      // "Otro (introducir manualmente)": aparece un cuadro para escribir el nombre del hospital.
      const otro = h('input', { id: 'in-hospital_otro', type: 'text', maxlength: 120, placeholder: 'Escriba el nombre del hospital', value: F.valores.hospital_otro || '',
        'aria-label': 'Nombre del hospital (otro)', autocapitalize: 'words',
        oninput: function (ev) { F.valores.hospital_otro = ev.target.value; marcarSucio(); limpiarError(c.k); } });
      const cajaOtro = h('div', { class: 'otro-hospital', hidden: F.valores.hospital !== OTRO }, otro);
      const alElegir = function (v) {
        poner(v);
        cajaOtro.hidden = v !== OTRO;
        if (v === OTRO) setTimeout(function () { otro.focus(); }, 0);
      };
      agregar(caja, [h('label', { for: id, id: 'etq-' + c.k }, etiqueta), buscadorHospital(id, alElegir), cajaOtro]);
    } else if (c.tipo === 'area') {
      control = h('textarea', { id: id, maxlength: 2000, rows: 3, oninput: function (ev) { poner(ev.target.value); } }, F.valores[c.k] || '');
      agregar(caja, [h('label', { for: id }, etiqueta), control]);
    } else if (c.tipo === 'texto') {
      control = h('input', { id: id, type: 'text', maxlength: c.max, value: F.valores[c.k] || '', autocapitalize: c.mayus ? 'characters' : 'words',
        spellcheck: c.mayus ? 'false' : null, oninput: function (ev) { poner(ev.target.value); } });
      agregar(caja, [h('label', { for: id }, etiqueta), control]);
    } else if (c.tipo === 'decimal' || c.tipo === 'telefono') {
      // Sin "maxlength": el filtro de abajo recorta, y así se puede pegar un número con espacios o guiones.
      control = h('input', { id: id, type: 'text', inputmode: c.tipo === 'decimal' ? 'decimal' : 'tel', value: F.valores[c.k] || '',
        placeholder: c.tipo === 'telefono' ? '0000-0000' : '', autocomplete: c.tipo === 'telefono' ? 'tel-national' : 'off',
        oninput: function (ev) {
          const el = ev.target;
          let v;
          if (c.tipo === 'decimal') {
            v = el.value.replace(',', '.').replace(/[^\d.]/g, '');
            const p = v.split('.');
            v = p[0].slice(0, c.enteros) + (p.length > 1 ? '.' + p.slice(1).join('').slice(0, c.decimales) : '');
          } else {
            v = formatoTelefono(el.value);
          }
          if (v !== el.value) el.value = v;
          poner(v);
        } });
      agregar(caja, [h('label', { for: id }, etiqueta),
        c.sufijo ? h('div', { class: 'con-sufijo' }, control, h('span', null, c.sufijo)) : control]);
    } else if (c.tipo === 'fecha') {
      const largos = [2, 2, 4], ph = ['DD', 'MM', 'AAAA'], aria = ['Día de nacimiento', 'Mes de nacimiento', 'Año de nacimiento'];
      const previo = String(F.valores[c.k] || '').split('/');
      const entradas = [];
      const calculo = h('div', { class: 'calculo', 'aria-live': 'polite' });
      const mostrarEdad = function () {
        calculo.textContent = '';
        const e = edadDe(F.valores[c.k]);
        if (e) agregar(calculo, ['Edad: ', h('b', null, textoEdad(e))]);
      };
      const actualizar = function () {
        const partes = entradas.map(function (x) { return x.value; });
        poner(partes.some(Boolean) ? partes.join('/') : '');
        mostrarEdad();
      };
      largos.forEach(function (largo, i) {
        const inp = h('input', { type: 'text', inputmode: 'numeric', maxlength: largo, class: 'seg-' + largo, placeholder: ph[i],
          'aria-label': aria[i], id: i === 0 ? id : null, value: previo[i] || '',
          oninput: function (ev) {
            const v = soloDigitos(ev.target, largo);
            actualizar();
            if (v.length === largo && entradas[i + 1]) entradas[i + 1].focus();
          },
          onblur: function (ev) { if (i < 2 && ev.target.value.length === 1) { ev.target.value = '0' + ev.target.value; actualizar(); } },
          onkeydown: function (ev) {
            if ((ev.key === '/' || ev.key === '-' || ev.key === ' ' || ev.key === '.') && entradas[i + 1]) { ev.preventDefault(); if (ev.target.value) entradas[i + 1].focus(); }
            if (ev.key === 'Backspace' && !ev.target.value && entradas[i - 1]) entradas[i - 1].focus();
          } });
        entradas.push(inp);
      });
      const grupo = h('div', { class: 'segmentos', role: 'group', 'aria-labelledby': 'etq-' + c.k });
      entradas.forEach(function (inp, i) { if (i) grupo.appendChild(h('span', { class: 'sep', 'aria-hidden': 'true' }, '/')); grupo.appendChild(inp); });
      mostrarEdad();
      agregar(caja, [h('div', { class: 'etq', id: 'etq-' + c.k }, etiqueta), grupo, calculo]);
    } else if (c.tipo === 'archivo') {
      const zona = h('div', { class: 'zona' });
      const pintarZona = function () {
        zona.textContent = '';
        const arch = F.archivos[c.k];
        const entrada = h('input', { type: 'file', id: id, accept: '.jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf',
          onchange: async function (ev) {
            const f = ev.target.files && ev.target.files[0];
            if (!f) return;
            limpiarError(c.k);
            zona.textContent = 'Preparando archivo…';
            try { F.archivos[c.k] = await prepararArchivo(f); marcarSucio(); } catch (e) { delete F.archivos[c.k]; ponerError(c.k, e.message); }
            pintarZona();
          } });
        if (arch) {
          const editar = arch.vista ? h('button', { type: 'button', class: 'btn', onclick: async function () {
            const r = await abrirEditor(arch, c.t);
            if (!r) return;
            Object.assign(arch, r);
            marcarSucio();
            pintarZona();
          } }, 'Editar') : null;
          agregar(zona, [
            arch.vista ? h('img', { class: 'mini', src: arch.vista, alt: 'Vista previa' }) : h('div', { class: 'mini' }, 'PDF'),
            h('div', { class: 'info' }, h('b', null, arch.nombre), h('span', null, tamano(arch.blob.size) + (arch.editada ? ' · editada' : ''))),
            h('div', { class: 'botones-archivo' }, editar, h('label', { class: 'btn', for: id }, 'Cambiar')), entrada]);
        } else {
          agregar(zona, [h('div', { class: 'info' }, h('b', null, 'Ningún archivo seleccionado'), h('span', null, 'Foto o PDF · JPG, PNG o PDF · máximo 8 MB')),
            h('label', { class: 'btn', for: id }, 'Cargar archivo'), entrada]);
        }
      };
      pintarZona();
      agregar(caja, [h('div', { class: 'etq' }, etiqueta), zona]);
    }
    if (c.ayuda) caja.appendChild(h('div', { class: 'ayuda' }, c.ayuda));
    caja.appendChild(msg);
    if (F.errores[c.k]) { caja.classList.add('mal'); msg.textContent = F.errores[c.k]; }
    return caja;
  }

  /* ---------- buscador de hospital (lista desplegable con búsqueda) ---------- */
  function buscadorHospital(id, poner) {
    const F = E.form;
    const idLista = 'lista-hospital';
    const texto = function (v) { return v === OTRO ? OTRO_TEXTO : v || ''; };
    const input = h('input', { id: id, type: 'text', role: 'combobox', 'aria-expanded': 'false', 'aria-controls': idLista, 'aria-autocomplete': 'list',
      autocomplete: 'off', spellcheck: 'false', placeholder: 'Escriba para buscar…', value: texto(F.valores.hospital) });
    const lista = h('ul', { id: idLista, role: 'listbox', class: 'combo-lista', hidden: true, 'aria-label': 'Hospitales' });
    const btn = h('button', { type: 'button', class: 'combo-btn', tabindex: '-1', 'aria-label': 'Mostrar todos los hospitales' }, '▾');
    let visibles = [], activo = -1;

    const resaltar = function (texto, palabras) {
      if (!palabras.length) return texto;
      const n = norm(texto);
      const marcas = new Array(texto.length).fill(false);
      palabras.forEach(function (p) { let i = n.indexOf(p); while (i >= 0) { for (let j = i; j < i + p.length; j++) marcas[j] = true; i = n.indexOf(p, i + p.length); } });
      const partes = [];
      let i = 0;
      while (i < texto.length) {
        let j = i;
        while (j < texto.length && marcas[j] === marcas[i]) j++;
        partes.push(marcas[i] ? h('mark', null, texto.slice(i, j)) : texto.slice(i, j));
        i = j;
      }
      return partes;
    };
    const abrir = function (todos) {
      const q = todos ? '' : norm(input.value).replace(/["“”.,]/g, ' ').trim();
      const palabras = q ? q.split(/\s+/).filter(function (p) { return p && p !== 'h' && p !== 'n'; }) : [];
      // "Otro" siempre está al final, aunque no coincida con lo escrito.
      visibles = HOSPITALES.filter(function (x) { const n = norm(x); return palabras.every(function (p) { return n.indexOf(p) >= 0; }); }).concat([OTRO]);
      lista.textContent = '';
      activo = visibles.indexOf(F.valores.hospital);
      if (visibles.length === 1) lista.appendChild(h('li', { class: 'nada', role: 'presentation' }, 'No se encontró ningún hospital con ese texto.'));
      visibles.forEach(function (x, i) {
        lista.appendChild(h('li', { id: 'hosp-' + i, role: 'option', class: (x === F.valores.hospital ? 'elegido' : '') + (x === OTRO ? ' otro' : ''), 'aria-selected': String(i === activo),
          onpointerdown: function (ev) { ev.preventDefault(); elegir(x); } }, x === OTRO ? OTRO_TEXTO : resaltar(x, palabras)));
      });
      lista.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      marcarActivo();
    };
    const cerrar = function () { lista.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); };
    const marcarActivo = function () {
      Array.prototype.forEach.call(lista.querySelectorAll('[role=option]'), function (li, i) { li.setAttribute('aria-selected', String(i === activo)); });
      const li = document.getElementById('hosp-' + activo);
      if (activo >= 0 && li) {
        input.setAttribute('aria-activedescendant', 'hosp-' + activo);
        li.scrollIntoView({ block: 'nearest' });
      } else input.removeAttribute('aria-activedescendant');
    };
    const elegir = function (x) { input.value = texto(x); poner(x); cerrar(); };

    input.addEventListener('focus', function () {
      if (window.matchMedia('(max-width: 640px)').matches) setTimeout(function () { input.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 250);
      abrir(input.value === texto(F.valores.hospital));
    });
    input.addEventListener('input', function () {
      if (input.value !== texto(F.valores.hospital)) poner('');
      abrir(false);
    });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (lista.hidden) { abrir(false); return; }
        if (!visibles.length) return;
        activo = ev.key === 'ArrowDown' ? Math.min(visibles.length - 1, activo + 1) : Math.max(0, activo - 1);
        marcarActivo();
      } else if (ev.key === 'Enter') {
        if (!lista.hidden && visibles.length) { ev.preventDefault(); elegir(visibles[activo >= 0 ? activo : 0]); }
      } else if (ev.key === 'Escape') { cerrar(); }
    });
    input.addEventListener('blur', function () {
      cerrar();
      if (!F.valores.hospital) {
        const exacto = HOSPITALES.concat([OTRO]).filter(function (x) { return norm(texto(x)) === norm(input.value.trim()); })[0];
        if (exacto) elegir(exacto);
      }
    });
    btn.addEventListener('pointerdown', function (ev) { ev.preventDefault(); });
    btn.addEventListener('click', function () { if (lista.hidden) { input.focus(); abrir(true); } else cerrar(); });
    return h('div', { class: 'combo' }, input, btn, lista);
  }

  function ponerError(k, texto) {
    if (E.form) E.form.errores[k] = texto;
    const caja = document.getElementById('campo-' + k), msg = document.getElementById('msg-' + k);
    if (caja) caja.classList.add('mal');
    if (msg) msg.textContent = texto;
  }
  function limpiarError(k) {
    if (E.form) delete E.form.errores[k];
    const caja = document.getElementById('campo-' + k), msg = document.getElementById('msg-' + k);
    if (caja) caja.classList.remove('mal');
    if (msg) msg.textContent = '';
    actualizarResumen();
  }
  /** Mantiene al día el aviso "Faltan N preguntas" mientras la persona corrige. */
  function actualizarResumen() {
    const resumen = document.getElementById('resumen-errores');
    if (!resumen || !E.form) return;
    const n = Object.keys(E.form.errores).length;
    if (!n) { resumen.remove(); return; }
    resumen.firstChild.textContent = n === 1 ? 'Falta 1 pregunta por corregir' : 'Faltan ' + n + ' preguntas por corregir';
  }

  /* ---------- archivos ---------- */
  function leerDataUrl(blob) {
    return new Promise(function (ok, mal) {
      const r = new FileReader();
      r.onload = function () { ok(String(r.result)); };
      r.onerror = function () { mal(new Error('No se pudo leer el archivo.')); };
      r.readAsDataURL(blob);
    });
  }
  function cargarImagen(url) {
    return new Promise(function (ok, mal) {
      const img = new Image();
      img.onload = function () { ok(img); };
      img.onerror = function () { mal(new Error('No se pudo abrir la imagen. Pruebe con otra foto.')); };
      img.src = url;
    });
  }
  /** Valida el tipo y reduce las fotos grandes para que el envío sea rápido con mala conexión. */
  async function prepararArchivo(file) {
    const nombre = file.name || 'archivo';
    const ext = (nombre.split('.').pop() || '').toLowerCase();
    const esPdf = file.type === 'application/pdf' || ext === 'pdf';
    const esImg = /^image\/(jpeg|png)$/.test(file.type) || ['jpg', 'jpeg', 'png'].indexOf(ext) >= 0;
    if (!esPdf && !esImg) throw new Error('Formato no permitido. Use JPG, JPEG, PNG o PDF.');
    if (esPdf) {
      if (file.size > MAX_BYTES) throw new Error('El PDF pesa ' + tamano(file.size) + '. El máximo es 8 MB.');
      return { blob: file, nombre: nombre, vista: '' };
    }
    const url = URL.createObjectURL(file);
    let blob = file;
    try {
      const img = await cargarImagen(url);
      const LADO = 2200;
      const escala = Math.min(1, LADO / Math.max(img.naturalWidth, img.naturalHeight));
      if (escala < 1 || file.size > 700 * 1024) {
        const lienzo = document.createElement('canvas');
        lienzo.width = Math.round(img.naturalWidth * escala);
        lienzo.height = Math.round(img.naturalHeight * escala);
        const g = lienzo.getContext('2d');
        g.fillStyle = '#fff';
        g.fillRect(0, 0, lienzo.width, lienzo.height);
        g.drawImage(img, 0, 0, lienzo.width, lienzo.height);
        const reducido = await new Promise(function (ok) { lienzo.toBlob(ok, 'image/jpeg', 0.85); });
        if (reducido && reducido.size < file.size) blob = reducido;
      }
    } finally {
      URL.revokeObjectURL(url);
    }
    if (blob.size > MAX_BYTES) throw new Error('La imagen pesa ' + tamano(blob.size) + '. El máximo es 8 MB.');
    // "original" se conserva para que cada edición parta de la foto sin pérdidas acumuladas.
    return { blob: blob, nombre: nombre, vista: await leerDataUrl(blob), original: blob, edicion: { giro: 0, recorte: null }, editada: false };
  }

  /* ---------- editor de imagen: girar y recortar ---------- */
  const RECORTE_COMPLETO = { x: 0, y: 0, w: 1, h: 1 };
  const RECORTE_MIN = 0.08; // el recorte no puede ser menor que el 8 % del lado

  /** Gira el rectángulo de recorte (coordenadas de 0 a 1) junto con la imagen. */
  function girarRecorte(r, sentido) {
    return sentido > 0 ? { x: 1 - (r.y + r.h), y: r.x, w: r.h, h: r.w } : { x: r.y, y: 1 - (r.x + r.w), w: r.h, h: r.w };
  }

  /** Dibuja la imagen girada "giro" cuartos de vuelta (horario) en un lienzo de ancho x alto. */
  function dibujarGirada(g, img, giro, ancho, alto) {
    g.save();
    g.fillStyle = '#fff';
    g.fillRect(0, 0, ancho, alto);
    g.translate(ancho / 2, alto / 2);
    g.rotate(giro * Math.PI / 2);
    const impar = giro % 2 === 1;
    const w = impar ? alto : ancho, hh = impar ? ancho : alto;
    g.drawImage(img, -w / 2, -hh / 2, w, hh);
    g.restore();
  }

  /** Abre el editor. Devuelve una promesa con {blob, vista, edicion, editada} o null si se cancela. */
  function abrirEditor(arch, titulo) {
    return new Promise(async function (resolver) {
      const url = URL.createObjectURL(arch.original || arch.blob);
      let img;
      try { img = await cargarImagen(url); } catch (e) { URL.revokeObjectURL(url); alert(e.message); resolver(null); return; }
      let giro = arch.edicion ? arch.edicion.giro : 0;
      let rec = Object.assign({}, (arch.edicion && arch.edicion.recorte) || RECORTE_COMPLETO);

      const lienzo = h('canvas', { class: 'ed-lienzo', 'aria-label': 'Imagen a editar' });
      const caja = h('div', { class: 'ed-recorte', 'data-modo': 'mover', 'aria-label': 'Área de recorte. Arrástrela para moverla.' },
        ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'].map(function (m) { return h('span', { class: 'ed-asa ed-' + m, 'data-modo': m }); }));
      const marco = h('div', { class: 'ed-marco' }, lienzo, caja);
      const escenario = h('div', { class: 'ed-escenario' }, marco);
      const capa = h('div', { class: 'capa editor', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Editar ' + titulo });

      const cerrar = function (valor) {
        window.removeEventListener('resize', dibujar);
        document.removeEventListener('keydown', tecla);
        URL.revokeObjectURL(url);
        capa.remove();
        document.body.style.overflow = '';
        resolver(valor);
      };
      const tecla = function (ev) { if (ev.key === 'Escape') cerrar(null); };

      function dibujar() {
        const impar = giro % 2 === 1;
        const rw = impar ? img.naturalHeight : img.naturalWidth, rh = impar ? img.naturalWidth : img.naturalHeight;
        const dispW = Math.max(120, escenario.clientWidth - 24), dispH = Math.max(120, escenario.clientHeight - 24);
        const k = Math.min(dispW / rw, dispH / rh);
        const w = Math.round(rw * k), hh = Math.round(rh * k);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        lienzo.width = Math.round(w * dpr);
        lienzo.height = Math.round(hh * dpr);
        marco.style.width = w + 'px';
        marco.style.height = hh + 'px';
        dibujarGirada(lienzo.getContext('2d'), img, giro, lienzo.width, lienzo.height);
        pintarRecorte();
      }
      function pintarRecorte() {
        caja.style.left = (rec.x * 100) + '%';
        caja.style.top = (rec.y * 100) + '%';
        caja.style.width = (rec.w * 100) + '%';
        caja.style.height = (rec.h * 100) + '%';
      }

      // Arrastre con dedo o ratón: mover el recuadro o estirarlo desde sus bordes y esquinas.
      let arrastre = null;
      caja.addEventListener('pointerdown', function (ev) {
        ev.preventDefault();
        caja.setPointerCapture(ev.pointerId);
        arrastre = { modo: ev.target.getAttribute('data-modo') || 'mover', x0: ev.clientX, y0: ev.clientY, r0: Object.assign({}, rec),
          W: marco.clientWidth, H: marco.clientHeight };
      });
      caja.addEventListener('pointermove', function (ev) {
        if (!arrastre) return;
        const a = arrastre, dx = (ev.clientX - a.x0) / a.W, dy = (ev.clientY - a.y0) / a.H, r = a.r0;
        const lim = function (v, mn, mx) { return Math.max(mn, Math.min(mx, v)); };
        const n = Object.assign({}, r);
        if (a.modo === 'mover') {
          n.x = lim(r.x + dx, 0, 1 - r.w);
          n.y = lim(r.y + dy, 0, 1 - r.h);
        } else {
          if (a.modo.indexOf('w') >= 0) { n.x = lim(r.x + dx, 0, r.x + r.w - RECORTE_MIN); n.w = r.x + r.w - n.x; }
          if (a.modo.indexOf('e') >= 0) { n.w = lim(r.w + dx, RECORTE_MIN, 1 - r.x); }
          if (a.modo.indexOf('n') >= 0) { n.y = lim(r.y + dy, 0, r.y + r.h - RECORTE_MIN); n.h = r.y + r.h - n.y; }
          if (a.modo.indexOf('s') >= 0) { n.h = lim(r.h + dy, RECORTE_MIN, 1 - r.y); }
        }
        rec = n;
        pintarRecorte();
      });
      const soltar = function () { arrastre = null; };
      caja.addEventListener('pointerup', soltar);
      caja.addEventListener('pointercancel', soltar);

      const girar = function (sentido) {
        giro = (giro + sentido + 4) % 4;
        rec = girarRecorte(rec, sentido);
        dibujar();
      };

      async function aplicar(btn) {
        const completo = rec.x <= 0.001 && rec.y <= 0.001 && rec.w >= 0.999 && rec.h >= 0.999;
        if (giro === 0 && completo) {
          const b0 = arch.original || arch.blob;
          cerrar({ blob: b0, vista: await leerDataUrl(b0), edicion: { giro: 0, recorte: null }, editada: false });
          return;
        }
        btn.disabled = true;
        btn.textContent = 'Guardando…';
        const impar = giro % 2 === 1;
        const rw = impar ? img.naturalHeight : img.naturalWidth, rh = impar ? img.naturalWidth : img.naturalHeight;
        const girada = document.createElement('canvas');
        girada.width = rw;
        girada.height = rh;
        dibujarGirada(girada.getContext('2d'), img, giro, rw, rh);
        const px = Math.round(rec.x * rw), py = Math.round(rec.y * rh);
        const pw = Math.max(1, Math.round(rec.w * rw)), ph = Math.max(1, Math.round(rec.h * rh));
        const salida = document.createElement('canvas');
        salida.width = pw;
        salida.height = ph;
        salida.getContext('2d').drawImage(girada, px, py, pw, ph, 0, 0, pw, ph);
        const blob = await new Promise(function (ok) { salida.toBlob(ok, 'image/jpeg', 0.9); });
        if (!blob) { btn.disabled = false; btn.textContent = 'Aplicar'; alert('No se pudo guardar la imagen editada.'); return; }
        cerrar({ blob: blob, vista: await leerDataUrl(blob), edicion: { giro: giro, recorte: completo ? null : rec }, editada: true });
      }

      const btnAplicar = h('button', { type: 'button', class: 'btn primario', onclick: function (ev) { aplicar(ev.currentTarget); } }, 'Aplicar');
      agregar(capa, h('div', { class: 'ed-caja' },
        h('div', { class: 'ed-cab' }, h('strong', null, 'Editar ' + titulo),
          h('span', null, 'Arrastre el recuadro o sus bordes para recortar.')),
        escenario,
        h('div', { class: 'ed-barra' },
          h('div', { class: 'ed-grupo' },
            h('button', { type: 'button', class: 'btn', onclick: function () { girar(-1); }, 'aria-label': 'Girar a la izquierda' }, '⟲ Girar'),
            h('button', { type: 'button', class: 'btn', onclick: function () { girar(1); }, 'aria-label': 'Girar a la derecha' }, 'Girar ⟳'),
            h('button', { type: 'button', class: 'btn', onclick: function () { giro = 0; rec = Object.assign({}, RECORTE_COMPLETO); dibujar(); } }, 'Restablecer')),
          h('div', { class: 'ed-grupo' },
            h('button', { type: 'button', class: 'btn', onclick: function () { cerrar(null); } }, 'Cancelar'),
            btnAplicar))));
      document.body.appendChild(capa);
      document.body.style.overflow = 'hidden';
      window.addEventListener('resize', dibujar);
      document.addEventListener('keydown', tecla);
      dibujar();
      btnAplicar.focus();
    });
  }

  /* ---------- validación y envío ---------- */
  function validar() {
    const F = E.form, v = F.valores, err = {};
    CAMPOS.forEach(function (c) {
      const valor = c.tipo === 'archivo' ? F.archivos[c.k] : String(v[c.k] || '').trim();
      if (!valor) {
        if (c.opcional) return;
        err[c.k] = c.tipo === 'hospital' && String((document.getElementById('in-hospital') || {}).value || '').trim()
          ? 'Elija un hospital de la lista, o "Otro".' : 'Esta pregunta es obligatoria.';
        return;
      }
      if (c.k === 'hospital' && valor === OTRO && String(v.hospital_otro || '').trim().length < 3) err[c.k] = 'Escriba el nombre del hospital.';
      if (c.k === 'nombre' && valor.length < 3) err[c.k] = 'Escriba el nombre completo.';
      if (c.k === 'ts_nombre' && valor.length < 3) err[c.k] = 'Escriba el nombre de quien solicita.';
      if (c.k === 'expediente' && !/^[A-Za-z0-9][A-Za-z0-9 .\/-]*$/.test(valor)) err[c.k] = 'Use solo números, letras, guion o diagonal.';
      if (c.k === 'fecha_nacimiento') {
        const e = edadDe(valor);
        if (!e) err[c.k] = 'Escriba una fecha real y no futura (DD/MM/AAAA).';
        else if (e.anios > 120) err[c.k] = 'Revise el año de nacimiento.';
      }
      if (c.k === 'peso' && !(Number(valor) >= 0.3 && Number(valor) <= 400)) err[c.k] = 'Escriba el peso en kilogramos (0.3 a 400).';
      if (c.k === 'talla') {
        if (Number(valor) > 0 && Number(valor) < 3) err[c.k] = 'Escriba la talla en centímetros: ' + valor + ' m = ' + Math.round(Number(valor) * 100) + ' cm.';
        else if (!(Number(valor) >= 20 && Number(valor) <= 250)) err[c.k] = 'Escriba la talla en centímetros (20 a 250).';
      }
      if (c.tipo === 'telefono') {
        const n = valor.replace(/\D/g, '').length;
        if (valor.charAt(0) === '+' ? n < 9 || n > 15 : n !== 8) err[c.k] = valor.charAt(0) === '+' ? 'Revise el número: código de país y número completo.' : 'El número debe tener 8 dígitos.';
      }
    });
    return err;
  }

  async function enviar(cajaError, btn) {
    const F = E.form;
    cajaError.textContent = '';
    CAMPOS.forEach(function (c) { limpiarError(c.k); });
    const err = validar();
    const claves = Object.keys(err);
    if (claves.length) {
      claves.forEach(function (k) { ponerError(k, err[k]); });
      cajaError.appendChild(h('div', { class: 'aviso error', role: 'alert', id: 'resumen-errores' },
        h('strong', null, claves.length === 1 ? 'Falta 1 pregunta por corregir' : 'Faltan ' + claves.length + ' preguntas por corregir'),
        'Están marcadas en rojo.'));
      const primero = document.getElementById('campo-' + claves[0]);
      if (primero) { primero.scrollIntoView({ behavior: 'smooth', block: 'center' }); const foco = primero.querySelector('input,select,textarea'); if (foco) foco.focus({ preventScroll: true }); }
      return;
    }
    const capa = h('div', { class: 'capa', role: 'status' }, h('div', { class: 'caja' }, h('div', { class: 'giro' }),
      h('strong', null, 'Enviando solicitud…'), h('p', { style: 'margin:6px 0 0;color:#51606f;font-size:14px' }, 'No cierre esta pantalla.')));
    document.body.appendChild(capa);
    btn.disabled = true;
    try {
      const datos = {};
      CAMPOS.forEach(function (c) { if (c.tipo !== 'archivo') datos[c.k] = String(F.valores[c.k] || '').trim(); });
      datos.hospital_otro = datos.hospital === OTRO ? String(F.valores.hospital_otro || '').trim() : '';
      const cuerpo = { datos: datos, id_cliente: F.idCliente, codigo: F.codigo || '' };
      for (const k of ['ekg', 'rx']) {
        if (F.archivos[k]) cuerpo[k] = { nombre: F.archivos[k].nombre, b64: (await leerDataUrl(F.archivos[k].blob)).split(',')[1] };
      }
      const r = await api('enviar', cuerpo);
      const recordar = { codigo: F.codigo || '' };
      RECORDADOS.forEach(function (k) { recordar[k] = String(F.valores[k] || '').trim(); });
      guardarRecordados(recordar);
      F.enviado = { id: r.id, nombre: datos.nombre, expediente: datos.expediente, hospital: datos.hospital === OTRO ? datos.hospital_otro : datos.hospital,
        ts_contacto: r.ts_contacto || datos.ts_contacto };
      F.sucio = false;
      capa.remove();
      pintar();
      window.scrollTo(0, 0);
    } catch (e) {
      capa.remove();
      btn.disabled = false;
      const cerrado = e.code === 'CERRADO';
      cajaError.appendChild(h('div', { class: 'aviso error', role: 'alert' },
        h('strong', null, cerrado ? 'El formulario se cerró' : 'No se pudo enviar la solicitud'), e.message,
        e.code === 'RED' ? ' Sus datos siguen en pantalla: puede volver a intentar sin escribir de nuevo.' : ''));
      cajaError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (cerrado || e.code === 'CODIGO') {
        // El administrador cambió la configuración: se vuelve a consultar y se repinta (los datos escritos se conservan).
        await cargarEstado(true);
        if (e.code === 'CODIGO') F.errores.codigo = e.message;
        pintar();
        const c = document.getElementById('in-codigo');
        if (c) { c.focus(); c.scrollIntoView({ block: 'center' }); }
        if (cerrado || !c) document.querySelector('.contenido').appendChild(h('div', { class: 'aviso error', role: 'alert' }, h('strong', null, 'No se pudo enviar la solicitud'), e.message));
      }
    }
  }

  function pintarExito(main) {
    const x = E.form.enviado;
    main.appendChild(h('div', { class: 'tarjeta exito' },
      h('div', { class: 'check', 'aria-hidden': 'true' }, '✓'),
      h('h2', null, 'Solicitud enviada correctamente'),
      h('span', { class: 'estudio' }, 'Ecocardiograma'),
      h('div', { class: 'folio' }, x.id),
      h('div', { style: 'color:#51606f;font-size:14px' }, 'Número de solicitud'),
      h('dl', null, h('dt', null, 'Paciente'), h('dd', null, x.nombre), h('dt', null, 'Expediente'), h('dd', null, x.expediente),
        h('dt', null, 'Hospital'), h('dd', null, x.hospital)),
      h('ul', { class: 'avisos' },
        h('li', { class: 'cita' }, h('span', { class: 'ico', 'aria-hidden': 'true' }, '☏'),
          h('span', null, AVISO_CITA, x.ts_contacto ? [' al ', h('b', null, telefono(x.ts_contacto))] : null, '.'))),
      h('div', { class: 'acciones' },
        h('button', { class: 'btn primario', onclick: function () { E.form = null; pintar(); window.scrollTo(0, 0); } }, 'Nueva solicitud'))));
  }

  /* ---------- instalación como app ---------- */
  function instalarApp() {
    if (!E.instalar) return;
    E.instalar.prompt();
    E.instalar = null;
    if (!E.form || !E.form.sucio) pintar();
  }
  window.addEventListener('beforeinstallprompt', function (ev) { ev.preventDefault(); E.instalar = ev; if (!E.form || !E.form.sucio) pintar(); });
  window.addEventListener('beforeunload', function (ev) { if (E.form && E.form.sucio) { ev.preventDefault(); ev.returnValue = ''; } });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) cargarEstado(true); });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* sin modo offline */ }); });
  }

  pintar();
  cargarEstado(true);
})();
