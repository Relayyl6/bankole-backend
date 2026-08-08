import { Router } from 'express';
import {
  listAgents,
  getAgent,
  addReview,
  addCredential,
  addPortfolio,
  uploadVerificationDocs,
  reviewAgentSchema,
  addCredentialSchema,
  addPortfolioSchema,
  agentQuerySchema
} from '../controllers/agents.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';
import { validate, validateQuery } from '../middlewares/validate.middleware';
import { uploadLimiter } from '../middlewares/rateLimiter.middleware';
import { upload } from '../config/multer.config';
import { Role } from '../types/enums';

const router = Router();

router.get('/', validateQuery(agentQuerySchema), listAgents);
router.get('/:id', getAgent);

router.post('/:id/reviews', authenticate, requireRole(Role.SENDER), validate(reviewAgentSchema), addReview);
router.post('/:id/credentials', authenticate, requireRole(Role.AGENT), validate(addCredentialSchema), addCredential);
router.post('/:id/portfolio', authenticate, requireRole(Role.AGENT), validate(addPortfolioSchema), addPortfolio);
router.post(
  '/:id/verification-docs',
  authenticate,
  requireRole(Role.AGENT),
  uploadLimiter,
  upload.fields([
    { name: 'idDocument', maxCount: 1 },
    { name: 'credentials', maxCount: 1 },
    { name: 'reference', maxCount: 1 },
  ]),
  uploadVerificationDocs
);

export default router;
