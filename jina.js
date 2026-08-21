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
Eres un editor periodístico sénior y locutor de radio. Tu trabajo es reescribir la siguiente noticia, transformando su estilo y estructura sin comprometer la precisión de los hechos para que quede lista para locución al aire.

--- CONTENIDO FUENTE ---
${contenidoFuente}
--- FIN CONTENIDO FUENTE ---

ESTILO EDITORIAL OBJETIVO: "${estiloEditorial}"

DIRECTRICES RIGUROSAS:
1. PRECISIÓN FACTUAL: Utiliza ÚNICAMENTE nombres, lugares, fechas, cifras y datos presentes en la fuente. Prohibido alucinar o agregar datos no documentados.
2. DEPURACIÓN: Omite anuncios, menús de navegación, enlaces a otras notas o elementos de pie de página devueltos por la extracción.
3. ADAPTACIÓN DE ESTILO:
   - Si es "Crónica Narrativa": Prioriza la tensión dramática, la secuencia temporal, la experiencia humana y los detalles ambientales.
   - Si es "Agencia / Pirámide Invertida": Responde qué, quién, cuándo, dónde y por qué en los primeros dos párrafos. Tono directo, sobrio y conciso.
   - Si es "Análisis / Institucional": Enfatiza los protocolos de emergencia, el papel de las autoridades y las condiciones del entorno.

${instruccionesExtra ? `INSTRUCCIONES ADICIONALES DEL EDITOR:\n${instruccionesExtra}\n` : ''}

FORMATO DE SALIDA (Aplica formato Markdown):
# [Título renovado e impactante]
**[Bajada / Subtítulo explicativo]**

*Ubicación / Fecha*

[Cuerpo de la nota reescrito en párrafos estructurados y fluidos adaptados a lectura radial]

---
*Procesado automáticamente | Estilo: ${estiloEditorial}*
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

  const response = await fetch(endpoint, { headers });

  if (!response.ok) {
    throw new Error(`Error Jina Reader (${response.status}): ${response.statusText}`);
  }

  return await response.text();
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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
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
      estilo: estilo || 'Crónica Narrativa',
      instruccionesExtra: instruccionesExtra || 'Párrafos breves adaptados para lectura ágil o locución de radio.',
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
