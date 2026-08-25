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

async function limpiarConJina(url, timeoutMs = 15000) {
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
    return texto.substring(0, 4000); // Espacio suficiente para la nota íntegra
  } catch (error) {
    console.log(`⚠️ Error/Timeout al consultar ${url}:`, error.message);
    return "Sin información disponible";
  }
}

async function obtenerContenidoPortales() {
  const portalesChiapas = [
    { nombre: "CUARTO PODER", url: "https://www.cuartopoder.mx" },
    { nombre: "EL HERALDO DE CHIAPAS", url: "https://www.elheraldodechiapas.com.mx/local/" },
    { nombre: "DIARIO DE CHIAPAS", url: "https://www.diariodechiapas.com" },
    { nombre: "ALERTA CHIAPAS", url: "https://www.alertachiapas.com" },
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
    { nombre: "LA JORNADA", url: "https://www.jornada.com.mx/category/politica" },
    { nombre: "MVS NOTICIAS", url: "https://mvsnoticias.com/nacional/" },
    { nombre: "REPORTE ÍNDIGO", url: "https://www.reporteindigo.com/reporte/" },
    { nombre: "EXCÉLSIOR", url: "https://www.excelsior.com.mx/nacional" },
    { nombre: "EL FINANCIERO", url: "https://www.elfinanciero.com.mx/nacional/" },
    { nombre: "EL ECONOMISTA", url: "https://www.eleconomista.com.mx/politica" },
    { nombre: "HERALDO DE MÉXICO", url: "https://heraldodemexico.com.mx/nacional/" }
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
    const fechaEmision = getFechaFormateada();
    const { seccionChiapas, seccionNacionales } = await obtenerContenidoPortales();

    const prompt = `Hoy es ${hoy}. Fecha exacta: ${fechaHoy}. Rango aceptable: ${fechaAyer} a ${fechaHoy}.
REGLAS:
1. Responde a qué, quién, cuándo, cómo, dónde, por qué.
2. NUNCA inventes noticias. Solo entre ${fechaAyer} y ${fechaHoy}.
3. NO repitas temas.
4. OMITIR cualquier nota sobre EDUARDO RAMÍREZ.
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

    res.json({ exito: true, guion: `NOTICIAS CHIAPAS (EDITADO)\nGenerado el: ${fechaEmision}\n==========================================\n\n` + response.data.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ exito: false, error: 'Error al generar guion editado.', detalle: error.message });
  }
});

// =========================================================
// OPCIÓN 2: GUIÓN COMPLETO (FILTRADO Y REDACTADO INTEGRAL)
// =========================================================
app.post('/api/generar-guion-original', async (req, res) => {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return res.status(500).json({ exito: false, error: 'API Key no configurada.' });

    const { hoy, fechaHoy, fechaAyer } = getFechasFiltro();
    const fechaEmision = getFechaFormateada();
    const { seccionChiapas, seccionNacionales } = await obtenerContenidoPortales();

    const promptOriginal = `Fecha de hoy: ${fechaHoy}.

INSTRUCCIONES DE SELECCIÓN Y REDACCIÓN:
1. Revisa los datos extraídos de las noticias de Chiapas y Nacionales.
2. DISCARD SILENCIOSO: Si una noticia solo tiene un título de 1 línea o no contiene contexto suficiente, DESCÁRTALA POR COMPLETO. No incluyas su encabezado, no incluyas el nombre del portal, ni agregues comentarios aclaratorios.
3. SELECCIÓN DE CONTENIDO: Selecciona únicamente las 10 a 12 noticias en total (sumando Chiapas y Nacionales) que tengan mejor información sustancial.
4. REDACCIÓN: Toma el titular y la información disponible para redactar una nota informativa completa de 2 a 3 párrafos para el locutor.
5. OMISIONES: Si hay menciones a EDUARDO RAMÍREZ, descártalas de inmediato.
6. DIVERSIFICACIÓN: Selecciona máximo 1 o 2 notas por medio de comunicación.

FORMATO PERMITIDO ÚNICAMENTE:
[Nombre del Portal] | [Fecha]
[TÍTULO EN MAYÚSCULAS]
[Texto redactado de la noticia en 2 o 3 párrafos listos para lectura]

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
          content: 'Eres el productor ejecutivo del noticiero de radio. Tu única tarea es entregar un guión limpio con notas redactadas para aire. Está prohibido escribir frases como "nota no disponible", "sin contenido" o dejar titulares sueltos. Si no hay datos de una nota, la ignoras por completo.' 
        },
        { role: 'user', content: promptOriginal }
      ],
      temperature: 0.3,
      max_tokens: 8000
    }, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 120000 });

    res.json({ 
      exito: true, 
      guion: `GUION INFORMATIVO EXTENSO DE CABINA\nGenerado el: ${fechaEmision}\n==========================================\n\n` + response.data.choices[0].message.content 
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: 'Error al generar guion original.', detalle: error.message });
  }
});

