import { Router } from 'express';
import { approveProof, flagProof, getProofVerification } from '../controllers/proofs.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';
import { idempotency } from '../middlewares/idempotency.middleware';
import { Role } from '../types/enums';

const router = Router();

router.get('/:id/verification', authenticate, getProofVerification);
router.post('/:id/approve', authenticate, requireRole(Role.SENDER), idempotency, approveProof);
router.post('/:id/flag', authenticate, requireRole(Role.SENDER), idempotency, flagProof);

export default router;
