require('dotenv').config();

const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

function getFechaFormateada() {
  const opciones = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Mexico_City' // Forzar hora local de México
  };
  return new Date().toLocaleDateString('es-MX', opciones);
}

function getFechasFiltro() {
  const ahora = new Date();
  const hoy = ahora.toLocaleDateString("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Mexico_City"
  });
  const fechaHoy = ahora.toLocaleDateString("sv-SE", { timeZone: "America/Mexico_City" }); // Formato YYYY-MM-DD local
  const fechaAyer = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
  fechaAyer.setDate(fechaAyer.getDate() - 2);
  const fechaAyerStr = fechaAyer.toISOString().split("T")[0];

  return { hoy, fechaHoy, fechaAyer: fechaAyerStr };
}

async function limpiarConJina(url, timeoutMs = 30000) {
  try {
    const response = await axios.get(`https://r.jina.ai/${url}`, {
      timeout: timeoutMs,
      headers: {
        "Authorization": "Bearer jina_823b3f25d69a4d6c8a307398f90e2c31fJQQu6mrjo-aMnhw0CufgKdqsyO8",
        "Accept": "text/plain",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    const texto = response.data || "";
    if (texto.length < 200) {
      console.log(`⚠️ Advertencia: El portal ${url} devolvió muy poco contenido (posible bloqueo).`);
    }
    return texto.substring(0, 8000); // Mayor margen de texto para capturar los párrafos íntegros
  } catch (error) {
    console.log(`⚠️ Error/Timeout al consultar ${url}:`, error.message);
    return "Sin información disponible";
  }
}

async function obtenerContenidoPortales() {
  const portalesChiapas = [
    { nombre: "CUARTO PODER", url: "https://www.cuartopoder.mx/edicionimpresa" },
    { nombre: "EL HERALDO DE CHIAPAS", url: "https://www.elheraldodechiapas.com.mx/local/" },
    { nombre: "DIARIO DE CHIAPAS", url: "https://www.diariodechiapas.com" },
    { nombre: "ALERTA CHIAPAS", url: "https://alertachiapas.com/category/chiapas/" },
    { nombre: "TV AZTECA CHIAPAS", url: "https://www.aztecachiapas.com/noticias/" },
    { nombre: "CHIAPAS PARALELO", url: "https://www.chiapasparalelo.com" },
    { nombre: "CHIAPAS EN CONTACTO", url: "https://chiapasencontacto.com" },
    { nombre: "DIARIO ULTIMATUM", url: "https://ultimatumchiapas.com.mx" },
    { nombre: "EL ORBE", url: "https://elorbe.com" },
    { nombre: "ASICH", url: "https://www.asich.com/portada" },
    { nombre: "LA VOZ DEL SURESTE", url: "https://diariolavozdelsureste.com/category/chiapas/" }
  ];

  const portalesNacionales = [
    { nombre: "MILENIO", url: "https://www.milenio.com/politica" },
    { nombre: "EL UNIVERSAL", url: "https://www.eluniversal.com.mx/nacion/" },
    { nombre: "INFOBAE MÉXICO", url: "https://www.infobae.com/mexico/" },
    { nombre: "PROCESO", url: "https://www.proceso.com.mx/nacional/" },
    { nombre: "ANIMAL POLÍTICO", url: "https://animalpolitico.com" },
    { nombre: "LA JORNADA", url: "https://www.jornada.com.mx/categoria/politica" },
    { nombre: "MVS NOTICIAS", url: "https://mvsnoticias.com/nacional/" },
    { nombre: "REPORTE ÍNDIGO", url: "https://www.reporteindigo.com/reporte/" },
    { nombre: "EXCÉLSIOR", url: "https://www.excelsior.com.mx/nacional" },
    { nombre: "EL ECONOMISTA", url: "https://www.eleconomista.com.mx/politica" },
    { nombre: "HERALDO DE MÉXICO", url: "https://heraldodemexico.com.mx/mundo/" },
    { nombre: "ARISTEGUI NOTICIAS", url: "https://aristeguinoticias.com/" },
    { nombre: "LA RAZÓN", url: "https://www.razon.com.mx/" },
    { nombre: "EXPANSIÓN POLÍTICA", url: "https://politica.expansion.mx/" }
  ];

  console.log("Iniciando raspado con Jina Reader para Chiapas...");
  const contenidosChiapas = [];
  for (const portal of portalesChiapas) {
    const contenido = await limpiarConJina(portal.url);
    contenidosChiapas.push({ nombre: portal.nombre, contenido });
  }

  console.log("Iniciando raspado con Jina Reader para Nacionales...");
  const contenidosNacionales = [];
  for (const portal of portalesNacionales) {
    const contenido = await limpiarConJina(portal.url);
    contenidosNacionales.push({ nombre: portal.nombre, contenido });
  }

  const seccionChiapas = contenidosChiapas.map(p => `${p.nombre}:\n${p.contenido}`).join("\n\n");
  const seccionNacionales = contenidosNacionales.map(p => `${p.nombre}:\n${p.contenido}`).join("\n\n");

  return { seccionChiapas, seccionNacionales };
}

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// =========================================================
// OPCIÓN 1: GUIÓN EDITADO / SINTETIZADO
// =========================================================
app.post('/api/generar-noticiero', async (req, res) => {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return res.status(500).json({ exito: false, error: 'API Key no configurada.' });

    const { hoy, fechaHoy, fechaAyer } = getFechasFiltro();
    const { seccionChiapas, seccionNacionales } = await obtenerContenidoPortales();

    const prompt = `Hoy es ${hoy}. Fecha exacta: ${fechaHoy}. Rango aceptable: ${fechaAyer} a ${fechaHoy}.
REGLAS:
1. Responde a qué, quién, cuándo, cómo, dónde, por qué.
2. NUNCA inventes noticias. Solo entre ${fechaAyer} y ${fechaHoy}.
3. NO repitas temas.
4. OMITIR de manera absoluta cualquier nota que mencione a Eduardo Ramírez, su apodo o siglas "ERA", o al Gobierno de Chiapas.
5. Formato directo, sin palabras de locutor ni introducciones.

BLOQUE 2 — CHIAPAS (5 a 10 notas)
${seccionChiapas}

BLOQUE 3 — NACIONALES (10 notas)
${seccionNacionales}

Formato de cada nota:
[Fuente] | [Autor] | [Fecha] | [Hora]
[TÍTULO EN MAYÚSCULAS]
[Resumen periodístico en tercera persona]`;

    const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';
    const response = await axios.post(apiUrl, {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'Eres un editor de noticias para radio comercial.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 8000
    }, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 120000 });

    res.json({ exito: true, guion: response.data.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ exito: false, error: 'Error al generar guion editado.', detalle: error.message });
  }
});

// =========================================================
// OPCIÓN 2: GUIÓN ÍNTEGRO (2 NOTAS ÍNTEGRAS POR SITIO CON REGLA ESTRICTA DE ARISTEGUI)
// =========================================================
app.post('/api/generar-guion-original', async (req, res) => {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return res.status(500).json({ exito: false, error: 'API Key no configurada.' });

    const { fechaHoy } = getFechasFiltro();
    const { seccionChiapas, seccionNacionales } = await obtenerContenidoPortales();

    const promptOriginal = `Fecha de hoy: ${fechaHoy}.

INSTRUCCIONES ESTRICTAS DE EXTRACCIÓN Y CONTENIDO:
1. Analiza los textos extraídos de cada portal.
2. SELECCIÓN POR SITIO: Extrae exactamente **2 notas completas** de cada portal que cuente con información desarrollada.
3. REGLA DE CONTENIDO ÍNTEGRO (Estándar Aristegui): Está estrictamente prohibido entregar notas mochadas, con una sola línea de titular, con marcadores como "[Leer más]" o con texto insuficiente. Debes rescatar el cuerpo íntegro con párrafos informativos reales y desarrollados tal como vienen en el texto extraído.
4. LÍMITE DE PALABRAS: Cada nota extraída debe tener un **máximo de 500 palabras** (si es más extensa, córtala coherentemente o prioriza los párrafos clave hasta ese tope).
5. CERO PARÁFRASIS / CERO ETIQUETAS FALSAS: Respeta el cuerpo de texto original del medio, sin inventar texto ni colocar leyendas genéricas.
6. OMISIONES: Descartar de inmediato y de forma absoluta cualquier mención a Eduardo Ramírez, el apodo o siglas "ERA", o al Gobierno de Chiapas.

FORMATO OBLIGATORIO:
[Nombre del Portal] | ${fechaHoy}
[TÍTULO DE LA NOTA EN MAYÚSCULAS]
[Texto íntegro original de la noticia con párrafos completos, máx. 500 palabras]

════════════════════════════════════════
NOTICIAS EXTRAÍDAS DE CHIAPAS:
${seccionChiapas}

════════════════════════════════════════
NOTICIAS EXTRAÍDAS NACIONALES:
${seccionNacionales}`;

    const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';
    const response = await axios.post(apiUrl, {
      model: 'deepseek-chat',
      messages: [
        { 
          role: 'system', 
          content: 'Eres un extractor estricto de contenidos de prensa. Tu labor es rescatar exactamente 2 notas con su texto íntegro, párrafos completos (máximo 500 palabras por nota) y estilo original por cada portal.' 
        },
        { role: 'user', content: promptOriginal }
      ],
      temperature: 0.1,
      max_tokens: 8000
    }, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 120000 });

    res.json({ 
      exito: true, 
      guion: response.data.choices[0].message.content 
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: 'Error al generar guion íntegro.', detalle: error.message });
  }
});

