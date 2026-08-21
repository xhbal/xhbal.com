import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const JINA_API_KEY = process.env.JINA_API_KEY || '';
const PORT = process.env.PORT || 3000;

if (!GEMINI_API_KEY) {
  console.error('❌ Error: Falta la variable GEMINI_API_KEY en el archivo .env');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const app = express();

// Middlewares para la API Web
app.use(cors());
app.use(express.json());

/**
 * Plantilla del prompt estructurado para la reescritura editorial.
 */
function generarPromptEditorial(contenidoFuente, estiloEditorial, instruccionesExtra = '') {
  return `
Eres un editor periodístico sénior y redactor de un noticiero de radio formal. Tu trabajo es reescribir la siguiente noticia con un tono profesional, institucional, sobrio y rigurosamente periodístico.

--- CONTENIDO FUENTE ---
${contenidoFuente}
--- FIN CONTENIDO FUENTE ---

ESTILO EDITORIAL OBJETIVO: "${estiloEditorial}"

DIRECTRICES OBLIGATORIAS:
1. TONO PROFESIONAL Y SOBRIO: Elimina adjetivos dramáticos, frases novelescas o recursos literarios (como "Corría el año...", "en un acto cargado de expectativa", "bajo la cultura humilde"). Usa un lenguaje periodístico formal de agencia.
2. ESTRUCTURA DE PIRÁMIDE INVERTIDA: Responde en los dos primeros párrafos QUÉ ocurrió, QUINÉNES intervienen, DÓNDE se ubica la nota y POR QUÉ es relevante.
3. DATOS HISTÓRICOS Y CONTEXTO: Presenta los antecedentes e historia de la empresa en un párrafo de contexto breve, cronológico y objetivo, sin romantizar el proceso.
4. PRECISIÓN FACTUAL: Utiliza ÚNICAMENTE nombres, cargos, lugares, fechas y cifras presentes en la fuente. Prohibido inventar o alucinar datos.
5. LECTURA EN VOZ ALTA: Sintaxis clara y directa, apta para locución en un noticiero matutino serio.

${instruccionesExtra ? `INSTRUCCIONES ADICIONALES:\n${instruccionesExtra}\n` : ''}

FORMATO DE SALIDA (Markdown):
# [Título informativo, directo y profesional]
**[Bajada / Subtítulo con los datos principales de la noticia]**

*Ubicación / Fecha*

[Cuerpo de la nota estructurado en párrafos sobrios, directos y con enfoque informativo]

---
*Noticiero XHBAL | Estilo: ${estiloEditorial}*
`;
}

/**
 * Petición a Jina Reader (r.jina.ai) para parsear el enlace a Markdown limpio.
 */
async function extraerConJina(url) {
  const endpoint = `https://r.jina.ai/${url}`;
  const headers = {
    'Accept': 'text/plain',
    'X-With-Generated-Alt': 'true'
  };

  if (JINA_API_KEY) {
    headers['Authorization'] = `Bearer ${JINA_API_KEY}`;
  }

const fetch = require('node-fetch'); // O axios según tengas configurado

async function obtenerTextoDeUrl(urlOriginal) {
  // Anteponemos el servicio de Jina Reader para bypass de seguridad y limpieza de HTML
  const jinaUrl = `https://r.jina.ai/${urlOriginal}`;

  const response = await fetch(jinaUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/plain, text/html'
    }
  });

  if (!response.ok) {
    throw new Error(`No se pudo extraer la noticia de la URL (Estado: ${response.status})`);
  }

  const textoMarkdown = await response.text();
  return textoMarkdown;
}
/**
 * Flujo principal: Extracción / Entrada + Reescritura con Gemini.
 */
export async function procesarNoticia({ type = 'url', content, estilo = 'Crónica Narrativa', instruccionesExtra = '', guardarArchivo = false }) {
  try {
    let contenidoMarkdown = content;

    if (type === 'url') {
      console.log(`\n[1/3] 📡 Extrayendo contenido desde Jina Reader...`);
      contenidoMarkdown = await extraerConJina(content);
      console.log(`✓ Extraídos ${contenidoMarkdown.length} caracteres.`);
    } else {
      console.log(`\n[1/3] 📝 Procesando texto provisto directamente (${content.length} caracteres)...`);
    }

    console.log(`\n[2/3] 🧠 Procesando reescritura con Gemini...`);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
    const prompt = generarPromptEditorial(contenidoMarkdown, estilo, instruccionesExtra);

    const result = await model.generateContent(prompt);
    const notaFinal = result.response.text();

    console.log(`\n[3/3] ✨ Proceso completado exitosamente.\n`);

    if (guardarArchivo) {
      try {
        const folder = './noticias_procesadas';
        await fs.mkdir(folder, { recursive: true });
        const filename = path.join(folder, `nota_${Date.now()}.md`);
        await fs.writeFile(filename, notaFinal, 'utf-8');
        console.log(`💾 Archivo guardado localmente en: ${filename}`);
      } catch (err) {
        console.warn('⚠️ No se pudo guardar el archivo localmente (normal en entornos serverless):', err.message);
      }
    }

    return notaFinal;

  } catch (error) {
    console.error('\n❌ Ocurrió un error durante el flujo:', error.message);
    throw error;
  }
}

// ---------------------------------------------------------
// RUTA HTTP PARA LA INTERFAZ WEB (www.xhbal.com/notas)
// ---------------------------------------------------------
app.post('/procesar', async (req, res) => {
  const { type, content, estilo, instruccionesExtra } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'No se proporcionó ningún contenido o URL.' });
  }

  try {
   const resultado = await procesarNoticia({
  type: type || 'url',
  content,
  estilo: estilo || 'Agencia / Pirámide Invertida',
  instruccionesExtra: instruccionesExtra || 'Tono sobrio, periodístico e institucional. Cero adjetivos dramáticos.',
  guardarArchivo: false
});

    res.json({ resultado });
  } catch (error) {
    res.status(500).json({ error: 'Ocurrió un error al procesar la nota.', detalles: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('Servidor de procesamiento de noticias XHBAL activo.');
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en el puerto ${PORT}`);
});

// ---------------------------------------------------------
// EJECUCIÓN OPCIONAL DESDE TERMINAL
// ---------------------------------------------------------
const urlCapturada = process.argv.slice(2).join(' ').trim();
if (urlCapturada) {
  console.log(`\n🔗 Modo consola activado. Procesando: ${urlCapturada}\n`);
  procesarNoticia({
    type: 'url',
    content: urlCapturada,
    estilo: 'Crónica Narrativa',
    instruccionesExtra: 'Párrafos breves adaptados para lectura ágil o locución de radio.',
    guardarArchivo: true
  });
}
