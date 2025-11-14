require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const swaggerUi = require('swagger-ui-express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Service URLs from environment variables
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3002';

// Swagger Documentation untuk API Gateway
const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Food Delivery System - API Gateway',
    version: '2.0.0',
    description: 'API Gateway sebagai pintu masuk tunggal untuk Food Delivery System dengan SQLite Database'
  },
  servers: [
    { url: `http://localhost:${PORT}`, description: 'API Gateway' }
  ],
  paths: {
    '/api/users': {
      get: {
        summary: 'Get all users (via User Service)',
        tags: ['Users'],
        responses: {
          '200': { description: 'Success' }
        }
      },
      post: {
        summary: 'Create new user (via User Service)',
        tags: ['Users'],
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
          '201': { description: 'User created' }
        }
      }
    },
    '/api/users/{id}': {
      get: {
        summary: 'Get user by ID (via User Service)',
        tags: ['Users'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          '200': { description: 'Success' }
        }
      },
      put: {
        summary: 'Update user (via User Service)',
        tags: ['Users'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          '200': { description: 'User updated' }
        }
      },
      delete: {
        summary: 'Delete user (via User Service)',
        tags: ['Users'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          '200': { description: 'User deleted' }
        }
      }
    },
    '/api/orders': {
      get: {
        summary: 'Get all orders (via Order Service)',
        tags: ['Orders'],
        parameters: [
          {
            name: 'userId',
            in: 'query',
            schema: { type: 'integer' }
          }
        ],
        responses: {
          '200': { description: 'Success' }
        }
      },
      post: {
        summary: 'Create new order (via Order Service)',
        tags: ['Orders'],
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
          '201': { description: 'Order created' }
        }
      }
    },
    '/api/orders/{id}': {
      get: {
        summary: 'Get order by ID (via Order Service)',
        tags: ['Orders'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          '200': { description: 'Success' }
        }
      },
      put: {
        summary: 'Update order status (via Order Service)',
        tags: ['Orders'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          '200': { description: 'Order updated' }
        }
      }
    },
    '/api/orders/{id}/with-user': {
      get: {
        summary: 'Get order with user details (Service Integration)',
        tags: ['Orders'],
        description: 'Endpoint ini mendemonstrasikan komunikasi antar service (Order Service memanggil User Service)',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          '200': { description: 'Order with user details' }
        }
      }
    }
  }
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Middleware untuk logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health Check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API Gateway is running',
    timestamp: new Date().toISOString(),
    services: {
      userService: USER_SERVICE_URL,
      orderService: ORDER_SERVICE_URL
    }
  });
});

// ===== USER SERVICE ROUTES =====
app.get('/api/users', async (req, res) => {
  try {
    const response = await axios.get(`${USER_SERVICE_URL}/users`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const response = await axios.get(`${USER_SERVICE_URL}/users/${req.params.id}`);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const response = await axios.post(`${USER_SERVICE_URL}/users`, req.body);
    res.status(201).json(response.data);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating user',
      error: error.message
    });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const response = await axios.put(`${USER_SERVICE_URL}/users/${req.params.id}`, req.body);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message
    });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const response = await axios.delete(`${USER_SERVICE_URL}/users/${req.params.id}`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
});

// ===== ORDER SERVICE ROUTES =====
app.get('/api/orders', async (req, res) => {
  try {
    const response = await axios.get(`${ORDER_SERVICE_URL}/orders`, {
      params: req.query
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching orders',
      error: error.message
    });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const response = await axios.get(`${ORDER_SERVICE_URL}/orders/${req.params.id}`);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      message: 'Error fetching order',
      error: error.message
    });
  }
});

app.get('/api/orders/:id/with-user', async (req, res) => {
  try {
    const response = await axios.get(`${ORDER_SERVICE_URL}/orders/${req.params.id}/with-user`);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      message: 'Error fetching order with user',
      error: error.message
    });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const response = await axios.post(`${ORDER_SERVICE_URL}/orders`, req.body);
    res.status(201).json(response.data);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating order',
      error: error.message
    });
  }
});

app.put('/api/orders/:id', async (req, res) => {
  try {
    const response = await axios.put(`${ORDER_SERVICE_URL}/orders/${req.params.id}`, req.body);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating order',
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`API Gateway running on http://localhost:${PORT}`);
  console.log(`Swagger UI available at http://localhost:${PORT}/api-docs`);
  console.log(`Connected to services:`);
  console.log(`  - User Service: ${USER_SERVICE_URL}`);
  console.log(`  - Order Service: ${ORDER_SERVICE_URL}`);
});