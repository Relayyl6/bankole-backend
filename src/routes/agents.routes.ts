import { Router } from 'express';
import { listAgents, getAgent, addReview, addCredential, addPortfolio, reviewAgentSchema, addCredentialSchema, addPortfolioSchema, agentQuerySchema } from '../controllers/agents.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';
import { validate, validateQuery } from '../middlewares/validate.middleware';
import { Role } from '../types/enums';

const router = Router();

router.get('/', validateQuery(agentQuerySchema), listAgents);
router.get('/:id', getAgent);

router.post('/:id/reviews', authenticate, requireRole(Role.SENDER), validate(reviewAgentSchema), addReview);
router.post('/:id/credentials', authenticate, requireRole(Role.AGENT), validate(addCredentialSchema), addCredential);
router.post('/:id/portfolio', authenticate, requireRole(Role.AGENT), validate(addPortfolioSchema), addPortfolio);

export default router;
