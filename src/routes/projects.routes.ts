import { Router } from 'express';
import {
  listProjects,
  getProject,
  createProject,
  patchProject,
  createProjectSchema,
  patchProjectSchema,
  unassignAgent,
  assignAgent,
  sendMobilizationFunds,
  submitBid,
  acceptBid,
  listProjectBids,
  assignAgentSchema,
  unassignAgentSchema,
  sendFundsSchema,
  submitBidSchema,
  listProjectsSchema,
  paginationQuerySchema,
} from '../controllers/projects.controller';
import { listProjectActivity } from '../controllers/activity.controller';
import { listProjectProofs } from '../controllers/proofs.controller';
import { listDocuments, uploadDocument, uploadDocumentSchema } from '../controllers/documents.controller';
import { listMessages, createMessage, createMessageSchema } from '../controllers/messages.controller';
import { inviteCoFunder, inviteCoFunderSchema } from '../controllers/cofunding.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';
import { validate, validateQuery } from '../middlewares/validate.middleware';
import { idempotency } from '../middlewares/idempotency.middleware';
import { uploadLimiter } from '../middlewares/rateLimiter.middleware';
import { upload } from '../config/multer.config';
import { Role } from '../types/enums';

const router = Router();

// Project CRUD
router.get('/', authenticate, validateQuery(listProjectsSchema), listProjects);
router.get('/:id', authenticate, getProject);
router.post('/', authenticate, requireRole(Role.SENDER), idempotency, validate(createProjectSchema), createProject);
router.patch('/:id', authenticate, requireRole(Role.SENDER), validate(patchProjectSchema), patchProject);

// Agent Management & Mobilization Funds
router.post('/:id/unassign-agent', authenticate, requireRole(Role.SENDER), validate(unassignAgentSchema), unassignAgent);
router.post('/:id/assign-agent', authenticate, requireRole(Role.SENDER), validate(assignAgentSchema), assignAgent);
router.post('/:id/send-funds', authenticate, requireRole(Role.SENDER), idempotency, validate(sendFundsSchema), sendMobilizationFunds);

// Marketplace Bidding
router.get('/:id/bids', authenticate, listProjectBids);
router.post('/:id/bids', authenticate, requireRole(Role.AGENT), validate(submitBidSchema), submitBid);
router.post('/:id/bids/:bidId/accept', authenticate, requireRole(Role.SENDER), acceptBid);

// Co-funding
router.post('/:id/co-funders', authenticate, requireRole(Role.SENDER), validate(inviteCoFunderSchema), inviteCoFunder);

// Sub-resources
router.get('/:id/milestones', authenticate, (req, res, next) => {
  // Re-export from milestones routes for /projects/:id/milestones
  import('../controllers/milestones.controller').then(({ listMilestones }) => listMilestones(req as any, res, next));
});

router.get('/:id/proofs', authenticate, validateQuery(paginationQuerySchema), listProjectProofs);
router.get('/:id/activity', authenticate, validateQuery(paginationQuerySchema), listProjectActivity);

router.get('/:id/documents', authenticate, validateQuery(paginationQuerySchema), listDocuments);
router.post('/:id/documents', authenticate, uploadLimiter, upload.single('file'), validate(uploadDocumentSchema), uploadDocument);

router.get('/:id/messages', authenticate, validateQuery(paginationQuerySchema), listMessages);
router.post('/:id/messages', authenticate, validate(createMessageSchema), createMessage);

export default router;
