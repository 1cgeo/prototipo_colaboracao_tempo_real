import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { CreateMapRoomRequestSchema } from '../types/index.js';
import logger from '../utils/logger.js';
import { MapService } from '../services/mapService.js';

const mapService = new MapService();

export const listMapRooms = asyncHandler(
  async (_req: Request, res: Response) => {
    const rooms = await mapService.listMapRooms();

    res.json({
      status: 'success',
      data: rooms,
    });
  },
);

export const createMapRoom = asyncHandler(
  async (req: Request, res: Response) => {
    const data = CreateMapRoomRequestSchema.parse(req.body);
    const room = await mapService.createMapRoom(data);

    logger.info(`Created new map room: ${room.uuid}`);

    res.status(201).json({
      status: 'success',
      data: room,
    });
  },
);

export const getMapRoom = asyncHandler(async (req: Request, res: Response) => {
  const { uuid } = req.params;
  const roomDetails = await mapService.getMapRoom(uuid);

  res.json({
    status: 'success',
    data: roomDetails,
  });
});

export const updateMapRoom = asyncHandler(
  async (req: Request, res: Response) => {
    const { uuid } = req.params;
    const data = CreateMapRoomRequestSchema.parse(req.body);
    const room = await mapService.updateMapRoom(uuid, data);

    logger.info(`Updated map room: ${uuid}`);

    res.json({
      status: 'success',
      data: room,
    });
  },
);

export const deleteMapRoom = asyncHandler(
  async (req: Request, res: Response) => {
    const { uuid } = req.params;
    await mapService.deleteMapRoom(uuid);

    logger.info(`Deleted map room: ${uuid}`);

    res.json({
      status: 'success',
      message: 'Map room deleted successfully',
    });
  },
);