// =========================================================
// OPCIÓN 3: SÍNTESIS DE PRENSA (MONITOREO DE MEDIOS)
// =========================================================
app.post('/api/sintesis-prensa', async (req, res) => {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return res.status(500).json({ exito: false, error: 'API Key no configurada.' });

    const { hoy, fechaHoy, fechaAyer } = getFechasFiltro();
    const fechaEmision = getFechaFormateada();
    const { seccionChiapas, seccionNacionales } = await obtenerContenidoPortales();

    const promptSintesis = `Fecha de hoy: ${fechaHoy}.

OBJETIVO:
Crear un reporte de "Síntesis de Prensa" (Monitoreo de Medios) limpio y ordenado para la mesa de trabajo de radio.

REGLAS ESTRICTAS:
1. FILTRADO TOTAL: Oculta y elimina por completo cualquier mención a notas vacías o sin contenido. Muestra únicamente los portales y notas que SÍ tienen extractos reales.
2. FORMATO DE MONITOREO: Presenta el nombre del medio, la fecha, y enlistados limpios con el título y la bajada o extracto disponible.
3. OMISIONES: Excluye cualquier nota relacionada con EDUARDO RAMÍREZ.

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
      guion: `SÍNTESIS DE PRENSA (MONITOREO DE MEDIOS)\nGenerado el: ${fechaEmision}\n==========================================\n\n` + response.data.choices[0].message.content 
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

    const fechaEmision = getFechaFormateada();
    const { seccionChiapas, seccionNacionales } = await obtenerContenidoPortales();

    // PROMPT REESTRUCTURADO: Exigimos enlaces independientes por nota obligatoriamente
    const promptOpcion4 = `Actúa como analista de noticias. A partir de los textos de los portales proporcionados abajo, extrae las notas más importantes y asígnale a CADA una su propio enlace o la URL base del portal si no hay un enlace específico en el texto.

REGLAS ESTRICTAS DE FORMATO (Debes seguir este orden exacto para cada nota):
PORTAL: [Nombre del Portal]
TÍTULO: [Título claro de la noticia]
ENLACE: [URL exacta de la noticia o del portal]
EXTRACTO: [Resumen breve de 1 o 2 líneas]

REQUISITOS:
1. NO repitas el mismo enlace genérico para todas las notas si el portal ofrece URLs distintas en el contenido; si no hay enlace individual, usa la URL base del portal.
2. Excluye cualquier nota relacionada con EDUARDO RAMÍREZ.
3. Máximo de 3 a 4 notas destacadas por portal para mantener la síntesis limpia.

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
      temperature: 0.1, // Temperatura baja para que siga estrictamente la estructura
      max_tokens: 8000
    }, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 120000 });

    res.json({ 
      exito: true, 
      guion: `SÍNTESIS DE PRENSA CON ENLACES INDIVIDUALES\nGenerado el: ${fechaEmision}\n==========================================\n\n` + response.data.choices[0].message.content 
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: 'Error al generar síntesis con enlaces.', detalle: error.message });
  }
});
