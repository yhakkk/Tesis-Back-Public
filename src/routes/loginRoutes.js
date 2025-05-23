const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const router = express.Router();

// Endpoint de login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Buscar al usuario por su email
    const result = await pool.query(
      `SELECT u.*
FROM Usuarios u 
WHERE u.email = $1;
`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Usuario no encontrado" });
    }

    const user = result.rows[0];

    // Verificar la contraseña
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ error: "Contraseña incorrecta" });
    }

    // Crear y firmar un token JWT
    const token = jwt.sign(
      {
        id: user.usuario_id,
        email: user.email,
        empresa_id: user.empresa_id,
        role: user.rol_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ token });
  } catch (err) {
    console.error("Error en el login:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

router.post("/token", async (req, res) => {
  const { token } = req.body;

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query(
      `SELECT u.*, e.telefono as empresa_telefono, e.email as empresa_email, e.habilitado as empresa_habilitado, e.nombre, e.direccion
      FROM Usuarios u
      LEFT JOIN Empresas e ON u.empresa_id = e.empresa_id
      WHERE u.usuario_id = $1`,
      [payload.id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Usuario no encontrado" });
    }

    const user = result.rows[0];

    res.json({
      id: user.usuario_id,
      user: user.usuario,
      email: user.email,
      empresa_id: user.empresa_id,
      numero: user.numero,
      role: user.rol_id,
      pais: user.pais,
      provincia: user.provincia,
      domicilio: user.domicilio,
      empresa:{
        id:user.empresa_id,
        nombre:user.nombre,
        direccion:user.direccion,
        telefono:user.empresa_telefono,
        email:user.empresa_email,
        habilitado:user.empresa_habilitado,
      }
    });
  } catch (err) {
    console.error("Error en el token:", err);
    res.status(401).json({ error: "Token inválido" });
  }
});

module.exports = router;
