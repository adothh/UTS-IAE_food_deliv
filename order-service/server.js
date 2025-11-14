require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const swaggerUi = require('swagger-ui-express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3002;
const DB_PATH = process.env.DB_PATH || './database/orders.db';
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';

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
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      restaurant_name TEXT NOT NULL,
      items TEXT NOT NULL,
      total_price INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating table:', err.message);
    } else {
      console.log('Orders table ready');
      seedInitialData();
    }
  });
}

// Seed initial data
function seedInitialData() {
  db.get('SELECT COUNT(*) as count FROM orders', (err, row) => {
    if (err) {
      console.error('Error checking data:', err.message);
      return;
    }
    
    if (row.count === 0) {
      const initialOrders = [
        {
          user_id: 1,
          restaurant_name: 'Nasi Goreng Kambing',
          items: JSON.stringify(['Nasi Goreng Kambing', 'Es Teh Manis']),
          total_price: 45000,
          status: 'delivered'
        },
        {
          user_id: 2,
          restaurant_name: 'Ayam Geprek Bensu',
          items: JSON.stringify(['Ayam Geprek Level 5', 'Jus Alpukat']),
          total_price: 35000,
          status: 'on_delivery'
        }
      ];

      const stmt = db.prepare('INSERT INTO orders (user_id, restaurant_name, items, total_price, status) VALUES (?, ?, ?, ?, ?)');
      initialOrders.forEach(order => {
        stmt.run([order.user_id, order.restaurant_name, order.items, order.total_price, order.status]);
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
    title: 'Order Service API with SQLite',
    version: '2.0.0',
    description: 'API untuk mengelola pesanan menggunakan SQLite database'
  },
  servers: [
    { url: `http://localhost:${PORT}`, description: 'Order Service' }
  ],
  paths: {
    '/orders': {
      get: {
        summary: 'Mendapatkan semua pesanan',
        parameters: [
          {
            name: 'userId',
            in: 'query',
            schema: { type: 'integer' },
            description: 'Filter berdasarkan user ID'
          }
        ],
        responses: {
          '200': {
            description: 'Daftar pesanan berhasil diambil'
          }
        }
      },
      post: {
        summary: 'Membuat pesanan baru',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userId', 'restaurantName', 'items', 'totalPrice'],
                properties: {
                  userId: { type: 'integer', example: 1 },
                  restaurantName: { type: 'string', example: 'Sate Padang Ajo Ramon' },
                  items: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['Sate Padang', 'Lontong', 'Es Teh']
                  },
                  totalPrice: { type: 'number', example: 50000 }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Pesanan berhasil dibuat'
          }
        }
      }
    },
    '/orders/{id}': {
      get: {
        summary: 'Mendapatkan detail pesanan',
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
            description: 'Detail pesanan'
          }
        }
      },
      put: {
        summary: 'Update pesanan',
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
                  status: {
                    type: 'string',
                    enum: ['pending', 'processing', 'on_delivery', 'delivered', 'cancelled']
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Pesanan berhasil diupdate'
          }
        }
      }
    },
    '/orders/{id}/with-user': {
      get: {
        summary: 'Mendapatkan detail pesanan dengan data user (Integrasi dengan User Service)',
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
            description: 'Detail pesanan dengan informasi user'
          }
        }
      }
    }
  }
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Helper function to parse order items
function parseOrderRow(row) {
  return {
    ...row,
    items: JSON.parse(row.items),
    totalPrice: row.total_price,
    userId: row.user_id,
    restaurantName: row.restaurant_name,
    createdAt: row.created_at
  };
}

// Routes
app.get('/orders', (req, res) => {
  let query = 'SELECT * FROM orders';
  let params = [];
  
  if (req.query.userId) {
    query += ' WHERE user_id = ?';
    params.push(req.query.userId);
  }
  
  query += ' ORDER BY id DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error fetching orders',
        error: err.message
      });
    }
    
    const orders = rows.map(parseOrderRow);
    res.json({
      success: true,
      data: orders
    });
  });
});

