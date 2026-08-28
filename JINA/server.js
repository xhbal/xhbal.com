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
    { nombre: "CUARTO PODER", url: "https://cuartopoder.mx" },
    { nombre: "EL HERALDO DE CHIAPAS", url: "https://elheraldodechiapas.com.mx" },
    { nombre: "DIARIO DE CHIAPAS", url: "https://diariodechiapas.com" },
    { nombre: "ALERTA CHIAPAS", url: "https://alertachiapas.com" },
    { nombre: "CHIAPAS PARALELO", url: "https://chiapasparalelo.com" },
    { nombre: "CHIAPAS EN CONTACTO", url: "https://chiapasencontacto.com" },
    { nombre: "DIARIO ULTIMATUM", url: "https://ultimatumchiapas.com.mx" },
    { nombre: "EL ORBE", url: "https://elorbe.com" },
    { nombre: "ASICH", url: "https://www.asich.com/portada" },
    { nombre: "LA VOZ DEL SURESTE", url: "https://diariolavozdelsureste.com/category/chiapas/" }
  ];

  const portalesNacionales = [
    { nombre: "ARISTEGUI NOTICIAS", url: "https://aristeguinoticias.com/" },
    { nombre: "MILENIO", url: "https://milenio.com" },
    { nombre: "EL UNIVERSAL", url: "https://eluniversal.com.mx" },
    { nombre: "INFOBAE MÉXICO", url: "https://infobae.com/mexico" },
    { nombre: "PROCESO", url: "https://proceso.com.mx" },
    { nombre: "ANIMAL POLÍTICO", url: "https://animalpolitico.com" },
    { nombre: "LA JORNADA", url: "https://www.jornada.com.mx" },
    { nombre: "MVS NOTICIAS", url: "https://mvsnoticias.com" },
    { nombre: "REPORTE ÍNDIGO", url: "https://reporteindigo.com" },
    { nombre: "EXCÉLSIOR", url: "https://www.excelsior.com.mx" },
    { nombre: "EL NORTE", url: "https://www.elnorte.com" },
    { nombre: "EL FINANCIERO", url: "https://www.elfinanciero.com.mx" },
    { nombre: "EL ECONOMISTA", url: "https://www.eleconomista.com.mx" },
    { nombre: "CODIGO MAGENTA", url: "https://codigomagenta.com.mx" },
    { nombre: "HERALDO DE MÉXICO", url: "https://heraldodemexico.com.mx/noticias/" }
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
// OPCIÓN 4: SÍNTESIS CON ENLACES DIRECTOS A CADA NOTA
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
// GUIÓN EXPRESS (BARRIDO INTELIGENTE DE LOS 25 PORTALES)
// =========================================================
app.post('/api/procesar-bloque', async (req, res) => {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return res.status(500).json({ exito: false, error: 'API Key no configurada.' });

    console.log("🚀 [Guión Express] Iniciando barrido estricto de los 25 portales...");

    const todosLosPortales = [
      // Chiapas (10)
      { nombre: "CUARTO PODER", url: "https://cuartopoder.mx" },
      { nombre: "EL HERALDO DE CHIAPAS", url: "https://elheraldodechiapas.com.mx" },
      { nombre: "DIARIO DE CHIAPAS", url: "https://diariodechiapas.com" },
      { nombre: "ALERTA CHIAPAS", url: "https://alertachiapas.com" },
      { nombre: "CHIAPAS PARALELO", url: "https://chiapasparalelo.com" },
      { nombre: "CHIAPAS EN CONTACTO", url: "https://chiapasencontacto.com" },
      { nombre: "DIARIO ULTIMATUM", url: "https://ultimatumchiapas.com.mx" },
      { nombre: "EL ORBE", url: "https://elorbe.com" },
      { nombre: "ASICH", url: "https://www.asich.com/portada" },
      { nombre: "LA VOZ DEL SURESTE", url: "https://diariolavozdelsureste.com/category/chiapas/" },
      // Nacionales (15)
      { nombre: "ARISTEGUI NOTICIAS", url: "https://aristeguinoticias.com/" },
      { nombre: "MILENIO", url: "https://milenio.com" },
      { nombre: "EL UNIVERSAL", url: "https://eluniversal.com.mx" },
      { nombre: "INFOBAE MÉXICO", url: "https://infobae.com/mexico" },
      { nombre: "PROCESO", url: "https://proceso.com.mx" },
      { nombre: "ANIMAL POLÍTICO", url: "https://animalpolitico.com" },
      { nombre: "LA JORNADA", url: "https://www.jornada.com.mx" },
      { nombre: "MVS NOTICIAS", url: "https://mvsnoticias.com" },
      { nombre: "REPORTE ÍNDIGO", url: "https://reporteindigo.com" },
      { nombre: "EXCÉLSIOR", url: "https://www.excelsior.com.mx" },
      { nombre: "EL NORTE", url: "https://elnorte.com" },
      { nombre: "EL FINANCIERO", url: "https://www.elfinanciero.com.mx" },
      { nombre: "EL ECONOMISTA", url: "https://eleconomista.com.mx" },
      { nombre: "CODIGO MAGENTA", url: "https://codigomagenta.com.mx" },
      { nombre: "HERALDO DE MÉXICO", url: "https://heraldodemexico.com.mx/noticias/" }
    ];

    const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';
    let notasProcesadas = [];

    // Bucle estricto por cada uno de los 25 portales
    for (let i = 0; i < todosLosPortales.length; i++) {
      const portal = todosLosPortales[i];
      console.log(`🔍 [${i + 1}/25] Procesando portal: ${portal.nombre}`);

      try {
        const contenidoPortada = await limpiarConJina(portal.url);
        if (!contenidoPortada || contenidoPortada.length < 150) continue;

        const promptSeleccion = `Estás analizando la portada del medio "${portal.nombre}". 
Selecciona UNA SOLA NOTA que sea la más importante de este portal y extrae su URL absoluta.
Responde estrictamente con el formato:
URL_SELECCIONADA: [URL de la nota]

CONTENIDO DE LA PORTADA:
${contenidoPortada}`;

        const respSel = await axios.post(apiUrl, {
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: 'Eres un editor web extrayendo URLs.' },
            { role: 'user', content: promptSeleccion }
          ],
          temperature: 0.1,
          max_tokens: 200
        }, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 25000 });

        const matchUrl = respSel.data.choices[0].message.content.match(/URL_SELECCIONADA:\s*(https?:\/\/[^\s]+)/i);

        if (matchUrl && matchUrl[1]) {
          const urlNota = matchUrl[1].trim();
          const textoNota = await limpiarConJina(urlNota);

          if (textoNota && textoNota.length > 200) {
            notasProcesadas.push({
              portal: portal.nombre,
              url: urlNota,
              contenido: textoNota
            });
            console.log(`✅ Nota íntegra obtenida de ${portal.nombre}`);
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (errPortal) {
        console.log(`⚠️ Error en portal ${portal.nombre}:`, errPortal.message);
      }
    }

    console.log(`📊 Total de notas íntegras recolectadas: ${notasProcesadas.length} de 25.`);

    if (notasProcesadas.length === 0) {
      return res.status(500).json({ exito: false, error: 'No se pudieron extraer notas en el barrido.' });
    }

    const corpusGeneral = notasProcesadas.map(n => 
      `MEDIO: ${n.portal}\nENLACE: ${n.url}\nTEXTO COMPLETO:\n${n.contenido}\n----------------------------------------`
    ).join("\n\n");

    const promptFinal = `A continuación se presenta un compendio de notas íntegras extraídas de ${notasProcesadas.length} portales diferentes de Chiapas y nacionales.

REGLAS ESTRICTAS DE DIRECCIÓN DE NOTICIAS:
1. CERO DUPLICADOS Y CERO TEMAS REPETIDOS: Haz un filtro implacable. Si dos o más portales abordan el mismo hecho, detención, conferencia, personaje o temática (por ejemplo, casos judiciales específicos, iniciativas presidenciales o reuniones bilaterales repetidas), ELIMINA TODAS LAS COPIAS Y QUÉDATE CON UNA SOLA EN UN SOLO MEDIO. Los demás portales afectados deben mostrar una noticia completamente distinta. Variedad temática absoluta.
2. EXTENSIÓN Y PROFUNDIDAD ADECUADA: No recortes las notas a una sola línea. Cada nota seleccionada debe tener una síntesis desarrollada, clara y robusta (de 3 a 5 oraciones con los datos duros más importantes).
3. Oculta y omite de forma absoluta cualquier mención a Eduardo Ramírez, su apodo o siglas "ERA", o al Gobierno de Chiapas.
4. FORMATO ESTRICTO DE SALIDA: Presenta UNICAMENTE la lista de medios con el formato indicado abajo. ESTÁ PROHIBIDO agregar "Síntesis General", conclusiones, introducciones, notas finales o despedidas al final del texto.

FORMATO POR CADA MEDIO:
[NOMBRE DEL MEDIO]
- [Título de la nota]
  [Síntesis amplia y desarrollada de la nota]
- Enlace: [URL]

NOTAS DE LOS PORTALES:
${corpusGeneral}`;

    const respFinal = await axios.post(apiUrl, {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'Eres un analista de medios y director de noticias radiofónicas estricto con la variedad temática y la profundidad de los textos.' },
        { role: 'user', content: promptFinal }
      ],
      temperature: 0.2,
      max_tokens: 8000
    }, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 120000 });

    res.json({ 
      exito: true, 
      guion: respFinal.data.choices[0].message.content,
      totalPortales: notasProcesadas.length 
    });

  } catch (error) {
    console.log("❌ Error en Guión Express:", error.message);
    res.status(500).json({ exito: false, error: 'Error al procesar el barrido.', detalle: error.message });
  }
});