// =========================================================
// OPCIÓN 3: SÍNTESIS DE PRENSA (MONITOREO DE MEDIOS)
// =========================================================
app.post('/api/sintesis-prensa', async (req, res) => {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return res.status(500).json({ exito: false, error: 'API Key no configurada.' });

    const { fechaHoy } = getFechasFiltro();
    const { seccionChiapas, seccionNacionales } = await obtenerContenidoPortales();

    const promptSintesis = `Fecha de hoy: ${fechaHoy}.

OBJETIVO:
Crear un reporte de "Síntesis de Prensa" (Monitoreo de Medios) limpio y ordenado para la mesa de trabajo de radio.

REGLAS ESTRICTAS:
1. FILTRADO TOTAL: Oculta y elimina por completo cualquier mención a notas vacías o sin contenido. Muestra únicamente los portales y notas que SÍ tienen extractos reales.
2. FORMATO DE MONITOREO: Presenta el nombre del medio, la fecha, y enlistados limpios con el título y la bajada o extracto disponible.
3. OMISIONES: Excluye de manera absoluta cualquier nota relacionada con Eduardo Ramírez, su apodo o siglas "ERA", o el Gobierno de Chiapas.

ESTRUCTURA DE SALIDA:
[Nombre del Portal] | [Fecha]
- TÍTULO DE LA NOTA: Extracto o descripción disponible.

════════════════════════════════════════
PORTALES DE CHIAPAS:
${seccionChiapas}

════════════════════════════════════════
PORTALES NACIONALES:
${seccionNacionales}`;

    const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';
    const response = await axios.post(apiUrl, {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'Eres un analista de medios y jefe de prensa. Compilas monitoreos de prensa limpios, precisos y directos.' },
        { role: 'user', content: promptSintesis }
      ],
      temperature: 0.1,
      max_tokens: 8000
    }, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 120000 });

    res.json({ 
      exito: true, 
      guion: response.data.choices[0].message.content 
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: 'Error al generar síntesis de prensa.', detalle: error.message });
  }
});

