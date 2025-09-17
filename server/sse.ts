import { Express, Response } from 'express';

// SSE connections map to track analysis sessions
export const sseConnections = new Map<string, Response>();

export function registerSseRoute(app: Express) {
  app.get('/api/analysis/:id/events', (req, res) => {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
    
    // Flush headers immediately
    res.flushHeaders?.();
    
    const analysisId = req.params.id;
    sseConnections.set(analysisId, res);
    
    // Send connection confirmation
    res.write(': SSE connection established\n\n');
    
    // Keep connection alive with periodic pings
    const pingInterval = setInterval(() => {
      if (!res.destroyed) {
        res.write(': ping\n\n');
      } else {
        clearInterval(pingInterval);
      }
    }, 25000);
    
    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(pingInterval);
      sseConnections.delete(analysisId);
      res.end();
    });
    
    req.on('error', () => {
      clearInterval(pingInterval);
      sseConnections.delete(analysisId);
      res.end();
    });
  });
}