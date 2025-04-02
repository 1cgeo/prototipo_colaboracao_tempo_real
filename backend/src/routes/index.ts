// Path: routes\index.ts

import express from 'express';
import * as mapsController from '../controllers/maps.controller.js';
import * as featureHistoryController from '../controllers/feature-history.controller.js';
import * as syncController from '../controllers/sync.controller.js';
import * as batchController from '../controllers/batch.controller.js';

const router = express.Router();

// Maps routes
router.get('/maps', mapsController.getMaps);
router.get('/maps/:id', mapsController.getMap);
router.post('/maps', mapsController.createMap);
router.put('/maps/:id', mapsController.updateMap);
router.delete('/maps/:id', mapsController.deleteMap);

// Feature history routes
router.get('/features/:id/history', featureHistoryController.getFeatureHistory);
router.get('/maps/:mapId/history', featureHistoryController.getMapHistory);

router.get('/maps/:mapId/sync', syncController.getMapUpdates);
router.get('/features/:id/sync', syncController.getFeatureUpdates);

router.post('/maps/:mapId/batch', batchController.processBatchOperations);

export default router;