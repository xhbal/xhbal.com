import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const JINA_API_KEY = process.env.JINA_API_KEY || '';

if (!GEMINI_API_KEY) {
  console.error('❌ Error: Falta la variable GEMINI_API_KEY en el archivo .env');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * Plantilla del prompt estructurado para la reescritura editorial.
 */
function generarPromptEditorial(markdownOriginal, estiloEditorial, instruccionesExtra = '') {
  return `
Eres un editor periodístico sénior. Tu trabajo es reescribir la siguiente noticia extraída de la web, transformando su estilo y estructura sin comprometer la precisión de los hechos.

--- CONTENIDO FUENTE (VÍA JINA) ---
${markdownOriginal}
--- FIN CONTENIDO FUENTE ---

ESTILO EDITORIAL OBJETIVO: "${estiloEditorial}"

DIRECTRICES RIGUROSAS:
1. PRECISION FACTUAL: Utiliza ÚNICAMENTE nombres, lugares, fechas, cifras y datos presentes en la fuente. Prohibido alucinar o agregar datos no documentados.
2. DEPURACIÓN: Omite anuncios, menús de navegación, enlaces a otras notas o elementos de pie de página devueltos por la extracción.
3. ADAPTACIÓN DE ESTILO:
   - Si es "Crónica Narrativa": Prioriza la tensión dramática, la secuencia temporal, la experiencia humana y los detalles ambientales del rescate.
   - Si es "Agencia / Pirámide Invertida": Responde qué, quién, cuándo, dónde y por qué en los primeros dos párrafos. Tono directo, sobrio y conciso.
   - Si es "Análisis / Institucional": Enfatiza los protocolos de emergencia, el papel de las autoridades de rescate y las condiciones meteorológicas/marítimas.

${instruccionesExtra ? `INSTRUCCIONES ADICIONALES DEL EDITOR:\n${instruccionesExtra}\n` : ''}

FORMATO DE SALIDA (Aplica formato Markdown):
# [Título renovado e impactante]
**[Bajada / Subtítulo explicativo]**

*Ubicación / Fecha*

[Cuerpo de la nota reescrito en párrafos estructurados y fluidos]

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
 * Flujo principal: Extracción + Reescritura + Almacenamiento local.
 */
export async function procesarNoticia({ url, estilo, instruccionesExtra = '', guardarArchivo = true }) {
  try {
    console.log(`\n[1/3] 📡 Extrayendo contenido desde Jina Reader...`);
    const contenidoMarkdown = await extraerConJina(url);
    console.log(`✓ Extraídos ${contenidoMarkdown.length} caracteres.`);

    console.log(`\n[2/3] 🧠 Procesando reescritura con Gemini 2.5 Flash...`);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
    const prompt = generarPromptEditorial(contenidoMarkdown, estilo, instruccionesExtra);

    const result = await model.generateContent(prompt);
    const notaFinal = result.response.text();

    console.log(`\n[3/3] ✨ Proceso completado exitosamente.\n`);
    console.log('=' .repeat(60));
    console.log(notaFinal);
    console.log('=' .repeat(60));

    if (guardarArchivo) {
      const folder = './noticias_procesadas';
      await fs.mkdir(folder, { recursive: true });
      const filename = path.join(folder, `nota_${Date.now()}.md`);
      await fs.writeFile(filename, notaFinal, 'utf-8');
      console.log(`\n💾 Archivo guardado localmente en: ${filename}`);
    }

    return notaFinal;

  } catch (error) {
    console.error('\n❌ Ocurrió un error durante el flujo:', error.message);
    throw error;
  }
}

// ---------------------------------------------------------
// EJECUCIÓN CON CAPTURA DINÁMICA DE URL
// ---------------------------------------------------------
// Toma la URL capturada en la terminal (soporta comillas y espacios)
const urlCapturada = process.argv.slice(2).join(' ').trim();

// URL de respaldo solo si NO escribes nada en la terminal
const urlPorDefecto = 'https://www.elheraldodechiapas.com.mx/local/dramatico-rescate-en-chiapas-hallan-a-pescadores-flotando-en-una-hielera-1234567.html';

const urlAProcesar = urlCapturada || urlPorDefecto;

console.log(`\n🔗 URL a procesar: ${urlAProcesar}\n`);

procesarNoticia({
  url: urlAProcesar,
  estilo: 'Crónica Narrativa',
  instruccionesExtra: 'Párrafos breves adaptados para lectura ágil o locución de radio.',
  guardarArchivo: true
});