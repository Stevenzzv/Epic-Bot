// bot.js
const express = require("express");
const twilio = require("twilio");
const OpenAI = require("openai");

const app = express();
app.use(express.urlencoded({ extended: false }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function preguntarAOpenAI(mensaje) {
  const respuesta = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 500,
    messages: [
      {
        role: "system",
        content: `Eres el asistente virtual de Netly Core, una agencia de marketing digital especializada en sistemas de adquisición y automatización. 
        Tu objetivo es atender dudas de prospectos sobre nuestros servicios de creación de landing pages, embudos de venta y estrategias digitales.
        
        Pautas de comportamiento:
        1. Sé un cerrador: Tu tono debe ser profesional, enérgico, persuasivo y muy amable.
        2. Al grano: Responde de forma concisa y directa (máximo 2-3 párrafos cortos). Usa viñetas (bullet points) si listas beneficios o productos.
        3. Formato WhatsApp: Usa negritas para resaltar palabras clave y añade emojis de forma estratégica (🚀, 🔥, 📈, 📲) para hacer el texto escaneable.
        4. Llamado a la acción (CTA): Como no tienes memoria de la conversación, cierra siempre invitando al usuario a agendar una llamada rápida o a dejar sus datos para que un asesor lo contacte.`,
      },
      {
        role: "user",
        content: mensaje,
      },
    ],
  });

  return respuesta.choices[0].message.content;
}

// Twilio llama a este endpoint cuando llega un mensaje
app.post("/webhook", async (req, res) => {
  const mensaje = req.body.Body;
  const de = req.body.From;

  console.log(`📩 Mensaje de ${de}: ${mensaje}`);

  await esperar(1500);

  try {
    console.log("🤖 Consultando a OpenAI...");
    const respuesta = await preguntarAOpenAI(mensaje);
    await esperar(1000);

    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(respuesta);

    res.type("text/xml");
    res.send(twiml.toString());
    console.log(`✅ Respuesta enviada: ${respuesta}`);
  } catch (error) {
    console.error("❌ Error:", error.message);
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message("Lo siento, tuve un problema.");
    res.type("text/xml");
    res.send(twiml.toString());
  }
});

app.listen(3000, () => {
  console.log("✅ Servidor corriendo en puerto 3000");
});
