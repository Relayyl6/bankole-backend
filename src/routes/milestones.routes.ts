import { Router } from 'express';
import {
  listMilestones,
  submitMilestone,
  approveMilestone,
  flagMilestone,
  releaseMilestone,
  flagMilestoneSchema,
} from '../controllers/milestones.controller';
import { uploadProof, uploadProofSchema } from '../controllers/proofs.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { idempotency } from '../middlewares/idempotency.middleware';
import { uploadLimiter } from '../middlewares/rateLimiter.middleware';
import { upload } from '../config/multer.config';
import { Role } from '../types/enums';

const router = Router();

// Proofs — nested under milestones
router.post(
  '/:id/proofs',
  authenticate,
  requireRole(Role.AGENT),
  uploadLimiter,
  upload.single('file'),
  validate(uploadProofSchema),
  uploadProof
);

// Milestone lifecycle
router.post('/:id/submit', authenticate, requireRole(Role.AGENT), submitMilestone);
router.post('/:id/approve', authenticate, requireRole(Role.SENDER), approveMilestone);
router.post('/:id/flag', authenticate, requireRole(Role.SENDER), validate(flagMilestoneSchema), flagMilestone);
router.post('/:id/release', authenticate, requireRole(Role.SENDER), idempotency, releaseMilestone);

export default router;
