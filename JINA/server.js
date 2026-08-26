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
    timeZone: 'America/Mexico_City'
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
  const fechaHoy = ahora.toLocaleDateString("sv-SE", { timeZone: "America/Mexico_City" });
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

    let texto = response.data || "";
    if (texto.length < 200) {
      console.log(`⚠️ Advertencia: El portal ${url} devolvió muy poco contenido (posible bloqueo).`);
    }

    const frasesDeCorte = [
      "Temas Relacionados",
      "Tema Relacionado",
      "Te Recomendamos",
      "Contenido Relacionado",
      "Taboola",
      "Patrocinado",
      "by Taboola"
    ];

    let menorIndice = texto.length;

    for (const frase of frasesDeCorte) {
      const indice = texto.indexOf(frase);
      if (indice !== -1 && indice < menorIndice) {
        menorIndice = indice;
      }
    }

    if (menorIndice < texto.length) {
      texto = texto.substring(0, menorIndice);
    }

    return texto.substring(0, 15000); 
  } catch (error) {
    console.log(`⚠️ Error/Timeout al consultar ${url}:`, error.message);
    return "Sin información disponible";
  }
}

async function rasparDosNotasAristegui(urlPortada) {
  try {
    console.log("🔍 Analizando portada de Aristegui Noticias...");
    const htmlPortada = await limpiarConJina(urlPortada);
    
    const regexUrls = /https:\/\/aristeguinoticias.com\/\d{4}\/[a-z]+\/[^\/\s)]+\//g;
    const matches = htmlPortada.match(regexUrls);

    if (!matches || matches.length === 0) {
      console.log("⚠️ No se encontraron enlaces de notas en la portada de Aristegui.");
      return "Sin información de Aristegui Noticias";
    }

    const urlsUnicas = [...new Set(matches)];
    const urlsAExtraer = urlsUnicas.slice(0, 2);
    console.log(`🎯 Enlaces principales detectados en Aristegui:`, urlsAExtraer);

    let contenidoDosNotas = "";

    for (let i = 0; i < urlsAExtraer.length; i++) {
      const urlNota = urlsAExtraer[i];
      console.log(`📥 Extrayendo nota ${i + 1} de Aristegui: ${urlNota}`);
      
      const textoNota = await limpiarConJina(urlNota);
      contenidoDosNotas += `\n--- NOTA ARISTEGUI ${i + 1} (${urlNota}) ---\n${textoNota}\n`;
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return contenidoDosNotas;
  } catch (error) {
    console.log("⚠️ Error al procesar notas de Aristegui:", error.message);
    return "Sin información disponible de Aristegui";
  }
}

