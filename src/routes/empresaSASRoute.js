// routes/empresaRoutes.js
const express = require('express');
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const router = express.Router();
const authMiddleware = require("../middleware/auth")

// Crear una nueva empresa
router.post('/registrarEmpresa', async (req, res) => {
  const { nombre, email, direccion, telefono, password, nombreUsuario, apellido } = req.body;

  try {
    const existingCompany = await pool.query('SELECT * FROM Empresas WHERE nombre = $1', [nombre]);

    if (existingCompany.rows.length > 0) {
      return res.status(400).json({ error: 'El nombre de la empresa ya está registrado.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO Empresas (nombre, email, direccion, telefono, password) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nombre, email, direccion, telefono, hashedPassword]
    );

    const nuevaEmpresa = result.rows[0];

    // Crear usuario administrador
    await pool.query(
      `INSERT INTO Usuarios (nombre, apellido, email, password, empresa_id, rol_id) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [nombreUsuario, apellido, email, hashedPassword, nuevaEmpresa.empresa_id, 2] // rol_id = 2
    );

    res.status(201).json({ empresa: nuevaEmpresa, mensaje: 'Empresa y usuario administrador creados correctamente' });
  } catch (err) {
    console.error('Error al registrar la empresa:', err);
    res.status(500).json({ error: 'Error al registrar la empresa' });
  }
});

// Obtener todas las empresas junto con la cantidad de usuarios registrados
router.get('/getAllempresas', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, COUNT(u.usuario_id) as total_usuarios
      FROM Empresas e
       LEFT JOIN Usuarios u ON e.empresa_id = u.empresa_id
       GROUP BY e.empresa_id
     `);
     res.json(result.rows);
 } catch (err) {
    console.error('Error al obtener las empresas:', err);
    res.status(500).json({ error: 'Error al obtener las empresas' });
   }
 });

// Actualizar una empresa por ID
router.put('/actEmpresas/:id',authMiddleware , async (req, res) => {
  const { id } = req.params;
  const { nombre, direccion, telefono, email } = req.body;

  try {
    const result = await pool.query(
      'UPDATE Empresas SET nombre = $1, direccion = $2, telefono = $3, email = $4 WHERE empresa_id = $5 RETURNING *',
      [nombre, direccion, telefono, email, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al actualizar la empresa:', err);
    res.status(500).json({ error: 'Error al actualizar la empresa' });
  }
});

router.put('/habilitarDeshabilitar/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { habilitado } = req.body; // Espera un booleano o 0/1 desde el frontend

  try {
    // Actualiza el estado de habilitado en la empresa específica
    const result = await pool.query('UPDATE Empresas SET habilitado = $1 WHERE empresa_id = $2 RETURNING *', [habilitado, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Empresa no encontrada' });
    }

    res.status(200).json({ message: `Empresa ${habilitado ? 'habilitada' : 'deshabilitada'} con éxito` });
  } catch (error) {
    console.error('Error al cambiar el estado de la empresa:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});


 // Obtener los datos de una empresa por ID
router.get('/empresasById/:id',authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'SELECT nombre, direccion, telefono, password, email FROM Empresas WHERE empresa_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al obtener la empresa:', err);
    res.status(500).json({ error: 'Error al obtener la empresa' });
  }
});



// Obtener los datos de clientes de esa empresa
router.get('/getEmpresas/:id/usuarios',authMiddleware , async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM Usuarios WHERE empresa_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }
    console.log(result.rows)
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener la empresa:', err);
    res.status(500).json({ error: 'Error al obtener la empresa' });
  }
});

router.post('/registrarUsuario', authMiddleware, async (req, res) => {
  const { nombre,apellido, email, password,empresa_id, numero, pais, provincia, domicilio, usuario  } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO Usuarios (nombre,apellido, email, password,empresa_id, numero, pais, provincia, domicilio, usuario, rol_id) VALUES ($1, $2, $3, $4,$5,$6,$7,$8,$9,$10,2) RETURNING *`,
      [nombre,apellido, email, hashedPassword, empresa_id, numero, pais, provincia, domicilio, usuario]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al registrar el administrador:', err);
    res.status(500).json({ error: 'Error al registrar el administrador' });
  }
});

router.get('/getAllUsuarios', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM Usuarios`);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener los usuarios:', err);
    res.status(500).json({ error: 'Error al obtener los usuarios' });
  }
});

router.put('/actUsuarios/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { nombre,apellido, email, password, empresa_id, numero, pais, provincia, domicilio, usuario } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'UPDATE Usuarios SET nombre = $1,apellido = $2, email = $3, password = $4, empresa_id = $5, numero = $6, pais = $7, provincia = $8, domicilio = $9, usuario = $10 WHERE usuario_id = $11 RETURNING *',
      [nombre,apellido, email, hashedPassword, empresa_id, numero, pais, provincia, domicilio, usuario, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al actualizar el usuario:', err);
    res.status(500).json({ error: 'Error al actualizar el usuario' });
  }
});

router.delete('/deleteUsuario/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM Usuarios WHERE usuario_id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al eliminar el usuario:', err);
    res.status(500).json({ error: 'Error al eliminar el usuario' });
  }
});


// router.get('/', async (req,res) =>{
//   const result = await pool.query("SELECT * FROM Empresas")
//   res.json(result.rows)
// })


module.exports = router;
