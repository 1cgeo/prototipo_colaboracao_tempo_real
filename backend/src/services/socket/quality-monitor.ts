// Path: services\socket\quality-monitor.ts

import { Socket } from 'socket.io';
import { SocketUser } from '@/types/socket.js';

// We define our own Connection Quality type internally
type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'critical';

interface ConnectionStats {
  latency: number[];
  latencyAvg: number;
  latencyMax: number;
  packetLoss: number;
  connectionQuality: ConnectionQuality;
  lastCheck: number;
  samples: number;
  checkInterval: NodeJS.Timeout | null;
  lastActive: number; // Timestamp when this connection was last active
}

// Configuration constants
const STATS_MAX_SAMPLES = 10;          // Number of latency samples to keep
const LATENCY_CHECK_INTERVAL = 15000;  // Check latency every 15 seconds
const STATS_TTL = 30 * 60 * 1000;      // 30 minutes TTL for connection stats
const STATS_CLEANUP_INTERVAL = 5 * 60 * 1000; // Cleanup every 5 minutes
const MAX_STATS_ENTRIES = 5000;        // Maximum number of stats entries to store
const LATENCY_THRESHOLDS = {
  excellent: 100,  // < 100ms
  good: 300,       // < 300ms
  poor: 1000       // < 1000ms
  // > 1000ms is considered critical
};

// Store connection stats for each client
const connectionStats: Record<string, ConnectionStats> = {};

// Setup cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Setup connection quality monitoring for a socket
 */
export function setupConnectionMonitor(socket: Socket, user: SocketUser): void {
  // Initialize stats for this user
  connectionStats[user.id] = {
    latency: [],
    latencyAvg: 0,
    latencyMax: 0,
    packetLoss: 0,
    connectionQuality: 'excellent',
    lastCheck: Date.now(),
    samples: 0,
    checkInterval: null,
    lastActive: Date.now()
  };
  
  console.log(`[CONNECTION] Starting quality monitoring for user ${user.id}`);
  
  // Setup global cleanup if not already running
  if (!cleanupInterval) {
    cleanupInterval = setInterval(() => {
      cleanupStaleStats();
    }, STATS_CLEANUP_INTERVAL);
    
    console.log('[CONNECTION] Started global stats cleanup interval');
  }
  
  // Setup ping interval to measure latency
  const checkInterval = setInterval(() => {
    checkConnectionQuality(socket, user.id);
  }, LATENCY_CHECK_INTERVAL);
  
  connectionStats[user.id].checkInterval = checkInterval;
  
  // Handle response to latency check
  socket.on('latency-check-response', (data: { id: number, clientReceivedAt: number }) => {
    const now = Date.now();
    const roundTripTime = now - data.id;
    
    // Store latency sample
    updateLatencyStats(user.id, roundTripTime);
    
    // Calculate and assess connection quality
    assessConnectionQuality(socket, user.id);
  });
  
  // Handle explicit quality reports from client
  socket.on('connection-quality-report', (report: { 
    latency?: number,
    bandwidthEstimate?: number,
    signalStrength?: number,
    connectionType?: string,
    networkType?: string
  }) => {
    console.log(`[CONNECTION] Received quality report from ${user.id}:`, report);
    
    // Update stats with client-reported metrics if available
    if (report.latency) {
      updateLatencyStats(user.id, report.latency);
      assessConnectionQuality(socket, user.id);
    }
  });
  
  // Clean up on disconnect
  socket.on('disconnect', () => {
    if (connectionStats[user.id]) {
      const interval = connectionStats[user.id].checkInterval;
      if (interval) {
        clearInterval(interval);
        connectionStats[user.id].checkInterval = null;
      }
      
      // We don't immediately delete the stats to allow for reconnection
      // They will be cleaned up by the global cleanup if not reconnected
    }
  });
  
  // Perform initial check
  setTimeout(() => {
    checkConnectionQuality(socket, user.id);
  }, 5000); // Wait 5 seconds after connection to do first check
}

/**
 * Send a latency check request to the client
 */
function checkConnectionQuality(socket: Socket, userId: string): void {
  if (!connectionStats[userId]) return;
  
  const timestamp = Date.now();
  connectionStats[userId].lastCheck = timestamp;
  connectionStats[userId].lastActive = timestamp;
  
  // Send ping with current timestamp as ID
  socket.emit('latency-check', { id: timestamp });
}

/**
 * Update latency statistics for a user
 */
function updateLatencyStats(userId: string, latency: number): void {
  if (!connectionStats[userId]) return;
  
  const stats = connectionStats[userId];
  stats.lastActive = Date.now();
  
  // Add latency sample
  stats.latency.push(latency);
  stats.samples++;
  
  // Keep only the last N samples
  if (stats.latency.length > STATS_MAX_SAMPLES) {
    stats.latency.shift();
  }
  
  // Calculate average and max
  stats.latencyAvg = stats.latency.reduce((sum, val) => sum + val, 0) / stats.latency.length;
  stats.latencyMax = Math.max(...stats.latency);
  
  console.log(`[CONNECTION] User ${userId} latency: ${latency}ms (avg: ${stats.latencyAvg.toFixed(1)}ms, max: ${stats.latencyMax}ms)`);
}

