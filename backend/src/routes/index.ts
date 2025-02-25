// src/routes/index.ts
import express from 'express';
import * as mapsController from '../controllers/maps.controller.js';
import * as commentsController from '../controllers/comments.controller.js';
import * as repliesController from '../controllers/replies.controller.js';

const router = express.Router();

// Maps routes
router.get('/maps', mapsController.getMaps);
router.get('/maps/:id', mapsController.getMap);
router.post('/maps', mapsController.createMap);
router.put('/maps/:id', mapsController.updateMap);
router.delete('/maps/:id', mapsController.deleteMap);

// Comments routes
router.get('/maps/:mapId/comments', commentsController.getMapComments);
router.post('/comments', commentsController.createComment);
router.put('/comments/:id', commentsController.updateComment);
router.put('/comments/:id/position', commentsController.updateCommentPosition);
router.delete('/comments/:id', commentsController.deleteComment);

// Replies routes
router.post('/replies', repliesController.createReply);
router.put('/replies/:id', repliesController.updateReply);
router.delete('/replies/:id', repliesController.deleteReply);

export default router;
