/**
 * LLAMADAS DE ZOOM → GOOGLE DRIVE (Holandés Nawar)
 * ------------------------------------------------
 * Cada hora: copia de cada llamada de Zoom SOLO el audio y la transcripción a
 * tu Google Drive, en la carpeta «Llamadas de Zoom», ordenadas así:
 *
 *   Llamadas de Zoom / 2026-11 / Compraron · No compraron · Sin identificar /
 *       2026-11-12 18.00 · Ana López / audio.m4a, transcripcion.txt, datos.txt
 *
 * Quién era y si compró lo dice la escuela (por su cita de Calendly). Si alguien
 * compra más tarde, su carpeta pasa sola a «Compraron».
 *
 * Borrado mensual: el VÍDEO de las llamadas de un mes ya terminado se borra de
 * Zoom (en noviembre, los de octubre), solo si la llamada tiene su cita de
 * Calendly (nunca una clase u otra reunión) y su audio ya está en Drive con el
 * mismo tamaño. El audio y la transcripción de Zoom no se tocan.
 *
 * CÓMO SE INSTALA (una vez)
 * 1. script.google.com → Nuevo proyecto → borra lo que haya y pega TODO esto.
 * 2. Engranaje («Configuración del proyecto») → «Propiedades de la secuencia de
 *    comandos» → añade estas cuatro (nombre exacto y su valor):
 *      ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET   (de tu app de Zoom)
 *      SCHOOL_CRON_TOKEN  (el valor de LEARNHOUSE_CRON_TOKEN en Railway)
 * 3. Arriba elige la función «probar» y pulsa «Ejecutar». Google pedirá permiso
 *    (Drive y conectarse a internet): acéptalo. Mira el registro: cuenta lo que
 *    haría, sin subir ni borrar nada.
 * 4. Elige «instalar» y pulsa «Ejecutar». Desde ahí va solo, cada hora.
 */

const CARPETA_NOMBRE = 'Llamadas de Zoom';
const REGISTRO_NOMBRE = '_registro (no borrar).json';
const ZONA = 'Europe/Amsterdam';
const LIMITE_MS = 4.5 * 60 * 1000;       // Google corta a los 6 minutos: se sigue en la siguiente hora.
const MAX_BYTES = 48 * 1024 * 1024;      // Google no deja bajar archivos de más de 50 MB.
const CATEGORIA = { si: 'Compraron', no: 'No compraron', '?': 'Sin identificar' };

// ── Lo que se ejecuta ─────────────────────────────────────────────────────────

function probar() { ejecutar_(true); }
function pasarLlamadas() { ejecutar_(false); }

function instalar() {
  comprobarAjustes_();
  carpetaRaiz_();
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'pasarLlamadas'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('pasarLlamadas').timeBased().everyHours(1).create();
  Logger.log('Listo. Cada hora se copiarán las llamadas nuevas a «' + CARPETA_NOMBRE + '» en tu Drive.');
  pasarLlamadas();
}

