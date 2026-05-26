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
        content: "Eres un asistente amable que responde por WhatsApp. Sé breve y usa emojis ocasionalmente.",
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