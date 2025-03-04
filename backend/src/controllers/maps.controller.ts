// Path: controllers\maps.controller.ts
import { Request, Response } from 'express';
import { db } from '../config/database.js';

export const getMaps = async (_req: Request, res: Response): Promise<void> => {
  try {
    console.log('[API] Fetching all maps');
    const maps = await db.getMaps();
    console.log(`[API] Found ${maps.length} maps`);
    res.json(maps);
  } catch (error) {
    console.error('[API] Error fetching maps:', error);
    res.status(500).json({ error: 'Failed to fetch maps' });
  }
};

export const getMap = async (req: Request, res: Response): Promise<void> => {
  try {
    const mapId = parseInt(req.params.id, 10);
    console.log(`[API] Fetching map ${mapId}`);
    
    const map = await db.getMap(mapId);

    if (!map) {
      console.log(`[API] Map ${mapId} not found`);
      res.status(404).json({ error: 'Map not found' });
      return;
    }

    console.log(`[API] Map ${mapId} found: ${map.name}`);
    res.json(map);
  } catch (error) {
    console.error('[API] Error fetching map:', error);
    res.status(500).json({ error: 'Failed to fetch map' });
  }
};

export const createMap = async (req: Request, res: Response): Promise<void> => {
  const { name, description } = req.body;
  console.log(`[API] Creating new map: "${name}"`);
  
  if (!name) {
    console.log('[API] Map creation failed: Name is required');
    res.status(400).json({ error: 'Map name is required' });
    return;
  }

  try {
    const newMap = await db.createMap(name, description || null);
    console.log(`[API] Map created successfully with ID ${newMap.id}`);
    res.status(201).json(newMap);
  } catch (error) {
    console.error('[API] Error creating map:', error);
    res.status(500).json({ error: 'Failed to create map' });
  }
};

export const updateMap = async (req: Request, res: Response): Promise<void> => {
  const { name, description } = req.body;
  const mapId = parseInt(req.params.id, 10);
  console.log(`[API] Updating map ${mapId} with name: "${name}"`);

  if (!name) {
    console.log('[API] Map update failed: Name is required');
    res.status(400).json({ error: 'Map name is required' });
    return;
  }

  try {
    const updatedMap = await db.updateMap(mapId, name, description || null);

    if (!updatedMap) {
      console.log(`[API] Map update failed: Map ${mapId} not found`);
      res.status(404).json({ error: 'Map not found' });
      return;
    }

    console.log(`[API] Map ${mapId} updated successfully`);
    res.json(updatedMap);
  } catch (error) {
    console.error('[API] Error updating map:', error);
    res.status(500).json({ error: 'Failed to update map' });
  }
};

export const deleteMap = async (req: Request, res: Response): Promise<void> => {
  const mapId = parseInt(req.params.id, 10);
  console.log(`[API] Deleting map ${mapId}`);

  try {
    const deleted = await db.deleteMap(mapId);

    if (!deleted) {
      console.log(`[API] Map deletion failed: Map ${mapId} not found`);
      res.status(404).json({ error: 'Map not found' });
      return;
    }

    console.log(`[API] Map ${mapId} deleted successfully`);
    res.status(204).send();
  } catch (error) {
    console.error('[API] Error deleting map:', error);
    res.status(500).json({ error: 'Failed to delete map' });
  }
};