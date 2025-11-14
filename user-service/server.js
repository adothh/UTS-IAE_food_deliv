require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || './database/users.db';

app.use(cors());
app.use(express.json());

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize SQLite Database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database:', DB_PATH);
    initializeDatabase();
  }
});

// Create tables and seed initial data
function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating table:', err.message);
    } else {
      console.log('Users table ready');
      seedInitialData();
    }
  });
}

// Seed initial data
function seedInitialData() {
  db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
    if (err) {
      console.error('Error checking data:', err.message);
      return;
    }
    
    if (row.count === 0) {
      const initialUsers = [
        { name: 'John Doe', email: 'john@example.com', phone: '081234567890', address: 'Jl. Sudirman No. 1, Jakarta' },
        { name: 'Jane Smith', email: 'jane@example.com', phone: '081234567891', address: 'Jl. Thamrin No. 2, Jakarta' }
      ];

      const stmt = db.prepare('INSERT INTO users (name, email, phone, address) VALUES (?, ?, ?, ?)');
      initialUsers.forEach(user => {
        stmt.run([user.name, user.email, user.phone, user.address]);
      });
      stmt.finalize();
      console.log('Initial data seeded');
    }
  });
}

// Swagger Documentation
const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'User Service API with SQLite',
    version: '2.0.0',
    description: 'API untuk mengelola data pengguna menggunakan SQLite database'
  },
  servers: [
    { url: `http://localhost:${PORT}`, description: 'User Service' }
  ],
  paths: {
    '/users': {
      get: {
        summary: 'Mendapatkan semua pengguna',
        responses: {
          '200': {
            description: 'Daftar pengguna berhasil diambil'
          }
        }
      },
      post: {
        summary: 'Membuat pengguna baru',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'phone', 'address'],
                properties: {
                  name: { type: 'string', example: 'Budi Santoso' },
                  email: { type: 'string', example: 'budi@example.com' },
                  phone: { type: 'string', example: '081234567892' },
                  address: { type: 'string', example: 'Jl. Gatot Subroto No. 10, Jakarta' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Pengguna berhasil dibuat'
          }
        }
      }
    },
    '/users/{id}': {
      get: {
        summary: 'Mendapatkan pengguna berdasarkan ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          '200': {
            description: 'Detail pengguna'
          },
          '404': {
            description: 'Pengguna tidak ditemukan'
          }
        }
      },
      put: {
        summary: 'Update pengguna',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  phone: { type: 'string' },
                  address: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Pengguna berhasil diupdate'
          }
        }
      },
      delete: {
        summary: 'Hapus pengguna',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          '200': {
            description: 'Pengguna berhasil dihapus'
          }
        }
      }
    }
  }
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes
app.get('/users', (req, res) => {
  db.all('SELECT * FROM users ORDER BY id', [], (err, rows) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error fetching users',
        error: err.message
      });
    }
    res.json({
      success: true,
      data: rows
    });
  });
});

app.get('/users/:id', (req, res) => {
  db.get('SELECT * FROM users WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error fetching user',
        error: err.message
      });
    }
    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan'
      });
    }
    res.json({
      success: true,
      data: row
    });
  });
});

app.post('/users', (req, res) => {
  const { name, email, phone, address } = req.body;
  
  if (!name || !email || !phone || !address) {
    return res.status(400).json({
      success: false,
      message: 'Semua field wajib diisi'
    });
  }

  db.run(
    'INSERT INTO users (name, email, phone, address) VALUES (?, ?, ?, ?)',
    [name, email, phone, address],
    function(err) {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Error creating user',
          error: err.message
        });
      }
      
      db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (err, row) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: 'Error fetching created user',
            error: err.message
          });
        }
        res.status(201).json({
          success: true,
          data: row
        });
      });
    }
  );
});

app.put('/users/:id', (req, res) => {
  const { name, email, phone, address } = req.body;
  
  db.run(
    'UPDATE users SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?',
    [name, email, phone, address, req.params.id],
    function(err) {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Error updating user',
          error: err.message
        });
      }
      if (this.changes === 0) {
        return res.status(404).json({
          success: false,
          message: 'User tidak ditemukan'
        });
      }
      
      db.get('SELECT * FROM users WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: 'Error fetching updated user',
            error: err.message
          });
        }
        res.json({
          success: true,
          data: row
        });
      });
    }
  );
});

app.delete('/users/:id', (req, res) => {
  db.run('DELETE FROM users WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error deleting user',
        error: err.message
      });
    }
    if (this.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan'
      });
    }
    res.json({
      success: true,
      message: 'User berhasil dihapus'
    });
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log(`User Service running on http://localhost:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
  console.log(`Swagger UI available at http://localhost:${PORT}/api-docs`);
});