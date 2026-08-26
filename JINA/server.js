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

    // =========================================================
    // FILTRO ANTIBASURA / ANTI-PUBLICIDAD MEJORADO
    // =========================================================
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

// Función automatizada para extraer múltiples notas limpias desde la portada de Aristegui
async function rasparDosNotasAristegui(urlPortada) {
  try {
    console.log("🔍 Analizando portada de Aristegui Noticias...");
    const htmlPortada = await limpiarConJina(urlPortada);
    
    // Expresión regular para encontrar todas las URLs de notas internas de Aristegui (formato /YYMM/seccion/slug/)
    const regexUrls = /https:\/\/aristeguinoticias.com\/\d{4}\/[a-z]+\/[^\/\s)]+\//g;
    const matches = htmlPortada.match(regexUrls);

    if (!matches || matches.length === 0) {
      console.log("⚠️ No se encontraron enlaces de notas en la portada de Aristegui.");
      return "Sin información de Aristegui Noticias";
    }

    // Filtramos URLs únicas para no repetir
    const urlsUnicas = [...new Set(matches)];
    
    // Tomamos máximo las primeras 2 URLs distintas
    const urlsAExtraer = urlsUnicas.slice(0, 2);
    console.log(`🎯 Enlaces principales detectados en Aristegui:`, urlsAExtraer);

    let contenidoDosNotas = "";

    for (let i = 0; i < urlsAExtraer.length; i++) {
      const urlNota = urlsAExtraer[i];
      console.log(`📥 Extrayendo nota ${i + 1} de Aristegui: ${urlNota}`);
      
      const textoNota = await limpiarConJina(urlNota);
      contenidoDosNotas += `\n--- NOTA ARISTEGUI ${i + 1} (${urlNota}) ---\n${textoNota}\n`;
      
      // Pequeña pausa de cortesía entre peticiones
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
    { nombre: "LA VOZ DEL SURESTE", url: "https://diariolavozdelsureste.com/category/chiapas/" }
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

    // En lugar de mezclar todo, traemos los portales individualmente o estructurados con su URL base clara
    const portalesChiapas = [
      { nombre: "EL HERALDO DE CHIAPAS", url: "https://www.elheraldodechiapas.com.mx/local/" },
      { nombre: "ALERTA CHIAPAS", url: "https://alertachiapas.com/category/chiapas/" },
      { nombre: "CHIAPAS PARALELO", url: "https://www.chiapasparalelo.com" },
      { nombre: "CHIAPAS EN CONTACTO", url: "https://chiapasencontacto.com" },
      { nombre: "ASICH", url: "https://www.asich.com/portada" },
      { nombre: "LA VOZ DEL SURESTE", url: "https://diariolavozdelsureste.com/category/chiapas/" }
    ];

    const portalesNacionales = [
      { nombre: "ARISTEGUI NOTICIAS", url: "https://aristeguinoticias.com/" },
      { nombre: "ANIMAL POLÍTICO", url: "https://animalpolitico.com" },
      { nombre: "PROCESO", url: "https://www.proceso.com.mx/nacional/" },
      { nombre: "LA JORNADA", url: "https://www.jornada.com.mx/categoria/politica" },
      { nombre: "EL ECONOMISTA", url: "https://www.eleconomista.com.mx/politica" },
      { nombre: "EXPANSIÓN POLÍTICA", url: "https://politica.expansion.mx/" }
    ];

    // Recolectamos el contenido de cada portal mapeando su URL oficial fija
    let datosConsolidados = "";
    
    for (const portal of portalesChiapas) {
      const contenido = await limpiarConJina(portal.url);
      datosConsolidados += `\n=== INICIO PORTAL: ${portal.nombre} ===\nURL_OFICIAL: ${portal.url}\n${contenido}\n=== FIN PORTAL ===\n`;
    }

    for (const portal of portalesNacionales) {
      let contenido = "";
      if (portal.nombre === "ARISTEGUI NOTICIAS") {
        contenido = await rasparDosNotasAristegui(portal.url);
      } else {
        contenido = await limpiarConJina(portal.url);
      }
      datosConsolidados += `\n=== INICIO PORTAL: ${portal.nombre} ===\nURL_OFICIAL: ${portal.url}\n${contenido}\n=== FIN PORTAL ===\n`;
    }

    const promptOpcion4 = `Actúa como analista de noticias. A partir de los bloques de portales proporcionados abajo, extrae las notas más importantes de cada uno.

REGLAS ESTRICTAS DE FORMATO (Debes seguir este orden exacto para cada nota dentro de su respectivo portal):
PORTAL: [Nombre exacto del Portal]
TÍTULO: [Título claro de la noticia]
ENLACE: [Copia exactamente la URL_OFICIAL indicada en el bloque del portal]
EXTRACTO: [Resumen breve de 1 o 2 líneas]

REQUISITOS:
1. Excluye de manera absoluta cualquier nota relacionada con Eduardo Ramírez, su apodo o siglas "ERA", o al Gobierno de Chiapas.
2. Extrae de 2 a 3 notas destacadas por cada bloque de portal.

CONTENIDO DE LOS PORTALES:
${datosConsolidados}`;

    const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';
    const response = await axios.post(apiUrl, {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'Eres un sistema estricto de extracción de datos que devuelve la información estructurada por campos (PORTAL, TÍTULO, ENLACE, EXTRACTO) respetando estrictamente los nombres y URLs oficiales proporcionados.' },
        { role: 'user', content: promptOpcion4 }
      ],
      temperature: 0.1,
      max_tokens: 8000
    }, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 120000 });

    let textoRespuesta = response.data.choices[0].message.content;

    // Filtro de seguridad post-procesamiento: forzamos que si el nombre del portal coincide, su enlace sea indiscutiblemente el correcto
    let bloques = textoRespuesta.split(/PORTAL:/i);
    let textoProcesado = bloques.map((bloque, index) => {
      if (index === 0) return bloque;

      let lineas = bloque.split('\n');
      let nombrePortal = lineas[0].trim().toUpperCase();

      for (let i = 0; i < lineas.length; i++) {
        if (lineas[i].startsWith('ENLACE:')) {
          if (nombrePortal.includes('ARISTEGUI')) {
            lineas[i] = 'ENLACE: https://aristeguinoticias.com/';
          } else if (nombrePortal.includes('EL HERALDO')) {
            lineas[i] = 'ENLACE: https://www.elheraldodechiapas.com.mx/';
          } else if (nombrePortal.includes('ALERTA CHIAPAS')) {
            lineas[i] = 'ENLACE: https://alertachiapas.com/';
          } else if (nombrePortal.includes('CUARTOPODER')) {
            lineas[i] = 'ENLACE: https://www.cuartopoder.mx/';
          } else if (nombrePortal.includes('CHIAPAS PARALELO')) {
            lineas[i] = 'ENLACE: https://www.chiapasparalelo.com';
          } else if (nombrePortal.includes('CHIAPAS EN CONTACTO')) {
            lineas[i] = 'ENLACE: https://chiapasencontacto.com';
          } else if (nombrePortal.includes('ASICH')) {
            lineas[i] = 'ENLACE: https://www.asich.com/';
          } else if (nombrePortal.includes('LA VOZ DEL SURESTE')) {
            lineas[i] = 'ENLACE: https://diariolavozdelsureste.com/';
          } else if (nombrePortal.includes('ANIMAL POLÍTICO')) {
            lineas[i] = 'ENLACE: https://www.animalpolitico.com/';
          } else if (nombrePortal.includes('PROCESO')) {
            lineas[i] = 'ENLACE: https://www.proceso.com.mx/';
          } else if (nombrePortal.includes('LA JORNADA')) {
            lineas[i] = 'ENLACE: https://www.jornada.com.mx/';
          } else if (nombrePortal.includes('EL ECONOMISTA')) {
            lineas[i] = 'ENLace: https://www.eleconomista.com.mx/';
          } else if (nombrePortal.includes('EXPANSIÓN')) {
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
// OPCIÓN 5: GUIÓN POR BLOQUES
// =========================================================
app.post('/api/procesar-bloque', async (req, res) => {
  try {
    const { url, nombrePortal } = req.body;
    if (!url || !nombrePortal) {
      return res.status(400).json({ exito: false, error: 'Faltan la URL o el nombre del portal.' });
    }

    const { fechaHoy } = getFechasFiltro();
    let contenidoPortal = "";
    
    if (nombrePortal.toUpperCase().includes("ARISTEGUI")) {
      contenidoPortal = await rasparDosNotasAristegui(url);
    } else {
      contenidoPortal = await limpiarConJina(url);
    }

    const contenidoFinal = `${nombrePortal.toUpperCase()} | ${fechaHoy}\n\n${contenidoPortal}`;

    res.json({ 
      exito: true, 
      guion: contenidoFinal 
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: 'Error al procesar el bloque.', detalle: error.message });
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
