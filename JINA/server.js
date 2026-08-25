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
    hour12: true
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
  });
  const fechaHoy = ahora.toISOString().split("T")[0];
  const fechaAyer = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().split("T")[0];

  return { hoy, fechaHoy, fechaAyer };
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
// OPCIÓN 1: GUIÓN EDITADO / SINTETIZADO (EL QUE YA TIENES)
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
        { role: 'system', content: 'Eres un editor de noticias para radio commercial.' },
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
// OPCIÓN 2: GUIÓN ORIGINAL (NOTAS COMPLETAS Y FILTRADAS)
// =========================================================
app.post('/api/generar-guion-original', async (req, res) => {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return res.status(500).json({ exito: false, error: 'API Key no configurada.' });

    const { hoy, fechaHoy, fechaAyer } = getFechasFiltro();
    const fechaEmision = getFechaFormateada();
    const { seccionChiapas, seccionNacionales } = await obtenerContenidoPortales();

    const promptOriginal = `Hoy es ${hoy}. Fecha exacta: ${fechaHoy}.

OBJETIVO:
Generar una selección periodística limpia de las noticias MÁS IMPORTANTES de hoy. 

REGLAS CRÍTICAS:
1. SELECCIÓN: Elige MÁXIMO 1 NOTICIA PRINCIPAL por cada portal. Omite portales que no tengan notas con texto completo disponible.
2. NO ESCRIBAS "Nota no disponible": Si no hay texto completo desarrollado para una noticia, SIMPLEMENTE OMÍTELO y pasa a la siguiente noticia válida.
3. REDACCIÓN INTEGRAL: Transcribe el cuerpo completo de la nota tal como viene en la fuente original. No la resumas.
4. LIMPIEZA: Elimina menús, publicidad, banners y frases de suscripción.
5. EXCLUSIONES: Omitir cualquier nota que mencione a EDUARDO RAMÍREZ.
6. FECHAS: Solo noticias publicadas entre ${fechaAyer} y ${fechaHoy}.

FORMATO OBLIGATORIO PARA CADA NOTA:
[Nombre del Portal] | [Fecha]
[TÍTULO EN MAYÚSCULAS]
[Cuerpo completo del texto de la noticia]

════════════════════════════════════════
BLOQUE 2 — NOTICIAS CHIAPAS (NOTAS INTEGRALES)
════════════════════════════════════════
${seccionChiapas}

════════════════════════════════════════
BLOQUE 3 — NOTICIAS NACIONALES (NOTAS INTEGRALES)
════════════════════════════════════════
${seccionNacionales}`;

    const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';
    const response = await axios.post(apiUrl, {
      model: 'deepseek-chat',
      messages: [
        { 
          role: 'system', 
          content: 'Eres un editor y curador de noticias de radio. Tu trabajo es filtrar únicamente las notas periodísticas que tengan cuerpo de texto completo, descartando enlaces vacíos o notas sin contenido, manteniendo su redacción original intacta.' 
        },
        { role: 'user', content: promptOriginal }
      ],
      temperature: 0.1,
      max_tokens: 8000
    }, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 120000 });

    res.json({ 
      exito: true, 
      guion: `GUION ORIGINAL (NOTAS COMPLETAS SIN EDITAR)\nGenerado el: ${fechaEmision}\n==========================================\n\n` + response.data.choices[0].message.content 
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: 'Error al generar guion original.', detalle: error.message });
  }
});
