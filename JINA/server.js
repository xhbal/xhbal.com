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

// Función para extraer contenido usando Jina Reader con la API Key configurada
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
    return texto.substring(0, 3000); // Límite de caracteres por portal
  } catch (error) {
    console.log(`⚠️ Error/Timeout al consultar ${url}:`, error.message);
    return "Sin información disponible";
  }
}

// Health Check para Render
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Endpoint principal para la generación del guión
app.post('/api/generar-noticiero', async (req, res) => {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        exito: false,
        error: 'La clave de API de DeepSeek no está configurada.'
      });
    }

    const { hoy, fechaHoy, fechaAyer } = getFechasFiltro();
    const fechaEmision = getFechaFormateada();

    // PORTALES CHIAPAS
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

    // PORTALES NACIONALES
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
      console.log(`Consultando ${portal.nombre}...`);
      const contenido = await limpiarConJina(portal.url);
      contenidosChiapas.push({ nombre: portal.nombre, contenido });
    }

    console.log("Iniciando raspado con Jina Reader para Nacionales...");
    const contenidosNacionales = [];
    for (const portal of portalesNacionales) {
      console.log(`Consultando ${portal.nombre}...`);
      const contenido = await limpiarConJina(portal.url);
      contenidosNacionales.push({ nombre: portal.nombre, contenido });
    }

    const seccionChiapas = contenidosChiapas
      .map(p => `${p.nombre}:\n${p.contenido}`)
      .join("\n\n");

    const seccionNacionales = contenidosNacionales
      .map(p => `${p.nombre}:\n${p.contenido}`)
      .join("\n\n");

    const seccionLocal = "Sin notas locales disponibles en este momento.";

    const prompt = `Hoy es ${hoy}. Fecha exacta: ${fechaHoy}.
Rango de fechas aceptable: ${fechaAyer} a ${fechaHoy}.

REGLAS:
1. Jamás omitas la información que responda a las preguntas básicas del periodismo: qué, quién, cuándo, cómo, dónde, por qué y para qué.
2. NUNCA inventes noticias.
3. Solo usa noticias publicadas entre ${fechaAyer} y ${fechaHoy}. Si una nota es más antigua DESCÁRTALA y escribe "Sin información disponible".
4. NUNCA repitas el mismo tema aunque venga de portales distintos.
5. Formato simple y directo — sin textos de locutor, sin cortinillas, sin introducciones.
6. SIEMPRE incluye la hora de publicación — si no aparece escribe "hora no disponible".
7. PROHIBIDO escribir cualquier texto antes de la palabra EFEMÉRIDE — empieza directamente con "EFEMÉRIDE:" sin ningún análisis previo.
8. NO repitas el encabezado — solo genera el contenido de los bloques.
9. SOLO usa los portales de las listas proporcionadas — PROHIBIDO usar cualquier otro portal no listado.
10. Si hay información de EDUARDO RAMÍREZ, OMITIRLA por completo.
11. No omitir datos importantes de la nota como nombre, lugar y hecho.
12. Queda strictly prohibido iniciar el cuerpo de la nota o utilizar frases dentro del texto como: 'De acuerdo con información publicada por...', 'El medio [Nombre] reporta que...', o 'Según lo publicado en...'.

════════════════════════════════════════
BLOQUE 1 — EFEMÉRIDE MUSICAL
════════════════════════════════════════ 
Busca UN músico mexicano que haya nacido o fallecido el ${hoy}.
Si no hay mexicanos busca de cualquier parte del mundo.
Máximo 150 palabras. Incluye canción más popular.

INSTRUCCIONES:
- Al redactar una efeméride, queda estrictamente prohibido asumir por defecto que la fecha corresponde a un 'Natalicio' o 'Fallecimiento'. Debes verificar la naturaleza exacta del suceso histórico.

Si el evento del día NO es un nacimiento ni una muerte, especifica claramente utilizando: DEBUT, LANZAMIENTO, ANIVERSARIO DE BANDA o HITO HISTÓRICO.

Formato exacto:
EFEMÉRIDE: [nombre del artista] — [efeméride]
[texto de máximo 150 palabras]
PROPUESTA MUSICAL: [canción]

════════════════════════════════════════
BLOQUE 2 — NOTICIAS LOCALES (San Cristóbal y zona Altos)
════════════════════════════════════════
${seccionLocal}

Formato de cada nota:
Fuente: Redes Sociales | hora no disponible
[TÍTULO EN MAYÚSCULAS]
[Resumen 100 palabras, estilo periodístico]

════════════════════════════════════════
BLOQUE 3 — NOTICIAS CHIAPAS (5 a 10 notas)
════════════════════════════════════════
Aquí está el contenido actual de los portales de Chiapas:

${seccionChiapas}

INSTRUCCIONES:
- Jamás omitas la información que responda a las preguntas básicas: qué, quién, cuándo, cómo, dónde, por qué y para qué.
- USA ÚNICAMENTE los portales entregados en la lista.
- ESTRICTAMENTE UNA nota por portal.
- Prioriza: San Cristóbal, Chamula, Tenejapa, Chenalhó, Zinacantán, Pantelhó, Huixtán, Oxchuc.
- Si no hay de los municipios anteriores poner de: Tuxtla, Tapachula y Comitán.
- Máximo 10 notas en total.

Formato de cada nota:
[Fuente] | [Autor o Mesa de Redacción] | [Fecha] | [Hora de publicación]
[TÍTULO EN MAYÚSCULAS]
[Resumen 100 palabras, tercera persona, estilo periodístico]

════════════════════════════════════════
BLOQUE 4 — NOTICIAS NACIONALES (10 notas)
════════════════════════════════════════
Aquí está el contenido actual de los portales nacionales:

${seccionNacionales}

INSTRUCCIONES:
- USA ÚNICAMENTE los portales entregados en la lista.
- ESTRICTAMENTE UNA nota por portal.
- NUNCA dos notas sobre el mismo tema.
- Cada nota: máximo 100 palabras en una sola línea.

Formato de cada nota:
[Fuente] | [Autor o Mesa de Redacción] | [Fecha] | [Hora de publicación]
[TÍTULO EN MAYÚSCULAS]
[Resumen 100 palabras, tercera persona, estilo periodístico]`;

    const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';

    console.log("Enviando petición a DeepSeek...");
    const response = await axios.post(
      apiUrl,
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'Eres un editor y redactor de noticias para radio comercial. Tu trabajo es procesar el material entregado y redactar las notas periodísticas directamente para transmisión.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 8000
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );

    const guionGenerado = response.data.choices[0].message.content;
    const encabezado = `NOTICIAS CHIAPAS .- ES LO QUE HAY\nGenerado el: ${fechaEmision}\n==========================================\n\n`;
    const contenidoFinal = encabezado + guionGenerado;

    res.json({
      exito: true,
      guion: contenidoFinal
    });

  } catch (error) {
    const detalleError = error?.response?.data || error.message;
    console.error('Error al generar el guión:', detalleError);

    res.status(500).json({
      exito: false,
      error: 'Error al procesar el guión de noticias.',
      detalle: typeof detalleError === 'object' ? JSON.stringify(detalleError) : detalleError
    });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor de Guiones activo en el puerto ${port}`);
});
