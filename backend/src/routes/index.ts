// routes/index.ts

import express from 'express';
import * as mapsController from '../controllers/maps.controller.js';
import * as featureHistoryController from '../controllers/feature-history.controller.js';

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

export default router;