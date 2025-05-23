// routes/empresaRoutes.js
const express = require("express");
const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// Registrar un nuevo empleado para la empresa
router.post("/registrarEmpleado", authMiddleware, async (req, res) => {
  const { nombre, apellido, email, password, empresa_id } = req.body;

  try {
    // Verificar si el email del empleado ya está registrado
    const existingUser = await pool.query(
      "SELECT * FROM Usuarios WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "El correo electrónico ya está registrado." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO Usuarios (nombre, apellido, email, password,empresa_id,rol_id ) VALUES ($1, $2, $3, $4, $5, 3) RETURNING *`,
      [nombre, apellido, email, hashedPassword, empresa_id]
    );

    const nuevoEmpleado = result.rows[0];

    res.status(201).json(nuevoEmpleado);
  } catch (err) {
    console.error("Error al registrar al empleado:", err);
    res.status(500).json({ error: "Error al registrar al empleado" });
  }
});

router.get("/:empresa_id/empleados", authMiddleware, async (req, res) => {
  const { empresa_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT u.*
 FROM Usuarios u
 WHERE u.rol_id = 3 AND u.empresa_id = $1`,
      [empresa_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener los empleados de la empresa:", error);
    res
      .status(500)
      .json({ error: "Error al obtener los empleados de la empresa" });
  }
});


router.get("/:empresa_id/faqs", authMiddleware, async (req, res) => {
  const { empresa_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT f.*
       FROM empresafaqs f
       WHERE f.empresa_id = $1`,
      [empresa_id]
    );
    res.json(result.rows);

  } catch (error) {
    console.error("Error al obtener las FAQs de la empresa:", error);
    res.status(500).json({
      error: "Error al obtener las FAQs de la empresa",
    });

  }

});

router.put("/:empresa_id/faqs/:faq_id", authMiddleware, async (req, res) => {
  const { empresa_id, faq_id } = req.params;
  const { pregunta, respuesta,habilitado } = req.body;
  try {
    const result = await pool.query(
      `UPDATE empresafaqs SET pregunta = $1, respuesta = $2, habilitado = $3 WHERE empresa_id = $4 AND faq_id = $5 RETURNING *`,
      [pregunta, respuesta, habilitado ,empresa_id, faq_id]
    );
    const updatedFaq = result.rows[0];
    res.json(updatedFaq);
  } catch (error) {
    console.error("Error al actualizar la FAQ:", error);
    res.status(500).json({
      error: "Error al actualizar la FAQ",
    });

  }
});

router.post("/:empresa_id/faqs", authMiddleware, async (req, res) => {
  const { empresa_id } = req.params;
  const { pregunta, respuesta } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO empresafaqs (pregunta, respuesta, empresa_id) VALUES ($1, $2, $3) RETURNING *`,
      [pregunta, respuesta, empresa_id]
    );
    const nuevaFaq = result.rows[0];
    res.json(nuevaFaq);
  } catch (error) {
    console.error("Error al crear la FAQ:", error);
    res.status(500).json({
      error: "Error al crear la FAQ",
    });

  }
});


router.put("/:empresa_id/assistant", authMiddleware, async (req, res) => {
  const { empresa_id } = req.params;
  const { assistant_id } = req.body;

  if (!assistant_id) {
    return res.status(400).json({ error: "El assistant_id es requerido." });
  }

  try {
    const result = await pool.query(
      `UPDATE Empresas SET assistant_id = $1 WHERE empresa_id = $2 RETURNING empresa_id, assistant_id`,
      [assistant_id, empresa_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Empresa no encontrada." });
    }

    res.json({ message: "Assistant asignado correctamente.", empresa: result.rows[0] });
  } catch (error) {
    console.error("Error al asignar el assistant:", error);
    res.status(500).json({ error: "Error al asignar el assistant." });
  }
});



router.put("/:ticket_id/estado", authMiddleware, async (req, res) => {
  const { ticket_id } = req.params;
  const { estado } = req.body;

  if (![0, 1, 2].includes(estado)) {
    return res.status(400).json({ error: "El estado debe ser 0, 1 o 2." });
  }

  try {
    const result = await pool.query(
      `UPDATE Tickets SET estado = $1 WHERE ticket_id = $2 RETURNING ticket_id, estado`,
      [estado, ticket_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Ticket no encontrado." });
    }

    res.json({ message: "Estado del ticket actualizado.", ticket: result.rows[0] });
  } catch (error) {
    console.error("Error al actualizar el estado del ticket:", error);
    res.status(500).json({ error: "Error al actualizar el estado del ticket." });
  }
});

router.get("/asistant/empresa/:empresa_id", authMiddleware, async (req, res) => {
    try {
      const { empresa_id } = req.params;
      const result = await pool.query(
        `SELECT assistant_id FROM Empresas WHERE empresa_id = $1`,
        [empresa_id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Empresa no encontrada." });
      }
      const assistant_id = result.rows[0].assistant_id;

      const assistant = await openai.beta.assistants.retrieve(assistant_id);
      console.log(assistant);
      if (!assistant) {
        return res.status(404).json({ error: "Asistente no encontrado." });
      }
      res.json(assistant);

    } catch (error) {
      res.status(500).json({ error: "Error al obtener el asistente." });
      console.error("Error al obtener el asistente:", error);
    }
  });


  router.put("/asistant/empresa/:assistant_id", authMiddleware, async (req, res) => {
    try {
      const { assistant_id } = req.params;
      const { name, instructions } = req.body;


      if (!assistant_id) {
        return res.status(400).json({ error: "El assistant_id es requerido." });
      }

      const completeInstructions = instructions

      try {
        const updatedAsistant = await openai.beta.assistants.update(assistant_id, {
          name: name,
          instructions: completeInstructions,
        });

        res.json({message: "Asistente actualizado correctamente.", assistant: updatedAsistant });
      } catch (error) {
        console.error("Error al actualizar el asistente:", error);
        res.status(500).json({ error: "Error al actualizar el asistente." });
      }
    } catch (error) {
      res.status(500).json({ error: "Error al obtener el asistente." });
      console.error("Error al obtener el asistente:", error);
    }
  }
  );
  


module.exports = router;


