import { Router } from 'express';
import { register, registerSchema, login, loginSchema, me, refresh, refreshSchema, updateProfile, updateProfileSchema } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { authLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.get('/me', authenticate, me);
router.patch('/me', authenticate, validate(updateProfileSchema), updateProfile);
router.post('/refresh', authLimiter, validate(refreshSchema), refresh);

export default router;
