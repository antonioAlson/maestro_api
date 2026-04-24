import express from 'express';
import { upload } from '../middleware/upload.js';
import { uploadFile, downloadFile, attachFile, removeAttachment } from '../controllers/filesController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// File storage
router.post('/upload',  authenticate, upload.single('file'), uploadFile);
router.get('/:id',      downloadFile); // no auth — UUID is unguessable

// Cutting plan attachments
router.post('/cutting-plan/:id/attachments',         authenticate, attachFile);
router.delete('/cutting-plan/:id/attachments/:type', authenticate, removeAttachment);

export default router;
