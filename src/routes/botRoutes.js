require('dotenv').config();

const express = require("express");
const bodyParser = require("body-parser");
const OpenAI = require("openai");
const cors = require("cors");

const router = express.Router();

router.use(bodyParser.json());
router.use(cors());

const pool = require("../config/db");

const key = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: key });

router.post('/generar-respuesta', async (req, res) => {
  try {
    const { mensaje, empresa_id } = req.body;

    if (!mensaje || !empresa_id) {
      return res.status(400).send({ error: "El mensaje y empresa_id son requeridos" });
    }
    console.log("Mensaje recibido:", mensaje);
    
    // 1. Obtener el assistant_id de la empresa
    const empresaResult = await pool.query(
      'SELECT assistant_id FROM Empresas WHERE empresa_id = $1',
      [empresa_id]
    );
    const assistant_id = empresaResult.rows[0]?.assistant_id;

    if (!assistant_id) {
      return res.status(404).send({ error: "Assistant no asignado a la empresa" });
    }

    // 2. Obtener las FAQs de la empresa
    const faqsResult = await pool.query(
      'SELECT pregunta, respuesta FROM empresafaqs WHERE empresa_id = $1',
      [empresa_id]
    );
    
    // 3. Formatear las FAQs como contexto para el asistente
    let faqsContexto = "";
    if (faqsResult.rows.length > 0) {
      faqsContexto = "Preguntas Frecuentes de la empresa:\n\n";
      faqsResult.rows.forEach((faq, index) => {
        faqsContexto += `Pregunta: ${faq.pregunta}\nRespuesta: ${faq.respuesta}\n\n`;
      });
      
      console.log("FAQs encontradas para la empresa:", faqsResult.rows.length);
    } else {
      console.log("No se encontraron FAQs para esta empresa");
    }

    // 4. Crear el hilo de conversación en OpenAI
    const threadResponse = await openai.beta.threads.create();
    const threadId = threadResponse.id;

    // 5. Agregar el contexto de las FAQs primero (si existen)
    if (faqsContexto) {
      await openai.beta.threads.messages.create(threadId, {
        role: "user",
        content: `Información de FAQs para referencia: ${faqsContexto}\n\nPor favor, usa esta información para responder preguntas si son relevantes.`,
      });
    }

    // 6. Agregar la pregunta del usuario
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: mensaje,
    });

    // 7. Ejecutar el asistente con instrucciones adicionales
    const runResponse = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistant_id,
      instructions: faqsContexto 
        ? "Responde utilizando la información de las FAQs proporcionadas cuando sea relevante. Si la pregunta del usuario coincide con alguna FAQ, prioriza esa información."
        : "Responde a la consulta del usuario de la mejor manera posible."
    });

    // El resto del código permanece igual
    // Esperar a que el asistente termine
    let run = await openai.beta.threads.runs.retrieve(threadId, runResponse.id);
    while (run.status !== "completed") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      run = await openai.beta.threads.runs.retrieve(threadId, runResponse.id);
    }

    // Obtener la respuesta del asistente
    const messagesResponse = await openai.beta.threads.messages.list(threadId);
    const assistantResponses = messagesResponse.data.filter(
      (msg) => msg.role === "assistant"
    );

    const response = assistantResponses
      .map((msg) =>
        msg.content
          .filter((contentItem) => contentItem.type === "text")
          .map((textContent) => textContent.text.value)
          .join("\n")
      )
      .join("\n");

    res.json({ response });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send({ error: "Ha ocurrido un error en el servidor." });
  }
});

  router.get('/asistente/:empresa_id', async (req, res) => {
    const { empresa_id } = req.params;
  
    if (!empresa_id) {
      return res.status(400).json({ error: 'El empresa_id es requerido' });
    }
  
    try {
      const result = await pool.query(
        `SELECT assistant_id FROM empresas WHERE empresa_id = $1`,
        [empresa_id]
      );
  
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Asistente no encontrado para la empresa proporcionada' });
      }
  
      res.json({ assistant: result.rows[0] });
    } catch (err) {
      console.error('Error al obtener los asistentes:', err);
      res.status(500).json({ error: 'Error al obtener los asistentes' });
    }
  });
  

module.exports = router;