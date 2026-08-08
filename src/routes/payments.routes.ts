import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { Role } from '../types/enums';
import {
  getCards, addCard, deleteCard, setDefaultCard,
  getBankAccounts, addBankAccount, requestWithdrawal, getTransactions, topupWallet, resolveBankAccountController,
  addCardSchema, addBankAccountSchema, withdrawSchema, topupWalletSchema, resolveBankAccountSchema
} from '../controllers/payments.controller';

const router = Router();

// Wallet Top-up (Sender only)
router.post('/topup', authenticate, requireRole(Role.SENDER), validate(topupWalletSchema), topupWallet);

// Bank account resolution (All authenticated)
router.post('/bank-accounts/resolve', authenticate, validate(resolveBankAccountSchema), resolveBankAccountController);

// Cards (Sender only)
router.get('/cards', authenticate, requireRole(Role.SENDER), getCards);
router.post('/cards', authenticate, requireRole(Role.SENDER), validate(addCardSchema), addCard);
router.delete('/cards/:id', authenticate, requireRole(Role.SENDER), deleteCard);
router.post('/cards/:id/default', authenticate, requireRole(Role.SENDER), setDefaultCard);

// Bank accounts (Agent only)
router.get('/bank-accounts', authenticate, requireRole(Role.AGENT), getBankAccounts);
router.post('/bank-accounts', authenticate, requireRole(Role.AGENT), validate(addBankAccountSchema), addBankAccount);

// Withdrawal (Agent only)
router.post('/withdraw', authenticate, requireRole(Role.AGENT), validate(withdrawSchema), requestWithdrawal);

// Transactions (all authenticated)
router.get('/transactions', authenticate, getTransactions);

export default router;
