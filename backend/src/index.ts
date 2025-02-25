// src/server.ts
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
initDb().catch(err => console.error('Failed to initialize database:', err));

// Store connected users per room
const rooms: Rooms = {};

// Socket.IO
io.on('connection', socket => {
  console.log('User connected:', socket.id);
  let currentRoom: string | null = null;

  // Assign a random name to the user
  const userName = generateRandomName();

  // Join a specific map room
  socket.on('join-map', async (mapId: number) => {
    try {
      // Check if map exists
      const map = await db.getMap(mapId);
      if (!map) {
        socket.emit('error', 'Map not found');
        return;
      }

      // Leave previous room if any
      if (currentRoom) {
        socket.leave(currentRoom);
        if (rooms[currentRoom] && rooms[currentRoom][socket.id]) {
          delete rooms[currentRoom][socket.id];
          socket.to(currentRoom).emit('user-disconnected', socket.id);
        }
      }

      // Join new room
      currentRoom = `map-${mapId}`;
      socket.join(currentRoom);

      // Initialize room if it doesn't exist
      if (!rooms[currentRoom]) {
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

      // Send all users in the room to the new user
      io.to(currentRoom).emit('users', Object.values(rooms[currentRoom]));

      // Notify room of new user
      socket.to(currentRoom).emit('user-joined', {
        id: socket.id,
        name: userName,
        position: { lng: 0, lat: 0 },
      });

      console.log(`User ${userName} (${socket.id}) joined map ${mapId}`);
    } catch (error) {
      console.error('Error joining map:', error);
      socket.emit('error', 'Failed to join map');
    }
  });

  // Handle mouse movement
  socket.on('mousemove', (position: { lng: number; lat: number }) => {
    if (!currentRoom || !rooms[currentRoom] || !rooms[currentRoom][socket.id])
      return;

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
    console.log(`User ${userName} (${socket.id}) disconnected`);

    if (currentRoom && rooms[currentRoom]) {
      delete rooms[currentRoom][socket.id];
      socket.to(currentRoom).emit('user-disconnected', socket.id);
    }
  });
});

const PORT = config.port;
server.listen(PORT, () => {
  console.log(`Server running in ${config.nodeEnv} mode on port ${PORT}`);
});
