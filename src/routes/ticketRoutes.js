// routes/ticketRoutes.js
const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/auth");
const router = express.Router();




// GET /tickets/clientes/:cliente_id
router.get("/clientes/:cliente_id", async (req, res) => {
  const { cliente_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT t.ticket_id, t.titulo, t.descripcion, t.estado, t.prioridad 
      FROM Tickets t
      JOIN TicketxUsuario txu ON t.ticket_id = txu.ticket_id
      JOIN Usuarios u ON txu.usuario_id = u.usuario_id
      WHERE txu.usuario_id = $1 AND u.rol_id = 4`, 
     [cliente_id]
   );
    if (result.rows.length > 0) {
      res.status(200).json(result.rows);
    } else {
      res.status(404).json({ message: "No se encontraron tickets para este cliente" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener los tickets del cliente" });
  }
});

// GET /tickets/empleados/:empleado_id
router.get("/empleados/:empleado_id", async (req, res) => {
  const { empleado_id } = req.params;

  try {
    const result = await pool.query(
      // t.titulo, t.descripcion, t.estado, t.prioridad 
      `SELECT t.ticket_id
      FROM Tickets t
      JOIN TicketxUsuario txu ON t.ticket_id = txu.ticket_id
      JOIN Usuarios u ON txu.usuario_id = u.usuario_id
      WHERE txu.usuario_id = $1 AND u.rol_id = 3`, 
      [empleado_id]
    );

    if (result.rows.length > 0) {
      res.status(200).json(result.rows);
    } else {
      res.status(404).json({ message: "No se encontraron tickets para este empleado" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener los tickets del empleado" });
  }
});

router.get("/empresa/:empresa_id", async (req, res) => {
  const { empresa_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
          t.*, 
          u.usuario_id AS usuario_asignado_id, 
          u.nombre AS usuario_asignado_nombre, 
          u.apellido AS usuario_asignado_apellido,
          u.email AS usuario_asignado_email
       FROM Tickets t
       LEFT JOIN Usuarios u ON t.usuario_asignado_id = u.usuario_id
       WHERE t.empresa_id = $1`,
      [empresa_id]
    );

    if (result.rows.length > 0) {
      res.status(200).json(result.rows);
    } else {
      res.status(404).json({ message: "No se encontraron tickets para esta empresa" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener los tickets de la empresa" });
  }
});

// GET /tickets/asignados/:usuario_id - Obtiene todos los tickets asignados a un usuario
router.get("/asignados/:usuario_id", async (req, res) => {
  const { usuario_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT * 
       FROM Tickets 
       WHERE usuario_asignado_id = $1
      `,
      [usuario_id]
    );

    if (result.rows.length > 0) {
      res.status(200).json(result.rows);
    } else {
      res.status(404).json({ message: "No se encontraron tickets asignados a este usuario" });
    }
  } catch (error) {
    console.error("Error al obtener los tickets asignados:", error);
    res.status(500).json({ message: "Error al obtener los tickets asignados" });
  }
});


// GET /tickets/:ticket_id
router.get("/id/:ticket_id", async (req, res) => {
  const { ticket_id } = req.params;

  try {
    // Consulta para obtener los detalles del ticket
    const ticketResult = await pool.query(
      `SELECT *
       FROM Tickets t
       WHERE t.ticket_id = $1`,
      [ticket_id]
    );

    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ message: "Ticket no encontrado" });
    }

    // Consulta para obtener los mensajes asociados al ticket
    const messagesResult = await pool.query(
      `SELECT m.mensaje_id, m.mensaje, m.fecha_envio, 
              u.usuario_id, u.nombre, u.email, u.rol_id
       FROM Mensajes m
       JOIN Usuarios u ON m.usuario_id = u.usuario_id
       WHERE m.ticket_id = $1
       ORDER BY m.fecha_envio ASC`,
      [ticket_id]
    );

    // Construir respuesta combinando ticket y mensajes
    const ticketData = ticketResult.rows[0];
    ticketData.mensajes = messagesResult.rows;

    res.status(200).json(ticketData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener los detalles del ticket" });
  }
});


/**
 * Endpoint para publicar un mensaje en un ticket
 * POST /tickets/:ticket_id/messages
 */
router.post('/:ticket_id/messages', authMiddleware, async (req, res) => {
  const { ticket_id } = req.params;
  const { usuario_id, mensaje } = req.body;

  // Validación de datos
  if (!mensaje || mensaje.trim() === '') {
    return res.status(400).json({ message: 'El mensaje es requerido' });
  }

  if (!usuario_id) {
    return res.status(400).json({ message: 'El ID del usuario es requerido' });
  }

  try {
    // Verificar que el ticket existe
    const ticketCheck = await pool.query(
      'SELECT ticket_id FROM Tickets WHERE ticket_id = $1',
      [ticket_id]
    );

    if (ticketCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Ticket no encontrado' });
    }

    // Verificar que el usuario existe
    const userCheck = await pool.query(
      'SELECT usuario_id FROM Usuarios WHERE usuario_id = $1',
      [usuario_id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Insertar el mensaje
    const result = await pool.query(
      `INSERT INTO Mensajes (ticket_id, usuario_id, mensaje, fecha_envio) 
       VALUES ($1, $2, $3, NOW()) 
       RETURNING mensaje_id, mensaje, fecha_envio`,
      [ticket_id, usuario_id, mensaje]
    );

    const nuevoMensaje = result.rows[0];

    // Obtener información adicional del usuario para la respuesta
    const userInfo = await pool.query(
      `SELECT nombre, email, rol_id FROM Usuarios WHERE usuario_id = $1`,
      [usuario_id]
    );

    const mensajeCompleto = {
      ...nuevoMensaje,
      usuario_id,
      nombre: userInfo.rows[0].nombre,
      email: userInfo.rows[0].email,
      rol_id: userInfo.rows[0].rol_id
    };

    // Notificar a través de Socket.IO (si está configurado)
    if (req.app.get('io')) {
      req.app.get('io').to(`ticket_${ticket_id}`).emit('nuevo_mensaje', mensajeCompleto);
    }

    res.status(201).json(mensajeCompleto);
  } catch (error) {
    console.error('Error al guardar el mensaje:', error);
    res.status(500).json({ message: 'Error al guardar el mensaje' });
  }
});

// GET /tickets/activos
router.get("/activos", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.ticket_id, t.titulo, t.descripcion, t.estado, t.prioridad 
       FROM Tickets t
       WHERE t.estado = '1'`
    );

    if (result.rows.length > 0) {
      res.status(200).json(result.rows);
    } else {
      res.status(404).json({ message: "No se encontraron tickets activos" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener los tickets activos" });
  }
});

// GET /tickets/cerrados
router.get("/cerrados", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.ticket_id, t.titulo, t.descripcion, t.estado, t.prioridad 
       FROM Tickets t
       WHERE t.estado = '0'`
    );

    if (result.rows.length > 0) {
      res.status(200).json(result.rows);
    } else {
      res.status(404).json({ message: "No se encontraron tickets cerrados" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener los tickets cerrados" });
  }
});


router.get('/:ticket_id/messages', async (req, res) => {
  const { ticket_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT m.mensaje_id, m.mensaje, m.fecha_envio, u.nombre AS usuario_nombre
       FROM Mensajes m
       JOIN Usuarios u ON m.usuario_id = u.usuario_id
       WHERE m.ticket_id = $1
       ORDER BY m.fecha_envio ASC`,
      [ticket_id]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener los mensajes:', error);
    res.status(500).json({ message: 'Error al obtener los mensajes' });
  }
});


router.post('/:ticket_id/messages', async (req, res) => {
  const { ticket_id } = req.params;
  const { usuario_id, mensaje } = req.body;

  try {
    await pool.query(
      `INSERT INTO Mensajes (ticket_id, usuario_id, mensaje) VALUES ($1, $2, $3)`,
      [ticket_id, usuario_id, mensaje]
    );
    res.status(201).json({ message: 'Mensaje creado correctamente' });
  } catch (error) {
    console.error('Error al guardar el mensaje:', error);
    res.status(500).json({ message: 'Error al guardar el mensaje' });
  }
});

// PATCH /tickets/:ticket_id/bot
router.patch('/:ticket_id/bot', async (req, res) => {
  const { ticket_id } = req.params;
  const { bot_activo } = req.body;

  if (typeof bot_activo !== 'boolean') {
    return res.status(400).json({ message: 'El valor de bot_activo debe ser booleano.' });
  }

  try {
    const result = await pool.query(
      `UPDATE Tickets SET bot_activo = $1 WHERE ticket_id = $2 RETURNING ticket_id, bot_activo`,
      [bot_activo, ticket_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ticket no encontrado' });
    }

    res.status(200).json({ message: 'Estado del bot actualizado', ticket: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar el estado del bot:', error);
    res.status(500).json({ message: 'Error al actualizar el estado del bot' });
  }
});


// GET /tickets/:ticket_id/bot
router.get('/:ticket_id/bot', async (req, res) => {
  const { ticket_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT bot_activo FROM Tickets WHERE ticket_id = $1`,
      [ticket_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ticket no encontrado' });
    }

    res.status(200).json({ ticket_id, bot_activo: result.rows[0].bot_activo });
  } catch (error) {
    console.error('Error al obtener el estado del bot:', error);
    res.status(500).json({ message: 'Error al obtener el estado del bot' });
  }
});


router.put("/asignar/:id", async (req, res) => {
  const { id } = req.params;
  const { usuario_asignado_id } = req.body;

  try {
    const result = await pool.query(
      `UPDATE Tickets SET usuario_asignado_id = $1 WHERE ticket_id = $2 RETURNING *`,
      [usuario_asignado_id, id]
    );

    if (result.rows.length > 0) {
      res.status(200).json(result.rows[0]);
    } else {
      res.status(404).json({ message: "Ticket no encontrado" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al asignar el ticket" });
  }
});

module.exports = router;
