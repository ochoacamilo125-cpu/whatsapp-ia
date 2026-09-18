require("dotenv").config();

const express = require("express");
const OpenAI = require("openai");

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const PORT = process.env.PORT || 3000;

// Verificación del webhook de Meta
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

// Recibir mensajes de WhatsApp
app.post("/webhook", async (req, res) => {
  try {
    const message =
      req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

    if (message.type !== "text") {
      return res.sendStatus(200);
    }

    const numero = message.from;
    const texto = message.text.body;

    console.log("Mensaje:", texto);

    // Enviar mensaje a la IA
    const respuestaIA = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      instructions:
        "Eres un asistente de WhatsApp. Responde de forma natural, amable y breve.",
      input: texto
    });

    const respuesta =
      respuestaIA.output_text || "No pude generar una respuesta.";

    // Responder por WhatsApp
    await enviarWhatsApp(numero, respuesta);

    res.sendStatus(200);

  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

async function enviarWhatsApp(numero, texto) {
  const version = process.env.GRAPH_API_VERSION || "v23.0";

  const url =
    `https://graph.facebook.com/${version}/` +
    `${process.env.PHONE_NUMBER_ID}/messages`;

  const respuesta = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: numero,
      type: "text",
      text: {
        body: texto
      }
    })
  });

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    console.error(datos);
    throw new Error("Error enviando mensaje a WhatsApp");
  }
}

app.get("/", (req, res) => {
  res.send("WhatsApp IA funcionando");
});

app.listen(PORT, () => {
  console.log(`Servidor funcionando en el puerto ${PORT}`);
});
