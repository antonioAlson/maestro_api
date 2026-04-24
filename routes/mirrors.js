import express from 'express';
import { getProjects, generateOS } from '../controllers/mirrorsController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.get('/projects', authenticate, getProjects);
router.post('/generate-os', authenticate, generateOS);

export default router;
