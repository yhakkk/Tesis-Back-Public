require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const empresaSASRoute = require("./routes/empresaSASRoute");
const usuarioRoutes = require("./routes/usuarioRoutes");
const ticketRoutes = require("./routes/ticketRoutes");
const empresaRoute = require("./routes/empresaRoute");
const loginRoutes = require("./routes/loginRoutes");
const paisesRoutes = require("./routes/paisesRoute");
const botRoutes = require("./routes/botRoutes");
const pool = require("./config/db");
const axios = require("axios");
const authMiddleware = require("./middleware/auth");

const app = express();
const port = process.env.PORT || 4000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
app.set("io", io);

const usuariosConectados = new Map();
const usuariosPorEmpresa = {};

app.locals.usuariosConectados = usuariosConectados;
app.locals.usuariosPorEmpresa = usuariosPorEmpresa;

// Objeto para mantener el último índice asignado por cada empresa
const lastAssignedIndex = {};

const asignarTicketRoundRobin = async (ticket_id, empresa_id) => {
  try {
    console.log(`===== Iniciando asignación Round Robin =====`);
    console.log(`Ticket ID: ${ticket_id}, Empresa ID: ${empresa_id}`);

    // Log de usuarios por empresa
    console.log(
      `Usuarios registrados para empresa ${empresa_id}:`,
      usuariosPorEmpresa[empresa_id]?.length || 0
    );

    // Obtener agentes disponibles para esta empresa (roles 2 y 3 típicamente)
    const agentesDisponibles =
      usuariosPorEmpresa[empresa_id]?.filter((id) => {
        const socket = usuariosConectados.get(parseInt(id));
        const esAgente =
          socket && (socket.data.rol_id === 2 || socket.data.rol_id === 3);
        if (socket) {
          console.log(
            `Usuario ID ${id}, Nombre: ${socket.data.nombre}, Rol: ${socket.data.rol_id}, Es agente: ${esAgente}`
          );
        }
        return esAgente;
      }) || [];

    console.log(`Agentes disponibles: ${agentesDisponibles.length}`);

    if (agentesDisponibles.length === 0) {
      console.log(
        `⚠️ No hay agentes disponibles para la empresa ${empresa_id}`
      );
      return null;
    }

    // Inicializar el índice si no existe
    if (lastAssignedIndex[empresa_id] === undefined) {
      lastAssignedIndex[empresa_id] = -1;
      console.log(`Inicializando índice para empresa ${empresa_id}`);
    }

    // Incrementar el índice circularmente
    lastAssignedIndex[empresa_id] =
      (lastAssignedIndex[empresa_id] + 1) % agentesDisponibles.length;
    console.log(
      `Nuevo índice para empresa ${empresa_id}: ${lastAssignedIndex[empresa_id]}`
    );

    // Obtener el ID del siguiente agente
    const agenteId = parseInt(
      agentesDisponibles[lastAssignedIndex[empresa_id]]
    );
    console.log(`Agente seleccionado ID: ${agenteId}`);

    // Actualizar el ticket en la BD
    console.log(
      `Actualizando ticket ${ticket_id} con usuario_asignado_id = ${agenteId}`
    );
    await pool.query(
      `UPDATE Tickets SET usuario_asignado_id = $1 WHERE ticket_id = $2`,
      [agenteId, ticket_id]
    );

    // Verificar que la actualización fue exitosa
    const verificacion = await pool.query(
      `SELECT usuario_asignado_id FROM Tickets WHERE ticket_id = $1`,
      [ticket_id]
    );
    console.log(
      `Verificación: ticket ${ticket_id} asignado a: ${verificacion.rows[0]?.usuario_asignado_id}`
    );

    const agente = usuariosConectados.get(agenteId);
    const nombreAgente = agente?.data?.nombre || "Agente asignado";

    console.log(
      `✅ [Round Robin] Ticket ${ticket_id} asignado a ${nombreAgente} (ID: ${agenteId})`
    );

    return {
      usuario_id: agenteId,
      nombre: nombreAgente,
    };
  } catch (error) {
    console.error("❌ Error en asignación Round Robin:", error);
    return null;
  }
};