// =========================================================
// OPCIÓN 4: SÍNTESIS CON ENLACES DIRECTOS A CADA NOTA
// =========================================================
app.post('/api/sintesis-con-enlaces', async (req, res) => {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return res.status(500).json({ exito: false, error: 'API Key no configurada.' });

    const { seccionChiapas, seccionNacionales } = await obtenerContenidoPortales();

    const promptOpcion4 = `Actúa como analista de noticias. A partir de los textos de los portales proporcionados abajo, extrae las notas más importantes.

REGLAS ESTRICTAS DE FORMATO (Debes seguir este orden exacto para cada nota):
PORTAL: [Nombre del Portal]
TÍTULO: [Título claro de la noticia]
ENLACE: [URL genérica o específica]
EXTRACTO: [Resumen breve de 1 o 2 líneas]

REQUISITOS:
1. Excluye de manera absoluta cualquier nota relacionada con Eduardo Ramírez, su apodo o siglas "ERA", o el Gobierno de Chiapas.
2. Máximo de 3 a 4 notas destacadas por portal para mantener la síntesis limpia.

CONTENIDO DE PORTALES DE CHIAPAS:
${seccionChiapas}

CONTENIDO DE PORTALES NACIONALES:
${seccionNacionales}`;

    const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';
    const response = await axios.post(apiUrl, {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'Eres un sistema estricto de extracción de datos que devuelve la información estructurada por campos (PORTAL, TÍTULO, ENLACE, EXTRACTO).' },
        { role: 'user', content: promptOpcion4 }
      ],
      temperature: 0.1,
      max_tokens: 8000
    }, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 120000 });

    let textoRespuesta = response.data.choices[0].message.content;

    // Blindaje automático de URLs fijas por medio
    let bloques = textoRespuesta.split(/PORTAL:/i);
    let textoProcesado = bloques.map((bloque, index) => {
      if (index === 0) return bloque;

      let lineas = bloque.split('\n');
      let nombrePortal = lineas[0].trim().toUpperCase();

      for (let i = 0; i < lineas.length; i++) {
        if (lineas[i].startsWith('ENLACE:')) {
          if (nombrePortal.includes('CUARTO PODER')) {
            lineas[i] = 'ENLACE: https://www.cuartopoder.mx/edicionimpresa';
          } else if (nombrePortal.includes('ALERTA CHIAPAS')) {
            lineas[i] = 'ENLACE: https://alertachiapas.com/category/chiapas/';
          } else if (nombrePortal.includes('HERALDO DE MÉXICO')) {
            lineas[i] = 'ENLACE: https://heraldodemexico.com.mx/mundo/';
          } else if (nombrePortal.includes('ARISTEGUI NOTICIAS')) {
            lineas[i] = 'ENLACE: https://aristeguinoticias.com/';
          } else if (nombrePortal.includes('LA RAZÓN')) {
            lineas[i] = 'ENLACE: https://www.razon.com.mx/';
          } else if (nombrePortal.includes('EXPANSIÓN POLÍTICA')) {
            lineas[i] = 'ENLACE: https://politica.expansion.mx/';
          }
          break;
        }
      }
      return 'PORTAL:' + lineas.join('\n');
    }).join('');

    res.json({ 
      exito: true, 
      guion: textoProcesado 
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: 'Error al generar síntesis con enlaces.', detalle: error.message });
  }
});

