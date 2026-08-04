import { Router } from 'express';
import { deleteDocument } from '../controllers/documents.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.delete('/:id', authenticate, deleteDocument);

export default router;