function ejecutar_(prueba) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) { Logger.log('Ya hay otra vuelta en marcha.'); return; }
  try {
    const t0 = Date.now();
    comprobarAjustes_();
    const tok = tokenZoom_();
    const desde = ajuste_('DESDE') || Utilities.formatDate(new Date(Date.now() - 365 * 864e5), 'UTC', 'yyyy-MM-dd');
    const reuniones = grabaciones_(tok, desde).filter(function (m) { return (m.recording_files || []).length; });
    const raiz = carpetaRaiz_();
    const reg = leerRegistro_(raiz);
    const c = { grabaciones: reuniones.length, nuevas: 0, ya_estaban: 0, movidas: 0, sin_audio: 0,
                demasiado_grandes: 0, quedan_para_luego: 0, videos_borrados: 0, videos_por_borrar: 0,
                gb_liberados: 0, errores: 0 };

    // Quién era cada una (las nuevas) y si ha comprado (las que aún no).
    const items = [];
    reuniones.forEach(function (m) {
      if (!reg.llamadas[m.uuid]) {
        items.push({ clave: m.uuid, inicio: m.start_time, meeting_id: String(m.id || ''), anfitrion_email: m.host_email || '' });
      }
    });
    Object.keys(reg.llamadas).forEach(function (u) {
      const e = reg.llamadas[u];
      if (e.email && e.compro !== 'si') items.push({ clave: u, email: e.email, nombre: e.nombre || '' });
    });
    const quien = clasificar_(items);

    // Las que ya estaban y ahora han comprado: a «Compraron».
    Object.keys(reg.llamadas).forEach(function (u) {
      const e = reg.llamadas[u], q = quien[u];
      if (!q || !q.identificada || !q.compro || e.compro === 'si') return;
      if (prueba) { c.movidas++; return; }
      try {
        e.compro = 'si'; e.pagado_eur = q.pagado_eur || 0; e.closer = q.closer || e.closer;
        const f = DriveApp.getFolderById(e.carpeta);
        f.moveTo(subcarpeta_(subcarpeta_(raiz, e.mes), CATEGORIA.si));
        escribirTexto_(f, 'datos.txt', ficha_(e));
        c.movidas++;
      } catch (err) { c.errores++; Logger.log('No se pudo mover una carpeta: ' + err); }
    });
    if (!prueba) guardarRegistro_(raiz, reg);

    // Las nuevas.
    reuniones.forEach(function (m) {
      if (reg.llamadas[m.uuid]) { c.ya_estaban++; return; }
      if (Date.now() - t0 > LIMITE_MS) { c.quedan_para_luego++; return; }
      const archivos = m.recording_files || [];
      const audio = archivos.filter(function (f) { return f.file_type === 'M4A' && f.download_url; })[0];
      if (!audio) { c.sin_audio++; return; }
      if ((audio.file_size || 0) > MAX_BYTES) { c.demasiado_grandes++; return; }
      if (prueba) { c.nuevas++; return; }
      try {
        const q = quien[m.uuid] || { identificada: false };
        const inicio = new Date(m.start_time);
        const e = {
          mes: Utilities.formatDate(inicio, ZONA, 'yyyy-MM'),
          cuando: Utilities.formatDate(inicio, ZONA, "dd/MM/yyyy 'a las' HH:mm"),
          duracion: m.duration || 0, tema: m.topic || '',
          identificada: !!q.identificada, nombre: q.nombre || '', email: q.email || '',
          closer: q.closer || '', pagado_eur: q.pagado_eur || 0,
          resultado: q.resultado || '', nota: q.nota || '',
          compro: q.identificada ? (q.compro ? 'si' : 'no') : '?',
          audio_bytes: 0, video_borrado: false,
        };
        const nombre = Utilities.formatDate(inicio, ZONA, 'yyyy-MM-dd HH.mm') + ' · ' + (limpio_(e.nombre) || limpio_(e.tema) || 'Llamada');
        const destino = subcarpeta_(subcarpeta_(raiz, e.mes), CATEGORIA[e.compro]);
        const blob = bajar_(tok, audio.download_url).setName('audio.m4a');
        const carpeta = destino.createFolder(nombre);
        const subido = carpeta.createFile(blob);
        e.audio_bytes = subido.getSize();
        if (trans_(archivos)) {
          const vtt = bajar_(tok, trans_(archivos).download_url).getDataAsString('UTF-8');
          carpeta.createFile('transcripcion.txt', vttATexto(vtt), MimeType.PLAIN_TEXT);
          carpeta.createFile('transcripcion.vtt', vtt, MimeType.PLAIN_TEXT);
        }
        carpeta.createFile('datos.txt', ficha_(e), MimeType.PLAIN_TEXT);
        e.carpeta = carpeta.getId();
        reg.llamadas[m.uuid] = e;
        guardarRegistro_(raiz, reg);
        c.nuevas++;
      } catch (err) { c.errores++; Logger.log('Una llamada falló: ' + err); }
    });

    // El borrado mensual del vídeo.
    const esteMes = Utilities.formatDate(new Date(), ZONA, 'yyyy-MM');
    reuniones.forEach(function (m) {
      const e = reg.llamadas[m.uuid];
      if (!e || !e.identificada || e.video_borrado || !(e.mes < esteMes) || !e.audio_bytes) return;
      const archivos = m.recording_files || [];
      const audio = archivos.filter(function (f) { return f.file_type === 'M4A'; })[0];
      if (audio && audio.file_size && audio.file_size !== e.audio_bytes) return;
      const videos = archivos.filter(function (f) { return f.file_type === 'MP4' && f.id; });
      if (!videos.length) { e.video_borrado = true; return; }
      if (prueba) { c.videos_por_borrar += videos.length; return; }
      let todos = true;
      videos.forEach(function (v) {
        const r = UrlFetchApp.fetch('https://api.zoom.us/v2/meetings/' + uuidUrl(m.uuid) + '/recordings/' + v.id + '?action=delete',
          { method: 'delete', headers: { Authorization: 'Bearer ' + tok }, muteHttpExceptions: true });
        if (r.getResponseCode() === 204 || r.getResponseCode() === 200) {
          c.videos_borrados++; c.gb_liberados += (v.file_size || 0) / 1e9;
        } else { todos = false; c.errores++; Logger.log('Zoom no dejó borrar un vídeo (' + r.getResponseCode() + '): ' + r.getContentText().slice(0, 200)); }
      });
      if (todos) e.video_borrado = true;
    });
    if (!prueba) guardarRegistro_(raiz, reg);

    c.gb_liberados = Math.round(c.gb_liberados * 100) / 100;
    Logger.log((prueba ? 'PRUEBA (no se ha subido ni borrado nada): ' : 'Hecho: ') + JSON.stringify(c, null, 1));
  } finally {
    lock.releaseLock();
  }
}