// =========================================================
// OPCIÓN 5: GUIÓN POR BLOQUES (URL INDIVIDUAL O ESPECÍFICA)
// =========================================================
app.post('/api/procesar-bloque', async (req, res) => {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return res.status(500).json({ exito: false, error: 'API Key no configurada.' });

    const { url, nombrePortal } = req.body;
    if (!url || !nombrePortal) {
      return res.status(400).json({ exito: false, error: 'Faltan la URL o el nombre del portal.' });
    }

    const { fechaHoy } = getFechasFiltro();
    
    // Raspado enfocado únicamente a esta URL con todo el margen necesario
    const contenidoPortal = await limpiarConJina(url);

    const promptBloque = `Fecha de hoy: ${fechaHoy}.
Portal a analizar: ${nombrePortal}

INSTRUCCIONES ESTRICTAS:
1. Extrae de manera íntegra y completa las notas principales del texto proporcionado para este portal.
2. NO RECORTES TEXTO: Conserva los párrafos informativos completos, el cuerpo original de la noticia, nombres, lugares y detalles (como menciones locales o entrevistas), sin dejar notas a medias ni usar marcadores de corte.
3. MÁXIMO DE PALABRAS: Cada nota debe tener un tope de 500 palabras, pero asegurando el máximo desarrollo posible de la información original.
4. CERO PARÁFRASIS: Respeta el estilo y cuerpo redactado por el medio.
5. OMISIONES: Descartar de forma absoluta cualquier mención a Eduardo Ramírez, su apodo, siglas "ERA", o al Gobierno de Chiapas.

FORMATO OBLIGATORIO:
${nombrePortal} | ${fechaHoy}
[TÍTULO DE LA NOTA EN MAYÚSCULAS]
[Texto íntegro original con párrafos completos]

CONTENIDO EXTRAÍDO DEL PORTAL:
${contenidoPortal}`;

    const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';
    const response = await axios.post(apiUrl, {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'Eres un extractor estricto de prensa. Tu objetivo es rescatar las notas con todo su texto íntegro y párrafos completos sin recortes.' },
        { role: 'user', content: promptBloque }
      ],
      temperature: 0.1,
      max_tokens: 8000 // Todo el poder de los tokens concentrado en este único bloque
    }, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 120000 });

    res.json({ 
      exito: true, 
      guion: response.data.choices[0].message.content 
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: 'Error al procesar el bloque.', detalle: error.message });
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
