import { Router } from 'express';
import { listAgents, getAgent, agentQuerySchema } from '../controllers/agents.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validateQuery } from '../middlewares/validate.middleware';

const router = Router();

router.get('/', authenticate, validateQuery(agentQuerySchema), listAgents);
router.get('/:id', authenticate, getAgent);

export default router;
