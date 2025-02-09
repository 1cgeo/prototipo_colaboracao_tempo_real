import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { ActivityService } from '../services/activityService.js';

const activityService = new ActivityService();

export const getActivityLog = asyncHandler(
  async (req: Request, res: Response) => {
    const { roomId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const before = req.query.before as string;

    const activities = await activityService.getActivityLog(
      roomId,
      limit,
      before ? new Date(before) : undefined,
    );

    res.json({
      status: 'success',
      data: activities,
    });
  },
);

export const getUserActivity = asyncHandler(
  async (req: Request, res: Response) => {
    const { roomId, userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const before = req.query.before as string;

    const activities = await activityService.getUserActivity(
      roomId,
      userId,
      limit,
      before ? new Date(before) : undefined,
    );

    res.json({
      status: 'success',
      data: activities,
    });
  },
);
