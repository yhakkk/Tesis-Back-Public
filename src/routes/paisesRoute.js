const express = require('express');
const pool = require('../config/db');



const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM paises`);
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener los paises:', err);
        res.status(500).json({ error: 'Error al obtener los paises' });
    }
    }
);

router.get('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(`SELECT * FROM paises WHERE id = $1`, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pais no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error al obtener el pais:', err);
        res.status(500).json({ error: 'Error al obtener el pais' });
    }
}


);

module.exports = router;