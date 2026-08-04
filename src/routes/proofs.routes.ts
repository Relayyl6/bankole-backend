import { Router } from 'express';
import { approveProof, flagProof } from '../controllers/proofs.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';
import { Role } from '../types/enums';

const router = Router();

router.post('/:id/approve', authenticate, requireRole(Role.SENDER), approveProof);
router.post('/:id/flag', authenticate, requireRole(Role.SENDER), flagProof);

export default router;
