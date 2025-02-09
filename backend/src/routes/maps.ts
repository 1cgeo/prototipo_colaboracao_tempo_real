import { Router } from 'express';
import * as mapController from '../controllers/mapController.js';
import * as commentController from '../controllers/commentController.js';
import * as activityController from '../controllers/activityController.js';
import {
  validateUUID,
  validateBounds,
  validateVersion,
  validatePagination,
  mapRoomValidations,
  commentValidations,
} from '../middleware/validation.js';
import { versionControl } from '../middleware/version.js';

const router = Router();

// Map room routes
router.get('/', mapController.listMapRooms);
router.post('/', mapRoomValidations.create, mapController.createMapRoom);
router.get('/:uuid', validateUUID, mapController.getMapRoom);
router.put(
  '/:uuid',
  validateUUID,
  mapRoomValidations.update,
  mapController.updateMapRoom,
);
router.delete('/:uuid', validateUUID, mapController.deleteMapRoom);

// Comment routes
router.get(
  '/:roomId/comments',
  validateUUID,
  validateBounds,
  commentController.listComments,
);

router.post(
  '/:roomId/comments',
  validateUUID,
  commentValidations.create,
  commentController.createComment,
);

router.put(
  '/:roomId/comments/:commentId',
  validateUUID,
  commentValidations.update,
  validateVersion,
  versionControl('spatial_comments'), // Adiciona controle de versão
  commentController.updateComment,
);

router.delete(
  '/:roomId/comments/:commentId',
  validateUUID,
  validateVersion,
  versionControl('spatial_comments'), // Adiciona controle de versão
  commentController.deleteComment,
);

router.post(
  '/:roomId/comments/:commentId/replies',
  validateUUID,
  commentValidations.reply,
  commentController.createReply,
);

// Activity routes
router.get(
  '/:roomId/activity',
  validateUUID,
  validatePagination,
  activityController.getActivityLog,
);

router.get(
  '/:roomId/activity/:userId',
  validateUUID,
  validatePagination,
  activityController.getUserActivity,
);

export default router;
