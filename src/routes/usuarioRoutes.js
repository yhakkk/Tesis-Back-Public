const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

router.post("/registrarUsuario", async (req, res) => {
  const {
    nombre,
    apellido,
    numero,
    pais,
    provincia,
    domicilio,
    usuario,
    email,
    password,
  } = req.body;

  try {
    if (!password) {
      return res
        .status(400)
        .json({ error: "El campo password es obligatorio" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO Usuarios (nombre, apellido, numero, pais, provincia, domicilio, usuario, email, password) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        nombre,
        apellido,
        numero,
        pais,
        provincia,
        domicilio,
        usuario,
        email,
        hashedPassword,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error al registrar el usuario:", err);
    res.status(500).json({ error: "Error al registrar el usuario" });
  }
});

router.post("/registrarEmpleado", authMiddleware, async (req, res) => {
  const {
    nombre,
    apellido,
    numero,
    pais,
    provincia,
    domicilio,
    usuario,
    email,
    password,
  } = req.body;
  try {
    const empresa_id = req.user.empresa_id;

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO Usuarios (nombre, apellido, numero, pais, provincia, domicilio, usuario, email, password, empresa_id, rol_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        nombre,
        apellido,
        numero,
        pais,
        provincia,
        domicilio,
        usuario,
        email,
        hashedPassword,
        empresa_id,
        3,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error al registrar el empleado:", err);
    res.status(500).json({ error: "Error al registrar el empleado" });
  }
});

// En usuarioRoutes.js - función create
router.post("/create", async (req, res) => {
  const { nombre, email, estado, empresa_id } = req.body;
  const io = req.app.get("io");

  try {
    // Crear el ticket sin asignar
    const resultTicket = await pool.query(
      `INSERT INTO Tickets (nombre, email, estado, empresa_id) VALUES ($1, $2, $3, $4) RETURNING ticket_id`,
      [nombre, email, estado, empresa_id]
    );
    const ticket_id = resultTicket.rows[0].ticket_id;
    console.log(`Ticket creado con ID: ${ticket_id}`);

    // IMPORTARTE: Llamar directamente a la función de asignación aquí
    const { asignarTicketRoundRobin } = req.app.locals;
    if (asignarTicketRoundRobin) {
      console.log(`Intentando asignar ticket ${ticket_id} mediante Round Robin...`);
      const agente = await asignarTicketRoundRobin(ticket_id, empresa_id);
      
      if (agente) {
        console.log(`Ticket ${ticket_id} asignado a ${agente.nombre}`);
        
        // Emitir notificación después de asignar
        if (io) {
          io.to(`empresa_${empresa_id}`).emit('ticket_asignado', {
            ticket_id,
            usuario_asignado_id: agente.usuario_id,
            usuario_asignado_nombre: agente.nombre
          });
        }
      } else {
        console.log(`No se pudo asignar el ticket ${ticket_id}`);
      }
    } else {
      console.log(`Función asignarTicketRoundRobin no disponible`);
    }

    res.status(201).json({
      ticket_id
    });
  } catch (error) {
    console.error("Error al crear el ticket:", error);
    res.status(500).json({ message: "Error al crear el ticket" });
  }
});
router.get("/getEmpresas", async (req, res) => {
  try {
    const result = await pool.query(`
        SELECT e.*, COUNT(u.usuario_id) as total_usuarios
        FROM Empresas e
         LEFT JOIN Usuarios u ON e.empresa_id = u.empresa_id
         GROUP BY e.empresa_id
       `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error al obtener las empresas:", err);
    res.status(500).json({ error: "Error al obtener las empresas" });
  }
});

router.get("/getEmpresas/:empresa_id", async (req, res) => {
  const { empresa_id } = req.params;
  try {
    const result = await pool.query(
      `
        SELECT e.*, COUNT(u.usuario_id) as total_usuarios
        FROM Empresas e
         LEFT JOIN Usuarios u ON e.empresa_id = u.empresa_id
         WHERE e.empresa_id = $1
         GROUP BY e.empresa_id
       `,
      [empresa_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error al obtener la empresa:", err);
    res.status(500).json({ error: "Error al obtener la empresa" });
  }
});

router.get("/", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM Usuarios`);
    res.json(result.rows);
  } catch (err) {
    console.error("Error al obtener los usuarios:", err);
    res.status(500).json({ error: "Error al obtener los usuarios" });
  }
});

//Obtener roles
router.get("/roles", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM roles`);
    res.json(result.rows);
  } catch (err) {
    console.error("Error al obtener los roles:", err);
    res.status(500).json({ error: "Error al obtener los roles" });
  }
});

router.get("/getMensajes/:ticket_id", async (req, res) => {
  const { ticket_id } = req.params; // Asegúrate de recibir el ticket_id en el body

  if (!ticket_id) {
    return res.status(400).json({ error: "El ticket_id es requerido" });
  }

  try {
    const result = await pool.query(
      `
      SELECT m.*, 
             u.nombre AS nombre_usuario, 
             e.nombre AS nombre_empresa
      FROM Mensajes m
      LEFT JOIN Usuarios u ON m.usuario_id = u.usuario_id
      LEFT JOIN Empresas e ON u.empresa_id = e.empresa_id
      WHERE m.ticket_id = $1
      ORDER BY m.fecha_envio ASC
    `,
      [ticket_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error al obtener los mensajes:", err);
    res.status(500).json({ error: "Error al obtener los mensajes" });
  }
});

// Actualizar rol_id de un usuario por email
router.put("/updateRol", authMiddleware, async (req, res) => {
  const { email, rol_id, empresa_id } = req.body;

  if (!email || !rol_id || !empresa_id) {
    return res.status(400).json({ error: "Email, rol_id y empresa son requeridos" });
  }

  try {
    const userResult = await pool.query(
      `SELECT * FROM Usuarios WHERE email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    await pool.query(`UPDATE Usuarios SET rol_id = $1, empresa_id = $2 WHERE email = $3`, [
      rol_id,      
      empresa_id,
      email,
    ]);

    res.json({ message: "Rol actualizado correctamente" });
  } catch (err) {
    console.error("Error al actualizar el rol:", err);
    res.status(500).json({ error: "Error al actualizar el rol" });
  }
});
router.get("/:empresa_id/faqs", async (req, res) => {
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

module.exports = router;
