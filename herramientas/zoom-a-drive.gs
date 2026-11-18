/**
 * LLAMADAS DE ZOOM → GOOGLE DRIVE (Holandés Nawar)
 * ------------------------------------------------
 * Cada hora copia cada llamada de Zoom a tu Google Drive, en la carpeta
 * «Llamadas de Zoom», con su audio, su transcripción y su VÍDEO (el de galería
 * si lo hay; si no, el que haya), ordenadas así:
 *
 *   Llamadas de Zoom / 2026-11 / Compraron · No compraron · Sin identificar /
 *       2026-11-12 18.00 · Ana López / audio.m4a, video.mp4, transcripcion.txt, datos.txt
 *
 * Quién era y si compró lo dice la escuela (por su cita de Calendly). Si alguien
 * compra más tarde, su carpeta pasa sola a «Compraron».
 *
 * Los archivos grandes (vídeos de cientos de MB) se suben A TROZOS: Google no
 * deja pasar más de 50 MB de una vez. Un vídeo que no termina en una vuelta
 * sigue en la siguiente, desde donde se quedó.
 *
 * Borrado mensual: los vídeos de Zoom de un mes ya terminado (en noviembre, los
 * de octubre) se borran de Zoom SOLO si: la llamada tiene su cita de Calendly
 * (nunca una clase u otra reunión), su audio y su vídeo ya están en Drive y el
 * vídeo de Drive pesa EXACTAMENTE lo mismo que el de Zoom. El audio y la
 * transcripción de Zoom no se tocan.
 *
 * CÓMO SE INSTALA (una vez)
 * 1. script.google.com → Nuevo proyecto → borra lo que haya y pega TODO esto.
 * 2. Engranaje («Configuración del proyecto») → abajo del todo, «Propiedades
 *    del script» → añade estas cuatro (nombre exacto y su valor):
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
const LIMITE_MS = 3.5 * 60 * 1000;       // Google corta a los 6 min y da 90 min al día: se sigue en la siguiente hora.
const MAX_BYTES = 48 * 1024 * 1024;      // Hasta aquí, de una vez; más grande, a trozos.
const TROZO = 32 * 1024 * 1024;          // Cada trozo (múltiplo de 256 KB, como pide Google).
const CATEGORIA = { si: 'Compraron', no: 'No compraron', '?': 'Sin identificar' };
// Qué vídeo se guarda: el de galería primero.
const PREFERENCIA_VIDEO = ['gallery_view', 'shared_screen_with_gallery_view', 'active_speaker', 'speaker_view',
                           'shared_screen_with_speaker_view', 'shared_screen'];

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

/** Para pararlo: quita la vuelta de cada hora (no borra nada). */
function parar() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'pasarLlamadas'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  Logger.log('Parado: ya no se ejecuta solo. Para volver a empezar, «instalar».');
}

