// src/controllers/maps.controller.ts
import { Request, Response } from 'express';
import { db } from '../config/database.js';

export const getMaps = async (_req: Request, res: Response): Promise<void> => {
  try {
    const maps = await db.getMaps();
    res.json(maps);
  } catch (error) {
    console.error('Error fetching maps:', error);
    res.status(500).json({ error: 'Failed to fetch maps' });
  }
};

export const getMap = async (req: Request, res: Response): Promise<void> => {
  try {
    const mapId = parseInt(req.params.id, 10);
    const map = await db.getMap(mapId);

    if (!map) {
      res.status(404).json({ error: 'Map not found' });
      return;
    }

    res.json(map);
  } catch (error) {
    console.error('Error fetching map:', error);
    res.status(500).json({ error: 'Failed to fetch map' });
  }
};

export const createMap = async (req: Request, res: Response): Promise<void> => {
  const { name, description } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Map name is required' });
    return;
  }

  try {
    const newMap = await db.createMap(name, description || null);
    res.status(201).json(newMap);
  } catch (error) {
    console.error('Error creating map:', error);
    res.status(500).json({ error: 'Failed to create map' });
  }
};

export const updateMap = async (req: Request, res: Response): Promise<void> => {
  const { name, description } = req.body;
  const mapId = parseInt(req.params.id, 10);

  if (!name) {
    res.status(400).json({ error: 'Map name is required' });
    return;
  }

  try {
    const updatedMap = await db.updateMap(mapId, name, description || null);

    if (!updatedMap) {
      res.status(404).json({ error: 'Map not found' });
      return;
    }

    res.json(updatedMap);
  } catch (error) {
    console.error('Error updating map:', error);
    res.status(500).json({ error: 'Failed to update map' });
  }
};

export const deleteMap = async (req: Request, res: Response): Promise<void> => {
  const mapId = parseInt(req.params.id, 10);

  try {
    const deleted = await db.deleteMap(mapId);

    if (!deleted) {
      res.status(404).json({ error: 'Map not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting map:', error);
    res.status(500).json({ error: 'Failed to delete map' });
  }
};