// ── Ajustes ───────────────────────────────────────────────────────────────────

function ajuste_(n) { const v = PropertiesService.getScriptProperties().getProperty(n); return v ? String(v).trim() : ''; }

function comprobarAjustes_() {
  const faltan = ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET', 'SCHOOL_CRON_TOKEN']
    .filter(function (n) { return !ajuste_(n); });
  if (faltan.length) throw new Error('Faltan estas propiedades del proyecto (engranaje → Propiedades de la secuencia de comandos): ' + faltan.join(', '));
}

// ── Zoom ──────────────────────────────────────────────────────────────────────

function tokenZoom_() {
  const r = UrlFetchApp.fetch('https://zoom.us/oauth/token?grant_type=account_credentials&account_id=' + encodeURIComponent(ajuste_('ZOOM_ACCOUNT_ID')), {
    method: 'post', muteHttpExceptions: true,
    headers: { Authorization: 'Basic ' + Utilities.base64Encode(ajuste_('ZOOM_CLIENT_ID') + ':' + ajuste_('ZOOM_CLIENT_SECRET')) },
  });
  if (r.getResponseCode() !== 200) throw new Error('Zoom no da acceso (' + r.getResponseCode() + '): revisa ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID y ZOOM_CLIENT_SECRET, y que la app esté activada. ' + r.getContentText().slice(0, 200));
  return JSON.parse(r.getContentText()).access_token;
}

function zoomGet_(tok, ruta, params) {
  const q = Object.keys(params || {}).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
  const r = UrlFetchApp.fetch('https://api.zoom.us/v2' + ruta + (q ? '?' + q : ''), { headers: { Authorization: 'Bearer ' + tok }, muteHttpExceptions: true });
  return { code: r.getResponseCode(), datos: r.getResponseCode() === 200 ? JSON.parse(r.getContentText()) : null, texto: r.getContentText() };
}

function grabaciones_(tok, desde) {
  let usuarios = ['me'];
  const u = zoomGet_(tok, '/users', { page_size: 300 });
  if (u.datos && (u.datos.users || []).length) usuarios = u.datos.users.map(function (x) { return x.id; });
  else Logger.log('Zoom no deja listar usuarios (' + u.code + '): solo las del dueño de la app.');
  const hoy = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
  const vistas = {};
  usuarios.forEach(function (uid) {
    meses(desde, hoy).forEach(function (par) {
      let siguiente = '';
      do {
        const p = { from: par[0], to: par[1], page_size: 300 };
        if (siguiente) p.next_page_token = siguiente;
        const r = zoomGet_(tok, '/users/' + uid + '/recordings', p);
        if (!r.datos) { Logger.log('Zoom no deja leer grabaciones (' + r.code + '): ' + r.texto.slice(0, 200)); break; }
        (r.datos.meetings || []).forEach(function (m) { if (m.uuid) vistas[m.uuid] = m; });
        siguiente = r.datos.next_page_token || '';
      } while (siguiente);
    });
  });
  return Object.keys(vistas).map(function (k) { return vistas[k]; })
    .sort(function (a, b) { return String(a.start_time).localeCompare(String(b.start_time)); });
}

function bajar_(tok, url) {
  const r = UrlFetchApp.fetch(url + (url.indexOf('?') >= 0 ? '&' : '?') + 'access_token=' + encodeURIComponent(tok),
    { headers: { Authorization: 'Bearer ' + tok }, muteHttpExceptions: true, followRedirects: true });
  if (r.getResponseCode() !== 200) throw new Error('Zoom no deja bajar un archivo (' + r.getResponseCode() + ')');
  return r.getBlob();
}

function trans_(archivos) {
  return archivos.filter(function (f) { return f.file_type === 'TRANSCRIPT' && f.download_url; })[0];
}

// ── La escuela ────────────────────────────────────────────────────────────────

function clasificar_(items) {
  const salen = {};
  const url = (ajuste_('SCHOOL_URL') || 'https://app.holandesnawar.com').replace(/\/+$/, '') + '/api/v1/notifications/llamadas-grabadas';
  for (let i = 0; i < items.length; i += 100) {
    const r = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'X-Cron-Token': ajuste_('SCHOOL_CRON_TOKEN') },
      payload: JSON.stringify({ llamadas: items.slice(i, i + 100) }),
    });
    if (r.getResponseCode() !== 200) throw new Error('La escuela respondió ' + r.getResponseCode() + ' (¿SCHOOL_CRON_TOKEN igual que LEARNHOUSE_CRON_TOKEN de Railway?). ' + r.getContentText().slice(0, 200));
    const d = JSON.parse(r.getContentText());
    if (d.aviso) Logger.log('La escuela avisa: ' + d.aviso);
    Object.assign(salen, d.llamadas || {});
  }
  return salen;
}

