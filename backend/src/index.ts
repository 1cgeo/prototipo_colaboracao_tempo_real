// Path: index.ts
import express from 'express';
import http from 'http';
import cors from 'cors';
import config from './config/env.js';
import { initializeSocketIO } from './services/socket.service.js';
import { db, initDb } from './config/database.js';
import { generateRandomName } from './utils/nameGenerator.js';
import { Rooms } from './types/index.js';
import routes from './routes/index.js';

const app = express();
app.use(
  cors({
    origin: config.cors.origin,
  }),
);
app.use(express.json());

// API routes
app.use('/api', routes);

const server = http.createServer(app);
const io = initializeSocketIO(server);

// Initialize database
initDb()
  .then(() => console.log('[SERVER] Database initialized successfully'))
  .catch(err => {
    console.error('[SERVER] Failed to initialize database:', err);
    process.exit(1); // Exit if database initialization fails
  });

// Store connected users per room
const rooms: Rooms = {};

// Socket.IO
io.on('connection', socket => {
  console.log('[SOCKET] User connected:', socket.id);
  let currentRoom: string | null = null;

  // Assign a random name to the user
  const userName = generateRandomName();
  console.log(`[SOCKET] Assigned name "${userName}" to user ${socket.id}`);

  // Join a specific map room
  socket.on('join-map', async (mapId: number) => {
    try {
      console.log(`[SOCKET] User ${socket.id} attempting to join map ${mapId}`);
      
      // Check if map exists
      const map = await db.getMap(mapId);
      if (!map) {
        console.log(`[SOCKET] Map ${mapId} not found, rejecting join request`);
        socket.emit('error', 'Map not found');
        return;
      }

      // Leave previous room if any
      if (currentRoom) {
        console.log(`[SOCKET] User ${socket.id} leaving previous room ${currentRoom}`);
        socket.leave(currentRoom);
        if (rooms[currentRoom] && rooms[currentRoom][socket.id]) {
          delete rooms[currentRoom][socket.id];
          socket.to(currentRoom).emit('user-disconnected', socket.id);
          console.log(`[SOCKET] Notified room ${currentRoom} that user ${socket.id} disconnected`);
        }
      }

      // Join new room
      currentRoom = `map-${mapId}`;
      socket.join(currentRoom);
      console.log(`[SOCKET] User ${socket.id} joined room ${currentRoom}`);

      // Initialize room if it doesn't exist
      if (!rooms[currentRoom]) {
        console.log(`[SOCKET] Creating new room ${currentRoom}`);
        rooms[currentRoom] = {};
      }

      // Add user to room with name
      rooms[currentRoom][socket.id] = {
        id: socket.id,
        name: userName,
        position: { lng: 0, lat: 0 },
      };

      // Send user details back to the client
      socket.emit('user-info', {
        id: socket.id,
        name: userName,
      });
      console.log(`[SOCKET] Sent user info to ${socket.id}`);

      // Send all users in the room to the new user
      io.to(currentRoom).emit('users', Object.values(rooms[currentRoom]));
      console.log(`[SOCKET] Sent users list to room ${currentRoom} (${Object.keys(rooms[currentRoom]).length} users)`);

      // Notify room of new user
      socket.to(currentRoom).emit('user-joined', {
        id: socket.id,
        name: userName,
        position: { lng: 0, lat: 0 },
      });
      console.log(`[SOCKET] Notified room ${currentRoom} that user ${userName} (${socket.id}) joined`);

    } catch (error) {
      console.error('[SOCKET] Error joining map:', error);
      socket.emit('error', 'Failed to join map');
    }
  });

  // Handle mouse movement
  socket.on('mousemove', (position: { lng: number; lat: number }) => {
    if (!currentRoom || !rooms[currentRoom] || !rooms[currentRoom][socket.id])
      return;

    // Only log occasionally to avoid flooding the console
    const shouldLog = Math.random() < 0.01; // Log approx. 1% of movements
    if (shouldLog) {
      console.log(`[SOCKET] User ${socket.id} moved to position: ${position.lng.toFixed(4)}, ${position.lat.toFixed(4)}`);
    }

    rooms[currentRoom][socket.id].position = position;

    // Broadcast to all clients in the room except sender
    socket.to(currentRoom).emit('user-move', {
      id: socket.id,
      name: userName,
      position,
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`[SOCKET] User ${userName} (${socket.id}) disconnected`);

    if (currentRoom && rooms[currentRoom]) {
      delete rooms[currentRoom][socket.id];
      socket.to(currentRoom).emit('user-disconnected', socket.id);
      console.log(`[SOCKET] Notified room ${currentRoom} that user ${socket.id} disconnected`);
      
      // Log remaining users in the room
      const remainingUsers = Object.keys(rooms[currentRoom]).length;
      console.log(`[SOCKET] Room ${currentRoom} now has ${remainingUsers} users`);
    }
  });
});

const PORT = config.port;
server.listen(PORT, () => {
  console.log(`[SERVER] Server running in ${config.nodeEnv} mode on port ${PORT}`);
  console.log(`[SERVER] CORS origin set to: ${config.cors.origin}`);
});