function ejecutar_(prueba) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) { Logger.log('Ya hay otra vuelta en marcha.'); return; }
  try {
    const t0 = Date.now();
    const queda = function () { return Date.now() - t0 < LIMITE_MS; };
    comprobarAjustes_();
    const tok = tokenZoom_();
    const desde = ajuste_('DESDE') || Utilities.formatDate(new Date(Date.now() - 365 * 864e5), 'UTC', 'yyyy-MM-dd');
    const reuniones = grabaciones_(tok, desde).filter(function (m) { return (m.recording_files || []).length; });
    const porUuid = {};
    reuniones.forEach(function (m) { porUuid[m.uuid] = m; });
    const raiz = carpetaRaiz_();
    const reg = leerRegistro_(raiz);
    const c = { grabaciones: reuniones.length, nuevas: 0, ya_estaban: 0, movidas: 0, sin_audio: 0,
                audios_subidos: 0, videos_subidos: 0, videos_a_medias: 0, videos_por_subir: 0, gb_por_subir: 0,
                gb_subidos: 0, quedan_para_luego: 0, videos_borrados: 0, videos_por_borrar: 0,
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

    // 1) Las nuevas: su carpeta, la transcripción y la ficha (lo rápido).
    reuniones.forEach(function (m) {
      if (reg.llamadas[m.uuid]) { c.ya_estaban++; return; }
      const archivos = m.recording_files || [];
      const audio = archivos.filter(function (f) { return f.file_type === 'M4A' && f.download_url; })[0];
      if (!audio) { c.sin_audio++; return; }
      const video = elegirVideo_(archivos);
      if (prueba) {
        c.nuevas++;
        if (video) { c.videos_por_subir++; c.gb_por_subir += (video.file_size || 0) / 1e9; }
        return;
      }
      if (!queda()) { c.quedan_para_luego++; return; }
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
          audio: { zoom_id: audio.id || '', bytes: audio.file_size || 0, estado: 'pendiente' },
          video: video ? { zoom_id: video.id, tipo: video.recording_type || '', bytes: video.file_size || 0, estado: 'pendiente' }
                       : { estado: 'no' },
        };
        const nombre = Utilities.formatDate(inicio, ZONA, 'yyyy-MM-dd HH.mm') + ' · ' + (limpio_(e.nombre) || limpio_(e.tema) || 'Llamada');
        const destino = subcarpeta_(subcarpeta_(raiz, e.mes), CATEGORIA[e.compro]);
        const carpeta = destino.createFolder(nombre);
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

    // 2) Los audios que faltan, y 3) los vídeos (a trozos, se siguen otra vez).
    ['audio', 'video'].forEach(function (cual) {
      Object.keys(reg.llamadas).forEach(function (u) {
        const e = reg.llamadas[u];
        if (prueba || !queda()) return;
        const m = porUuid[u];
        if (cual === 'audio' && !e.audio && e.audio_bytes) return;  // registro de antes, ya está
        const est = e[cual] || (e[cual] = { estado: 'pendiente' });
        if (est.estado === 'hecho' || est.estado === 'no') return;
        if (!m) return;  // ya no está en Zoom: no hay nada que copiar
        const archivos = m.recording_files || [];
        const f = cual === 'audio'
          ? archivos.filter(function (x) { return x.file_type === 'M4A' && x.download_url; })[0]
          : (archivos.filter(function (x) { return x.id === est.zoom_id && x.download_url; })[0] || elegirVideo_(archivos));
        if (!f) { est.estado = 'no'; guardarRegistro_(raiz, reg); return; }
        est.zoom_id = f.id || est.zoom_id; est.bytes = f.file_size || est.bytes || 0;
        if (cual === 'video') est.tipo = f.recording_type || est.tipo || '';
        try {
          const carpeta = DriveApp.getFolderById(e.carpeta);
          const nombre = cual === 'audio' ? 'audio.m4a' : 'video.mp4';
          const mime = cual === 'audio' ? 'audio/mp4' : 'video/mp4';
          const antes = est.subido || 0;
          const id = copiar_(tok, f.download_url, est.bytes, carpeta, nombre, mime, est, queda,
                             function () { guardarRegistro_(raiz, reg); });
          if (id) {
            const tam = DriveApp.getFileById(id).getSize();
            est.drive_id = id; est.drive_bytes = tam; est.sesion = '';
            est.estado = (!est.bytes || tam === est.bytes) ? 'hecho' : 'error';
            if (est.estado === 'error') { c.errores++; Logger.log('El ' + cual + ' subido no pesa lo mismo que en Zoom: se volverá a subir.'); est.sesion = ''; est.subido = 0; }
            if (cual === 'audio' && est.estado === 'hecho') { e.audio_bytes = tam; c.audios_subidos++; }
            if (cual === 'video' && est.estado === 'hecho') { c.videos_subidos++; c.gb_subidos += tam / 1e9; }
          } else if (cual === 'video') {
            c.videos_a_medias++; c.gb_subidos += Math.max(0, (est.subido || 0) - antes) / 1e9;
          }
          guardarRegistro_(raiz, reg);
        } catch (err) { c.errores++; Logger.log('No se pudo copiar un ' + cual + ': ' + err); guardarRegistro_(raiz, reg); }
      });
    });
    if (prueba) {
      Object.keys(reg.llamadas).forEach(function (u) {
        const e = reg.llamadas[u], v = e.video;
        if (!v || v.estado !== 'hecho') {
          const m = porUuid[u], f = m ? elegirVideo_(m.recording_files || []) : null;
          if (f) { c.videos_por_subir++; c.gb_por_subir += (f.file_size || 0) / 1e9; }
        }
      });
    }

    // 4) El borrado mensual del vídeo de Zoom.
    const esteMes = Utilities.formatDate(new Date(), ZONA, 'yyyy-MM');
    reuniones.forEach(function (m) {
      const e = reg.llamadas[m.uuid];
      const archivos = m.recording_files || [];
      const videos = archivos.filter(function (f) { return f.file_type === 'MP4' && f.id; });
      if (prueba) {
        // Lo que se borrará cuando su vídeo esté en Drive.
        const ident = e ? e.identificada : (quien[m.uuid] || {}).identificada;
        const mes = Utilities.formatDate(new Date(m.start_time), ZONA, 'yyyy-MM');
        if (ident && mes < esteMes) c.videos_por_borrar += videos.length;
        return;
      }
      if (!e || !e.identificada || e.video_borrado || !(e.mes < esteMes)) return;
      if (!videoSeguro_(e, archivos)) return;
      if (!videos.length) { e.video_borrado = true; return; }
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

    ['gb_liberados', 'gb_subidos', 'gb_por_subir'].forEach(function (k) { c[k] = Math.round(c[k] * 100) / 100; });
    Logger.log((prueba ? 'PRUEBA (no se ha subido ni borrado nada): ' : 'Hecho: ') + JSON.stringify(c, null, 1));
  } finally {
    lock.releaseLock();
  }
}

/** ¿Se puede borrar ya el vídeo de Zoom? Solo con el audio y el vídeo en Drive,
 *  y el vídeo con el mismo tamaño que el de Zoom. */
function videoSeguro_(e, archivos) {
  const a = e.audio, v = e.video;
  const audioOk = a ? a.estado === 'hecho' : !!e.audio_bytes;
  if (!audioOk || !v) return false;
  const mp4 = archivos.filter(function (f) { return f.file_type === 'MP4' && f.id; });
  if (v.estado === 'no') return !mp4.length;
  if (v.estado !== 'hecho' || !v.drive_bytes) return false;
  const enZoom = mp4.filter(function (f) { return f.id === v.zoom_id; })[0];
  return !!enZoom && enZoom.file_size === v.drive_bytes;
}

/** El vídeo que se guarda: el de galería si lo hay, si no el que haya. */
function elegirVideo_(archivos) {
  const mp4 = (archivos || []).filter(function (f) { return f.file_type === 'MP4' && f.id && f.download_url; });
  if (!mp4.length) return null;
  mp4.sort(function (a, b) {
    const ia = PREFERENCIA_VIDEO.indexOf(a.recording_type), ib = PREFERENCIA_VIDEO.indexOf(b.recording_type);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return mp4[0];
}

// ── Copiar un archivo de Zoom a Drive (de una vez o a trozos) ─────────────────

/** Devuelve el id del archivo en Drive si ha terminado; null si queda a medias
 *  (se sigue en la siguiente vuelta, `est` guarda dónde se quedó). */
function copiar_(tok, url, total, carpeta, nombre, mime, est, queda, guardar) {
  if (total && total <= MAX_BYTES && !est.sesion) {
    const blob = bajar_(tok, url).setName(nombre);
    return carpeta.createFile(blob).getId();
  }
  if (!total) throw new Error('Zoom no dice cuánto pesa el archivo.');
  // Una subida a trozos: Drive da una «sesión» que dura una semana.
  let desde = 0;
  if (est.sesion) {
    const st = estadoSubida_(est.sesion, total);
    if (st.id) return st.id;
    if (st.desde < 0) { est.sesion = ''; } else { desde = st.desde; }
  }
  if (!est.sesion) { est.sesion = iniciarSubida_(carpeta, nombre, mime, total); desde = 0; est.subido = 0; guardar(); }
  let fuente = origenZoom_(tok, url);
  while (desde < total) {
    if (!queda()) { est.subido = desde; return null; }
    const hasta = Math.min(desde + TROZO, total) - 1;
    let r = trozoZoom_(fuente, desde, hasta);
    if (r.code === 401 || r.code === 403) { fuente = origenZoom_(tok, url); r = trozoZoom_(fuente, desde, hasta); }
    if (r.code !== 206 && !(r.code === 200 && desde === 0 && hasta === total - 1)) {
      throw new Error('Zoom no deja bajar el archivo a trozos (' + r.code + ')');
    }
    const bytes = r.bytes;
    if (bytes.length !== hasta - desde + 1) throw new Error('Zoom ha mandado un trozo incompleto.');
    const s = UrlFetchApp.fetch(est.sesion, {
      method: 'put', contentType: mime, payload: bytes, muteHttpExceptions: true,
      headers: { 'Content-Range': 'bytes ' + desde + '-' + hasta + '/' + total },
    });
    const code = s.getResponseCode();
    if (code === 200 || code === 201) { est.subido = total; return JSON.parse(s.getContentText()).id; }
    if (code !== 308) throw new Error('Drive no aceptó un trozo (' + code + '): ' + s.getContentText().slice(0, 200));
    const rango = cabecera_(s, 'Range');
    const m = rango.match(/bytes=0-(\d+)/);
    desde = m ? Number(m[1]) + 1 : 0;
    est.subido = desde;
    guardar();
  }
  const fin = estadoSubida_(est.sesion, total);
  return fin.id || null;
}

/** La dirección real del archivo (Zoom redirige a su almacén). */
function origenZoom_(tok, url) {
  let u = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'access_token=' + encodeURIComponent(tok);
  for (let i = 0; i < 5; i++) {
    const conClave = /(^|\.)zoom\.us$/.test(host_(u));
    const h = { Range: 'bytes=0-0' };
    if (conClave) h.Authorization = 'Bearer ' + tok;
    const r = UrlFetchApp.fetch(u, { headers: h, followRedirects: false, muteHttpExceptions: true });
    const code = r.getResponseCode();
    if (code >= 300 && code < 400) {
      const loc = cabecera_(r, 'Location');
      if (!loc) break;
      u = /^https?:/i.test(loc) ? loc : 'https://' + host_(u) + (loc.charAt(0) === '/' ? '' : '/') + loc;
      continue;
    }
    if (code === 200 || code === 206) return { url: u, clave: conClave ? tok : '' };
    throw new Error('Zoom no deja bajar el archivo (' + code + ')');
  }
  throw new Error('Zoom redirige demasiadas veces.');
}

function trozoZoom_(fuente, desde, hasta) {
  const h = { Range: 'bytes=' + desde + '-' + hasta };
  if (fuente.clave) h.Authorization = 'Bearer ' + fuente.clave;
  const r = UrlFetchApp.fetch(fuente.url, { headers: h, followRedirects: true, muteHttpExceptions: true });
  const code = r.getResponseCode();
  return { code: code, bytes: (code === 206 || code === 200) ? r.getContent() : [] };
}

function iniciarSubida_(carpeta, nombre, mime, total) {
  const r = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
    method: 'post', contentType: 'application/json; charset=UTF-8', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(total) },
    payload: JSON.stringify({ name: nombre, parents: [carpeta.getId()] }),
  });
  const sesion = cabecera_(r, 'Location');
  if (r.getResponseCode() !== 200 || !sesion) throw new Error('Drive no deja empezar la subida (' + r.getResponseCode() + '): ' + r.getContentText().slice(0, 200));
  return sesion;
}

/** Dónde se quedó una subida: {desde} para seguir, {id} si ya terminó, desde -1 si ya no vale. */
function estadoSubida_(sesion, total) {
  const r = UrlFetchApp.fetch(sesion, { method: 'put', payload: '', muteHttpExceptions: true,
    headers: { 'Content-Range': 'bytes */' + total } });
  const code = r.getResponseCode();
  if (code === 200 || code === 201) { try { return { id: JSON.parse(r.getContentText()).id }; } catch (e) { return { desde: -1 }; } }
  if (code === 308) { const m = cabecera_(r, 'Range').match(/bytes=0-(\d+)/); return { desde: m ? Number(m[1]) + 1 : 0 }; }
  return { desde: -1 };
}

function cabecera_(r, nombre) {
  const h = r.getAllHeaders ? r.getAllHeaders() : r.getHeaders();
  const k = Object.keys(h || {}).filter(function (x) { return x.toLowerCase() === nombre.toLowerCase(); })[0];
  const v = k ? h[k] : '';
  return String(Array.isArray(v) ? v[0] : (v || ''));
}

function host_(u) { const m = String(u).match(/^https?:\/\/([^\/?#]+)/i); return m ? m[1].toLowerCase() : ''; }

// ── Ajustes ───────────────────────────────────────────────────────────────────

function ajuste_(n) { const v = PropertiesService.getScriptProperties().getProperty(n); return v ? String(v).trim() : ''; }

function comprobarAjustes_() {
  const faltan = ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET', 'SCHOOL_CRON_TOKEN']
    .filter(function (n) { return !ajuste_(n); });
  if (faltan.length) throw new Error('Faltan estas propiedades del proyecto (engranaje → abajo del todo, Propiedades del script): ' + faltan.join(', '));
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
  if (e.video && e.video.tipo) filas.push('Vídeo guardado: ' + e.video.tipo);
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
