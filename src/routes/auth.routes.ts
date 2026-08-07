import { Router } from 'express';
import {
  register, registerSchema, login, loginSchema, me, refresh, refreshSchema,
  updateProfile, updateProfileSchema,
  updatePreferences, preferencesSchema,
  changePassword, changePasswordSchema,
  enable2fa, verify2fa, verifyTotpSchema
} from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { authLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.get('/me', authenticate, me);
router.patch('/me', authenticate, validate(updateProfileSchema), updateProfile);
router.post('/refresh', authLimiter, validate(refreshSchema), refresh);

router.patch('/preferences', authenticate, validate(preferencesSchema), updatePreferences);
router.post('/password', authenticate, validate(changePasswordSchema), changePassword);
router.post('/2fa/enable', authenticate, enable2fa);
router.post('/2fa/verify', authenticate, validate(verifyTotpSchema), verify2fa);


export default router;
