import { Router } from 'express';
import { getDashboardSummary } from '../controllers/dashboard.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/summary', authenticate, getDashboardSummary);

export default router;