async function obtenerContenidoPortales() {
  const portalesChiapas = [
    { nombre: "EL HERALDO DE CHIAPAS", url: "https://www.elheraldodechiapas.com.mx/local/" },
    { nombre: "ALERTA CHIAPAS", url: "https://alertachiapas.com/category/chiapas/" },
    { nombre: "CHIAPAS PARALELO", url: "https://www.chiapasparalelo.com" },
    { nombre: "CHIAPAS EN CONTACTO", url: "https://chiapasencontacto.com" },
    { nombre: "ASICH", url: "https://www.asich.com/portada" },
    { nombre: "LA VOZ DEL SURESTE", url: "https://diariolavozdelsureste.com/category/chiapas/" },
    { nombre: "CUARTO PODER", url: "https://www.cuartopoder.mx/chiapas/" },
    { nombre: "AZTECA NOTICIAS CHIAPAS", url: "https://www.tvazteca.com/aztecanoticias/chiapas" }
  ];

  const portalesNacionales = [
    { nombre: "ARISTEGUI NOTICIAS", url: "https://aristeguinoticias.com/" },
    { nombre: "ANIMAL POLÍTICO", url: "https://animalpolitico.com" },
    { nombre: "PROCESO", url: "https://www.proceso.com.mx/nacional/" },
    { nombre: "LA JORNADA", url: "https://www.jornada.com.mx/categoria/politica" },
    { nombre: "EL ECONOMISTA", url: "https://www.eleconomista.com.mx/politica" },
    { nombre: "EXPANSIÓN POLÍTICA", url: "https://politica.expansion.mx/" }
  ];

  console.log("Iniciando raspado con Jina Reader para Chiapas...");
  const contenidosChiapas = [];
  for (const portal of portalesChiapas) {
    const contenido = await limpiarConJina(portal.url);
    contenidosChiapas.push({ nombre: portal.nombre, contenido });
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log("Iniciando raspado con Jina Reader para Nacionales...");
  const contenidosNacionales = [];
  for (const portal of portalesNacionales) {
    let contenido = "";
    if (portal.nombre === "ARISTEGUI NOTICIAS") {
      contenido = await rasparDosNotasAristegui(portal.url);
    } else {
      contenido = await limpiarConJina(portal.url);
    }
    contenidosNacionales.push({ nombre: portal.nombre, contenido });
    await new Promise(resolve => setTimeout(resolve, 500));
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
// OPCIÓN 2: GUIÓN ÍNTEGRO
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
3. REGLA DE CONTENIDO ÍNTEGRO: Está estrictamente prohibido entregar notas mochadas o con texto insuficiente. Rescata párrafos informativos reales y desarrollados.
4. LÍMITE DE PALABRAS: Cada nota extraída debe tener un **máximo de 500 palabras**.
5. OMISIONES: Descartar de inmediato y de forma absoluta cualquier mención a Eduardo Ramírez, el apodo o siglas "ERA", o al Gobierno de Chiapas.

FORMATO OBLIGATORIO:
[Nombre del Portal] | ${fechaHoy}
[TÍTULO DE LA NOTA EN MAYÚSCULAS]
[Texto íntegro original de la noticia, máx. 500 palabras]

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
          content: 'Eres un extractor estricto de contenidos de prensa. Tu labor es rescatar exactamente 2 notas con su texto íntegro y párrafos completos (máximo 500 palabras por nota).' 
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
1. FILTRADO TOTAL: Oculta y elimina por completo cualquier mención a notas vacías o sin contenido.
2. FORMATO DE MONITOREO: Presenta el nombre del medio, la fecha, y enlistados limpios de notas.
3. OMISIONES: Excluye de manera absoluta cualquier nota o mención sobre Eduardo Ramírez, su apodo o siglas "ERA", o al Gobierno de Chiapas.

CONTENIDO DE CHIAPAS:
${seccionChiapas}

CONTENIDO NACIONAL:
${seccionNacionales}`;

    const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';
    const response = await axios.post(apiUrl, {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'Eres un analista de medios enfocado en la síntesis y monitoreo de prensa radial.' },
        { role: 'user', content: promptSintesis }
      ],
      temperature: 0.1,
      max_tokens: 8000
    }, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 120000 });

    res.json({ exito: true, guion: response.data.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ exito: false, error: 'Error al generar síntesis de prensa.', detalle: error.message });
  }
});

// =========================================================
// OPCIÓN 4: SÍNTESIS CON ENLACES DIRECTOS A CACADA NOTA (MEJORADO)
// =========================================================
app.post('/api/sintesis-con-enlaces', async (req, res) => {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return res.status(500).json({ exito: false, error: 'API Key no configurada.' });

    const { seccionChiapas, seccionNacionales } = await obtenerContenidoPortales();

    const promptOpcion4 = `Actúa como analista y extractor de enlaces de noticias. A partir de los textos de los portales proporcionados abajo, extrae las notas más importantes.

REGLAS ESTRICTAS DE FORMATO (Obligatorio seguir este orden exacto para cada nota):
PORTAL: [Nombre exacto del portal]
TÍTULO: [Título claro de la noticia]
ENLACE: [Busca la URL de la nota. Si el enlace en el texto es relativo o incompleto, CONSTRÚYELO agregando el dominio principal del portal para que sea una URL absoluta y funcional que abra la nota exacta. NUNCA pongas solo la página principal ni dejes el enlace vacío]
EXTRACTO: [Resumen breve de 1 o 2 líneas]

REQUISITOS:
1. Excluye de manera absoluta cualquier nota relacionada con Eduardo Ramírez, su apodo o siglas "ERA", o al Gobierno de Chiapas.
2. Máximo de 3 a 4 notas destacadas por portal.

CONTENIDO DE PORTALES DE CHIAPAS:
${seccionChiapas}

CONTENIDO DE PORTALES NACIONALES:
${seccionNacionales}`;

    const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';
    const response = await axios.post(apiUrl, {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'Eres un sistema estricto de extracción de datos que devuelve la información estructurada por campos (PORTAL, TÍTULO, ENLACE, EXTRACTO) obligando a reconstruir las URLs absolutas completas de cada nota.' },
        { role: 'user', content: promptOpcion4 }
      ],
      temperature: 0.1,
      max_tokens: 8000
    }, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 120000 });

    let textoRespuesta = response.data.choices[0].message.content;

    res.json({ 
      exito: true, 
      guion: textoRespuesta 
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: 'Error al generar síntesis con enlaces.', detalle: error.message });
  }
});

// =========================================================
// OPCIÓN 5: BLOQUE URL ÚNICA (PROCESAMIENTO INDIVIDUAL)
// =========================================================
app.post('/api/procesar-bloque', async (req, res) => {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return res.status(500).json({ exito: false, error: 'API Key no configurada.' });

    const { url, nombrePortal } = req.body;
    const contenidoPortal = await limpiarConJina(url || "https://aristeguinoticias.com/");
    const nombre = nombrePortal || "ARISTEGUI NOTICIAS";

    const promptBloque = `Analiza el contenido del siguiente portal (${nombre}) y genera un resumen estructurado para radio.
Contenido:
${contenidoPortal}`;

    const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';
    const response = await axios.post(apiUrl, {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'Eres un redactor analítico de noticias.' },
        { role: 'user', content: promptBloque }
      ],
      temperature: 0.2,
      max_tokens: 4000
    }, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 60000 });

    res.json({ exito: true, guion: response.data.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ exito: false, error: 'Error al procesar el bloque.', detalle: error.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});