app.locals.asignarTicketRoundRobin = asignarTicketRoundRobin;
io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);

  socket.on("auth_user", (userData) => {
    const { usuario_id, empresa_id, rol_id, nombre } = userData;

    if (!usuario_id || !empresa_id) {
      return socket.emit("error", { message: "Datos de usuario incompletos" });
    }

    socket.data.usuario_id = usuario_id;
    socket.data.empresa_id = empresa_id;
    socket.data.rol_id = rol_id;
    socket.data.nombre = nombre;

    usuariosConectados.set(usuario_id, socket);

    if (!usuariosPorEmpresa[empresa_id]) {
      usuariosPorEmpresa[empresa_id] = [];
    }
    usuariosPorEmpresa[empresa_id].push(usuario_id);

    socket.join(`empresa_${empresa_id}`);

    console.log(
      `Usuario ${nombre} (ID: ${usuario_id}, Rol: ${rol_id}) autenticado para empresa ${empresa_id}`
    );

    socket.to(`empresa_${empresa_id}`).emit("usuario_conectado", {
      usuario_id,
      nombre,
      rol_id,
    });

    const usuariosEmpresa = usuariosPorEmpresa[empresa_id].map((id) => {
      const socket = usuariosConectados.get(id);
      return {
        usuario_id: id,
        nombre: socket?.data?.nombre || "Desconocido",
        rol_id: socket?.data?.rol_id || 0,
      };
    });

    socket.emit("usuarios_conectados", usuariosEmpresa);
  });

  socket.on("join_ticket", async (ticket_id) => {
    console.log(`Usuario ${socket.id} se unió al ticket ${ticket_id}`);
    socket.join(`ticket_${ticket_id}`);
  });

  socket.on("nuevo_ticket", async (data) => {
    console.log("📩 Nuevo ticket recibido:", data);
    const { ticket_id, empresa_id } = data;

    if (!ticket_id || !empresa_id) {
      console.log("⚠️ Datos incompletos para nuevo ticket");
      return;
    }

    console.log(`Procesando ticket ${ticket_id} para empresa ${empresa_id}`);

    // Asignar ticket mediante Round Robin
    const agente = await asignarTicketRoundRobin(ticket_id, empresa_id);

    if (agente) {
      // El resto del código sigue igual...
      console.log(`Notificando asignación a agente ${agente.usuario_id}`);
    } else {
      console.log("❌ No se pudo asignar el ticket a ningún agente");
    }
  });

  socket.on("send_message", async (data) => {
    const { ticket_id, usuario_id, mensaje, es_interno, empresa_id } = data;

    try {
      await pool.query(
        `INSERT INTO Mensajes (ticket_id, usuario_id, mensaje, es_interno) VALUES ($1, $2, $3, $4)`,
        [ticket_id, usuario_id, mensaje, es_interno]
      );

      const estadoResult = await pool.query(
        "SELECT estado FROM Tickets WHERE ticket_id = $1",
        [ticket_id]
      );
      const estadoTicket = estadoResult.rows[0]?.estado;
      const isAbierto = estadoTicket === 1 || estadoTicket === "1";

      io.to(`ticket_${ticket_id}`).emit("receive_message", {
        ticket_id,
        usuario_id,
        mensaje,
        es_interno,
        fecha_envio: new Date().toISOString(),
        empresa_id,
        isAbierto,
      });
      console.log(`Mensaje enviado al ticket ${ticket_id}:`, mensaje);

      const result = await pool.query(
        "SELECT bot_activo FROM Tickets WHERE ticket_id = $1",
        [ticket_id]
      );

      if (result.rows[0]?.bot_activo && !es_interno) {
        const botResponse = await axios.post(
          "http://localhost:4002/bot/generar-respuesta",
          {
            mensaje: mensaje,
            empresa_id: parseInt(empresa_id, 10),
          }
        );
        console.log(botResponse.data.response);

        io.to(`ticket_${ticket_id}`).emit("receive_message", {
          ticket_id,
          usuario_id: null, // O el id de tu usuario bot
          mensaje: botResponse.data.response,
          fecha_envio: new Date().toISOString(),
          es_interno: true,
          isAbierto,
        });

        await pool.query(
          `INSERT INTO Mensajes (ticket_id, usuario_id, mensaje, es_interno, es_bot) VALUES ($1, $2, $3, $4, $5)`,
          [ticket_id, null, botResponse.data.response, true, true]
        );
      }
    } catch (error) {
      console.error("Error al guardar el mensaje:", error);
      socket.emit("error_message", { message: "Error al guardar el mensaje" });
    }
  });

  socket.on("disconnect", () => {
    console.log("Usuario desconectado:", socket.id);

    const usuario_id = socket.data?.usuario_id;
    const empresa_id = socket.data?.empresa_id;

    if (usuario_id && empresa_id) {
      console.log(`Removiendo usuario ${usuario_id} de empresa ${empresa_id}`);

      // Eliminar de usuariosConectados
      usuariosConectados.delete(usuario_id);

      // Eliminar de usuariosPorEmpresa
      if (usuariosPorEmpresa[empresa_id]) {
        usuariosPorEmpresa[empresa_id] = usuariosPorEmpresa[empresa_id].filter(
          (id) => String(id) !== String(usuario_id)
        );
        console.log(
          `Usuarios restantes en empresa ${empresa_id}:`,
          usuariosPorEmpresa[empresa_id]
        );
      }

      // Notificar a los demás usuarios de la empresa
      io.to(`empresa_${empresa_id}`).emit("usuario_desconectado", {
        usuario_id,
        nombre: socket.data.nombre,
      });
    }
  });
});

app.use(express.json());
app.use(cors());

// Rutas
app.use("/empresas", authMiddleware, empresaRoute);
app.use("/empresaAdmin", authMiddleware, empresaSASRoute);
app.use("/usuarios", loginRoutes, usuarioRoutes);
app.use("/tickets", authMiddleware, ticketRoutes);
app.use("/paises", paisesRoutes);
app.use("/bot", botRoutes);
server.listen(port, () => {
  console.log(`Servidor iniciado en http://localhost:${port}`);
});