// ── Drive ─────────────────────────────────────────────────────────────────────

function carpetaRaiz_() {
  const id = ajuste_('CARPETA_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* la crea otra vez */ } }
  const hay = DriveApp.getRootFolder().getFoldersByName(CARPETA_NOMBRE);
  const f = hay.hasNext() ? hay.next() : DriveApp.createFolder(CARPETA_NOMBRE);
  PropertiesService.getScriptProperties().setProperty('CARPETA_ID', f.getId());
  return f;
}

function subcarpeta_(padre, nombre) {
  const hay = padre.getFoldersByName(nombre);
  return hay.hasNext() ? hay.next() : padre.createFolder(nombre);
}

function leerRegistro_(raiz) {
  const hay = raiz.getFilesByName(REGISTRO_NOMBRE);
  if (!hay.hasNext()) return { llamadas: {} };
  try { const d = JSON.parse(hay.next().getBlob().getDataAsString('UTF-8')); return d && d.llamadas ? d : { llamadas: {} }; }
  catch (e) { return { llamadas: {} }; }
}

function guardarRegistro_(raiz, reg) { escribirTexto_(raiz, REGISTRO_NOMBRE, JSON.stringify(reg)); }

function escribirTexto_(carpeta, nombre, texto) {
  const hay = carpeta.getFilesByName(nombre);
  if (hay.hasNext()) hay.next().setContent(texto);
  else carpeta.createFile(nombre, texto, MimeType.PLAIN_TEXT);
}

// ── Lo que se escribe (sin Google: se puede probar fuera) ─────────────────────

function ficha_(e) {
  const filas = ['Llamada del ' + e.cuando + ' (hora de Países Bajos)', 'Duración: ' + e.duracion + ' minutos'];
  if (e.identificada) {
    filas.push('Persona: ' + (e.nombre || '—'), 'Correo: ' + (e.email || '—'), 'Closer: ' + (e.closer || '—'),
      'Compró: ' + (e.compro === 'si' ? 'sí' : 'no') + (e.pagado_eur ? ' (' + Number(e.pagado_eur).toFixed(2) + ' €)' : ''));
    if (e.resultado) filas.push('«¿Qué pasó?» en la escuela: ' + e.resultado);
    if (e.nota) filas.push('Nota: ' + e.nota);
  } else {
    filas.push('Sin identificar: no se encontró su cita de Calendly (puede ser una clase u otra reunión).');
  }
  filas.push('Zoom: ' + (e.tema || ''));
  return filas.join('\n') + '\n';
}

function vttATexto(vtt) {
  const lineas = []; let quien = null; let frase = [];
  String(vtt || '').replace(/\r/g, '').split(/\n\s*\n/).forEach(function (bloque) {
    const texto = bloque.trim().split('\n').filter(function (p) {
      return p.trim() && p.indexOf('-->') < 0 && !/^\d+$/.test(p.trim()) && p.trim() !== 'WEBVTT';
    });
    if (!texto.length) return;
    const t = texto.join(' ').trim();
    const m = t.match(/^([^:]{1,60}):\s*([\s\S]*)$/);
    const nombre = m ? m[1].trim() : '', dicho = m ? m[2] : t;
    if (nombre !== quien && frase.length) { lineas.push(quien ? quien + ': ' + frase.join(' ') : frase.join(' ')); frase = []; }
    quien = nombre; frase.push(dicho);
  });
  if (frase.length) lineas.push(quien ? quien + ': ' + frase.join(' ') : frase.join(' '));
  return lineas.join('\n\n') + '\n';
}

function meses(desde, hasta) {
  const salen = [];
  let a = new Date(desde + 'T00:00:00Z');
  const fin = new Date(hasta + 'T00:00:00Z');
  while (a <= fin) {
    const ultimo = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 0));
    const b = ultimo < fin ? ultimo : fin;
    salen.push([a.toISOString().slice(0, 10), b.toISOString().slice(0, 10)]);
    a = new Date(b.getTime() + 864e5);
  }
  return salen;
}

function uuidUrl(uuid) {
  return (uuid.charAt(0) === '/' || uuid.indexOf('//') >= 0) ? encodeURIComponent(encodeURIComponent(uuid)) : encodeURIComponent(uuid);
}

function limpio_(t) { return String(t || '').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80); }
