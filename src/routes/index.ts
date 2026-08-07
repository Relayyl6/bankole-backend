import { Router } from 'express';
import authRoutes from './auth.routes';
import agentRoutes from './agents.routes';
import projectRoutes from './projects.routes';
import milestoneRoutes from './milestones.routes';
import proofRoutes from './proofs.routes';
import dashboardRoutes from './dashboard.routes';
import documentRoutes from './documents.routes';
import paymentsRoutes from './payments.routes';
import dmRoutes from './dm.routes';

const router = Router();

// Mount all routes under /api/v1
router.use('/auth', authRoutes);
router.use('/agents', agentRoutes);
router.use('/projects', projectRoutes);
router.use('/milestones', milestoneRoutes);
router.use('/proofs', proofRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/documents', documentRoutes);
router.use('/payments', paymentsRoutes);
router.use('/messages', dmRoutes);

export default router;