app.get('/orders/:id', (req, res) => {
  db.get('SELECT * FROM orders WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error fetching order',
        error: err.message
      });
    }
    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'Order tidak ditemukan'
      });
    }
    
    const order = parseOrderRow(row);
    res.json({
      success: true,
      data: order
    });
  });
});

// Endpoint dengan integrasi ke User Service (Service-to-Service Communication)
app.get('/orders/:id/with-user', async (req, res) => {
  try {
    // Get order from database
    db.get('SELECT * FROM orders WHERE id = ?', [req.params.id], async (err, row) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Error fetching order',
          error: err.message
        });
      }
      if (!row) {
        return res.status(404).json({
          success: false,
          message: 'Order tidak ditemukan'
        });
      }

      const order = parseOrderRow(row);

      try {
        // Panggil User Service untuk mendapatkan data user
        const userResponse = await axios.get(`${USER_SERVICE_URL}/users/${order.userId}`);
        
        res.json({
          success: true,
          data: {
            ...order,
            userDetails: userResponse.data.data
          }
        });
      } catch (userError) {
        res.status(500).json({
          success: false,
          message: 'Gagal mengambil data user',
          error: userError.message
        });
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error processing request',
      error: error.message
    });
  }
});

app.post('/orders', (req, res) => {
  const { userId, restaurantName, items, totalPrice } = req.body;
  
  if (!userId || !restaurantName || !items || !totalPrice) {
    return res.status(400).json({
      success: false,
      message: 'Semua field wajib diisi'
    });
  }

  const itemsJson = JSON.stringify(items);
  
  db.run(
    'INSERT INTO orders (user_id, restaurant_name, items, total_price, status) VALUES (?, ?, ?, ?, ?)',
    [userId, restaurantName, itemsJson, totalPrice, 'pending'],
    function(err) {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Error creating order',
          error: err.message
        });
      }
      
      db.get('SELECT * FROM orders WHERE id = ?', [this.lastID], (err, row) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: 'Error fetching created order',
            error: err.message
          });
        }
        
        const order = parseOrderRow(row);
        res.status(201).json({
          success: true,
          data: order
        });
      });
    }
  );
});

app.put('/orders/:id', (req, res) => {
  const { status, restaurantName, items, totalPrice } = req.body;
  
  // Build dynamic update query
  let updateFields = [];
  let params = [];
  
  if (status) {
    updateFields.push('status = ?');
    params.push(status);
  }
  if (restaurantName) {
    updateFields.push('restaurant_name = ?');
    params.push(restaurantName);
  }
  if (items) {
    updateFields.push('items = ?');
    params.push(JSON.stringify(items));
  }
  if (totalPrice) {
    updateFields.push('total_price = ?');
    params.push(totalPrice);
  }
  
  if (updateFields.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Tidak ada field yang diupdate'
    });
  }
  
  params.push(req.params.id);
  const query = `UPDATE orders SET ${updateFields.join(', ')} WHERE id = ?`;
  
  db.run(query, params, function(err) {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error updating order',
        error: err.message
      });
    }
    if (this.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order tidak ditemukan'
      });
    }
    
    db.get('SELECT * FROM orders WHERE id = ?', [req.params.id], (err, row) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Error fetching updated order',
          error: err.message
        });
      }
      
      const order = parseOrderRow(row);
      res.json({
        success: true,
        data: order
      });
    });
  });
});

app.delete('/orders/:id', (req, res) => {
  db.run('DELETE FROM orders WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error deleting order',
        error: err.message
      });
    }
    if (this.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order tidak ditemukan'
      });
    }
    res.json({
      success: true,
      message: 'Order berhasil dihapus'
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
  console.log(`Order Service running on http://localhost:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
  console.log(`Swagger UI available at http://localhost:${PORT}/api-docs`);
});