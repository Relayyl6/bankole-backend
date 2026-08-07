import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
// assuming validate middleware exists, if not we can import from where it actually is
import { validate } from '../middlewares/validate.middleware'; 
import {
  getOrCreateThread, listThreads, getThreadMessages, sendThreadMessage,
  createThreadSchema, sendDmSchema
} from '../controllers/dm.controller';

const router = Router();

router.post('/threads', authenticate, validate(createThreadSchema), getOrCreateThread);
router.get('/threads', authenticate, listThreads);
router.get('/threads/:threadId/messages', authenticate, getThreadMessages);
router.post('/threads/:threadId/messages', authenticate, validate(sendDmSchema), sendThreadMessage);

export default router;