/**
 * Assess connection quality based on collected metrics
 */
function assessConnectionQuality(socket: Socket, userId: string): void {
  if (!connectionStats[userId]) return;
  
  const stats = connectionStats[userId];
  stats.lastActive = Date.now();
  
  // Need at least 3 samples for reliable assessment
  if (stats.samples < 3) return;
  
  // Determine connection quality
  let newQuality: ConnectionQuality;
  
  if (stats.latencyAvg < LATENCY_THRESHOLDS.excellent) {
    newQuality = 'excellent';
  } else if (stats.latencyAvg < LATENCY_THRESHOLDS.good) {
    newQuality = 'good';
  } else if (stats.latencyAvg < LATENCY_THRESHOLDS.poor) {
    newQuality = 'poor';
  } else {
    newQuality = 'critical';
  }
  
  // Only emit if quality changed
  if (newQuality !== stats.connectionQuality) {
    stats.connectionQuality = newQuality;
    
    console.log(`[CONNECTION] User ${userId} connection quality changed to: ${newQuality}`);
    
    // Notify client about connection quality
    socket.emit('connection-quality', {
      quality: newQuality,
      latency: stats.latencyAvg,
      timestamp: Date.now()
    });
    
    // Adapt server behavior based on connection quality
    applyAdaptiveSettings(socket, newQuality);
  }
}

/**
 * Apply adaptive settings based on connection quality
 */
function applyAdaptiveSettings(socket: Socket, quality: ConnectionQuality): void {
  // Suggest client-side adaptations
  const adaptations: Record<string, any> = {};
  
  switch (quality) {
    case 'excellent':
      // Default settings - full quality
      adaptations.batchInterval = 0;       // Real-time updates
      adaptations.compressionLevel = 0;    // No compression
      adaptations.reducedPrecision = false;
      adaptations.loadFullMap = true;
      break;
      
    case 'good':
      // Minor optimizations
      adaptations.batchInterval = 1000;    // Batch updates every 1 second
      adaptations.compressionLevel = 1;    // Low compression
      adaptations.reducedPrecision = false;
      adaptations.loadFullMap = true;
      break;
      
    case 'poor':
      // Significant optimizations
      adaptations.batchInterval = 3000;    // Batch updates every 3 seconds
      adaptations.compressionLevel = 2;    // Medium compression
      adaptations.reducedPrecision = true; // Reduce coordinate precision
      adaptations.loadFullMap = false;     // Only load viewport
      break;
      
    case 'critical':
      // Maximum optimizations
      adaptations.batchInterval = 5000;    // Batch updates every 5 seconds
      adaptations.compressionLevel = 3;    // High compression
      adaptations.reducedPrecision = true; // Reduce coordinate precision
      adaptations.loadFullMap = false;     // Only load viewport
      adaptations.disableRealtime = true;  // Disable real-time updates
      break;
  }
  
  // Send adaptive settings to client
  socket.emit('adaptive-settings', {
    quality,
    adaptations,
    timestamp: Date.now()
  });
}

/**
 * Clean up stale connection statistics
 */
function cleanupStaleStats(): void {
  const now = Date.now();
  let cleanupCount = 0;
  
  // Remove stats that haven't been active in the TTL window
  for (const userId in connectionStats) {
    const stats = connectionStats[userId];
    
    if (now - stats.lastActive > STATS_TTL) {
      // Stop any running interval
      if (stats.checkInterval) {
        clearInterval(stats.checkInterval);
      }
      
      delete connectionStats[userId];
      cleanupCount++;
    }
  }
  
  // If we still have too many entries, remove oldest ones
  if (Object.keys(connectionStats).length > MAX_STATS_ENTRIES) {
    const userIds = Object.keys(connectionStats).sort(
      (a, b) => connectionStats[a].lastActive - connectionStats[b].lastActive
    );
    
    // Calculate how many to remove
    const removeCount = userIds.length - MAX_STATS_ENTRIES;
    
    // Remove oldest entries
    for (let i = 0; i < removeCount; i++) {
      const userId = userIds[i];
      const stats = connectionStats[userId];
      
      // Stop any running interval
      if (stats.checkInterval) {
        clearInterval(stats.checkInterval);
      }
      
      delete connectionStats[userId];
      cleanupCount++;
    }
  }
  
  if (cleanupCount > 0) {
    console.log(`[CONNECTION] Cleaned up ${cleanupCount} stale connection statistics`);
    console.log(`[CONNECTION] Current stats entries: ${Object.keys(connectionStats).length}`);
  }
}