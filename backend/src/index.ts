import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Agent Trust Layer Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Root Info Endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Agent Trust Layer API',
    description: 'Policy & Audit Engine for LLM Purchasing Agents',
    endpoints: {
      health: '/health',
      policy: '/api/v1/policy',
      audit: '/api/v1/audit',
    },
  });
});

app.listen(PORT, () => {
  console.log(`[Agent Trust Layer] Server running on http://localhost:${PORT}`);
});
