require('dotenv').config();

const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Habilitar CORS para evitar bloqueos del navegador
app.use(cors());
app.use(express.json());

// Servir todos los archivos estáticos desde la raíz del proyecto
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
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);

  const format = (d) => d.toISOString().split('T')[0];
  return {
    fechaHoy: format(hoy),
    fechaAyer: format(ayer),
    hoyTexto: hoy.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })
  };
}

// Endpoint de prueba de salud para Render (Health Check)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Endpoint POST para la generación del guion
app.post('/api/generar-noticiero', async (req, res) => {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.error('Error: DEEPSEEK_API_KEY no está configurada en las variables de entorno.');
      return res.status(500).json({
        exito: false,
        error: 'La clave de API de DeepSeek no está configurada en el servidor.'
      });
    }

    const { seccionLocal, seccionChiapas, seccionNacionales } = req.body;
    const { fechaHoy, fechaAyer, hoyTexto } = getFechasFiltro();
    const fechaEmision = getFechaFormateada();

    const prompt = `Hoy es ${hoyTexto}. Fecha exacta: ${fechaHoy}.
Rango de fechas aceptable para noticias: ${fechaAyer} a ${fechaHoy}.

REGLAS GENERALES ESTRICTAS:
1. Responde preguntas básicas: qué, quién, cuándo, cómo, dónde, por qué y para qué.
2. NUNCA inventes noticias ni modifiques profesiones u oficios de personajes históricos.
3. Descarta cualquier noticia previa a ${fechaAyer}.
4. CLASIFICACIÓN GEOGRÁFICA ESTRICTA: La clasificación de la noticia depende de DÓNDE ocurren los hechos o del SUJETO principal, NO del medio que publica la nota.
   - Si un periódico de Chiapas reporta un logro deportivo internacional o un asunto nacional, DEBE ir en PANORAMA NACIONAL o INTERNACIONAL, NUNCA en Noticias Chiapas.
5. Formato directo redactado para lectura inmediata al aire en radio (sin acotaciones, sin introducciones tipo "aquí la nota", ni saludos de locutor).
6. NUNCA inicies frases con "De acuerdo con información publicada por..." o "Según reporta...".
7. Si hay información de EDUARDO RAMÍREZ, OMITIRLA por completo.
8. EXTRACCIÓN DE FUENTES: Identifica y coloca el nombre real del periódico, portal web o medio que publica la nota en el texto de origen. Si el texto no menciona el medio, coloca "Mesa de Redacción". NUNCA pongas "Redes Sociales" salvo que el texto diga explícitamente que procede de una publicación en redes.

════════════════════════════════════════
BLOQUE 1 — EFEMÉRIDE MUSICAL
════════════════════════════════════════ 
Busca EXCLUSIVAMENTE UN MÚSICO, CANTANTE O COMPOSITOR (mexicano preferentemente, o internacional) que haya nacido o fallecido un día como hoy (${hoyTexto}).
ESTRICTAMENTE PROHIBIDO seleccionar pintores, muralistas, escritores, cineastas o actores. Debe ser un referente de la música. Verifica rigurosamente la autoría de las canciones mencionadas.
Formato:
EFEMÉRIDE: [nombre del músico] — [NATALICIO / LUCTUOSO]
[Texto de máximo 150 palabras redactado para radio sobre su legado musical]
PROPUESTA MUSICAL: [Canción o pieza emblemática real del artista]

════════════════════════════════════════
BLOQUE 2 — NOTICIAS LOCALES (San Cristóbal y Altos)
════════════════════════════════════════
${seccionLocal || 'Sin información disponible para este bloque.'}
INSTRUCCIONES: Redactar TODAS las notas disponibles entregadas en esta sección. Corregir redacción/ortografía sin depurar datos. Extensión de 120 a 200 palabras por nota.
Formato:
Fuente: [Nombre del medio original o Mesa de Redacción] | [Hora o "Hora no disponible"]
[TÍTULO EN MAYÚSCULAS]
[Resumen periodístico detallado]

════════════════════════════════════════
BLOQUE 3 — NOTICIAS CHIAPAS
════════════════════════════════════════
${seccionChiapas || 'Sin información disponible para este bloque.'}

REGLAS DE SELECCIÓN Y ESTRUCTURA:
1. SOLO incluir sucesos ocurridos DENTRO del estado de Chiapas o de impacto directo en municipios chiapanecos.
2. OBLIGATORIO GENERAR:
   - Mínimo 2 a 3 notas en "Subsección A: REGIÓN ALTOS" (San Cristóbal de Las Casas, mineral de la montaña, Chamula, Tenejapa, Chenalhó, Zinacantán, Pantelhó, Huixtán, Oxchuc).
   - Mínimo 3 notas en "Subsección B: RESTO DEL ESTADO" (Tuxtla Gutiérrez, Tapachula, Comitán, Palenque, Soconusco, etc.).
3. Puedes usar notas del mismo portal siempre que sean sobre temas distintos.
4. Extensión de 120 a 200 palabras por nota.

Formato de salida para cada nota:
[Subsección: REGIÓN ALTOS / RESTO DEL ESTADO]
Fuente: [Nombre del medio original o Mesa de Redacción] | [Fecha] | [Hora o "Hora no disponible"]
[TÍTULO EN MAYÚSCULAS]
[Resumen periodístico en tercera persona]

════════════════════════════════════════
BLOQUE 4 — NOTICIAS NACIONALES E INTERNACIONALES
════════════════════════════════════════
${seccionNacionales || 'Sin información disponible para este bloque.'}

REGLAS DE SELECCIÓN Y ESTRUCTURA:
1. OBLIGATORIO GENERAR:
   - Mínimo 3 a 4 notas en "Subsección A: PANORAMA NACIONAL" (Acontecimientos en México o logros de deportistas/artistas mexicanos en el extranjero).
   - Mínimo 2 a 3 notas en "Subsección B: INTERNACIONAL" (Acontecimientos políticos, sociales o económicos fuera de México).
2. Procesa la mayor cantidad de información disponible en el texto fuente sin omitir noticias relevantes.
3. Puedes usar notas del mismo portal siempre que correspondan a hechos distintos.
4. Extensión de 120 a 200 palabras por nota.

Formato de salida para cada nota:
[Subsección: PANORAMA NACIONAL / INTERNACIONAL]
Fuente: [Nombre del medio original o Mesa de Redacción] | [Fecha] | [Hora o "Hora no disponible"]
[TÍTULO EN MAYÚSCULAS]
[Resumen periodístico en tercera persona]`;

    const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';

    const response = await axios.post(
      apiUrl,
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'Eres un editor y redactor de noticias para radio comercial. Tu trabajo es procesar extensamente el material entregado y generar un guión completo sin escatimar notas. Debes incluir al menos 3 a 4 notas en el Bloque 3 y al menos 5 a 7 notas en el Bloque 4 siempre que haya material disponible.'
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
        timeout: 120000 // 2 minutos de timeout para respuestas largas de la API
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

// Servir el frontend HTML para cualquier ruta navegable
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const HOST = '0.0.0.0';
app.listen(port, HOST, () => {
  console.log(`Servidor de Guiones activo en el puerto ${port}`);
});
