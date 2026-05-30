process.on('uncaughtException', (err) => {
  console.error('Error no capturado:', err);
});
// bot.js
const express = require("express");
const twilio = require("twilio");
const OpenAI = require("openai");

// Asegúrate de inicializar las variables de entorno correctamente
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

const app = express();
app.use(express.urlencoded({ extended: false }));

// Cliente REST de Twilio para enviar mensajes de forma asíncrona
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Memoria volátil en servidor (Para producción real, usa Redis o una Base de Datos)
const historialConversaciones = {};

async function generarRespuestaIA(telefonoUsuario, nuevoMensaje) {
  // 1. Inicializar el historial del usuario si no existe
  if (!historialConversaciones[telefonoUsuario]) {
    historialConversaciones[telefonoUsuario] = [
      {
        role: "system",
        content: `Eres el asistente virtual de Netly Core, una agencia de marketing digital especializada en sistemas de adquisición y automatización para negocios y gimnasios. 
        Tu objetivo es calificar y atender dudas de prospectos sobre nuestros servicios de creación de landing pages, embudos de venta y estrategias digitales de alta conversión.
        
        Pautas de comportamiento:
        1. Sé un cerrador: Tu tono debe ser profesional, enérgico, persuasivo, muy amable y enfocado en negocios (estilo high-performance).
        2. Al grano: Responde de forma concisa y directa (máximo 2 párrafos cortos). Usa listas cortas si es necesario.
        3. Formato WhatsApp: Usa negritas para resaltar palabras clave escribiendo entre asteriscos (ejemplo: *Netly Core*). Usa emojis de forma estratégica (🚀, 🔥, 📈, 📲). No uses guiones largos ni formatos Markdown complejos que WhatsApp no entienda.
        4. Objetivo Final: Mantén el flujo de la conversación de forma natural. Si detectas alto interés, invita sutilmente al usuario a agendar una llamada rápida de 15 minutos para armar su estrategia.`,
      }
    ];
  }

  // 2. Agregar el mensaje actual del usuario al historial
  historialConversaciones[telefonoUsuario].push({ role: "user", content: nuevoMensaje });

  // Mantener solo los últimos 10 mensajes para no saturar el contexto/tokens
  if (historialConversaciones[telefonoUsuario].length > 11) {
    historialConversaciones[telefonoUsuario].splice(1, 2); // Remueve los dos más antiguos después del system prompt
  }

  // 3. Consultar a OpenAI con todo el contexto acumulado
  const respuesta = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 400,
    temperature: 0.7, // Un toque de creatividad comercial, pero controlado
    messages: historialConversaciones[telefonoUsuario],
  });

  const textoRespuesta = respuesta.choices[0].message.content;

  // 4. Guardar la respuesta del bot en el historial del usuario
  historialConversaciones[telefonoUsuario].push({ role: "assistant", content: textoRespuesta });

  return textoRespuesta;
}

// Webhook optimizado contra Timeouts
app.post("/webhook", async (req, res) => {
  const mensajeUsuario = req.body.Body;
  const telefonoUsuario = req.body.From; // Viene en formato 'whatsapp:+593xxxxxxx'
  const telefonoBot = req.body.To;      // El número de tu Twilio Sandbox o número comercial

  console.log(`📩 Mensaje de ${telefonoUsuario}: ${mensajeUsuario}`);

  // 🔥 ESTRATEGIA CRÍTICA: Respondemos a Twilio INMEDIATAMENTE con un 200 OK vacío.
  // Esto le dice a Twilio "Recibido, yo me encargo", evitando el timeout de 15 segundos.
  res.status(200).send("<Response></Response>");

  // El procesamiento pesado ocurre en segundo plano de manera asíncrona
  try {
    console.log(`🤖 Procesando respuesta con IA para ${telefonoUsuario}...`);
    const respuestaIA = await generarRespuestaIA(telefonoUsuario, mensajeUsuario);

    // Enviamos el mensaje usando la API REST de Twilio, no el TwiML de retorno
    await twilioClient.messages.create({
      body: respuestaIA,
      from: telefonoBot,
      to: telefonoUsuario
    });

    console.log(`✅ Respuesta enviada con éxito a ${telefonoUsuario}`);
  } catch (error) {
    console.error(`❌ Error procesando el mensaje para ${telefonoUsuario}:`, error.message);
    
    // Intento de enviar un mensaje de error amigable al usuario en caso de fallo en segundo plano
    try {
      await twilioClient.messages.create({
        body: "Disculpa, experimenté un pequeño parpadeo digital. 📲 ¿Me podrías repetir tu última pregunta?",
        from: telefonoBot,
        to: telefonoUsuario
      });
    } catch (err) {
      console.error("No se pudo enviar el mensaje de error por contingencia:", err.message);
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor de Netly Core corriendo en el puerto ${PORT}`);
});
