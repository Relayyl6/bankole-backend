import { Router } from 'express';
import {
  listProjects,
  getProject,
  createProject,
  patchProject,
  createProjectSchema,
  patchProjectSchema,
} from '../controllers/projects.controller';
import { listProjectActivity } from '../controllers/activity.controller';
import { listProjectProofs } from '../controllers/proofs.controller';
import { listDocuments, uploadDocument, uploadDocumentSchema } from '../controllers/documents.controller';
import { listMessages, createMessage, createMessageSchema } from '../controllers/messages.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { uploadLimiter } from '../middlewares/rateLimiter.middleware';
import { upload } from '../config/multer.config';
import { Role } from '../types/enums';

const router = Router();

// Project CRUD
router.get('/', authenticate, listProjects);
router.get('/:id', authenticate, getProject);
router.post('/', authenticate, requireRole(Role.SENDER), validate(createProjectSchema), createProject);
router.patch('/:id', authenticate, requireRole(Role.SENDER), validate(patchProjectSchema), patchProject);

// Sub-resources
router.get('/:id/milestones', authenticate, (req, res, next) => {
  // Re-export from milestones routes for /projects/:id/milestones
  import('../controllers/milestones.controller').then(({ listMilestones }) => listMilestones(req as any, res, next));
});

router.get('/:id/proofs', authenticate, listProjectProofs);
router.get('/:id/activity', authenticate, listProjectActivity);

router.get('/:id/documents', authenticate, listDocuments);
router.post('/:id/documents', authenticate, uploadLimiter, upload.single('file'), validate(uploadDocumentSchema), uploadDocument);

router.get('/:id/messages', authenticate, listMessages);
router.post('/:id/messages', authenticate, validate(createMessageSchema), createMessage);

export default router;
