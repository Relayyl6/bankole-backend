import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.config';
import { AuthRequest } from '../middlewares/auth.middleware';
import { buildError, notFound, forbidden, parsePagination, paginatedResponse } from '../utils/response';
import { tokenizeCard, resolveBankAccount, chargeCard, createTransferRecipient, initiateTransfer } from '../services/paystack.service';

const luhnCheck = (num: string): boolean => {
  let sum = 0;
  let alternate = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i], 10);
    if (alternate) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
};

const detectCardType = (num: string): string => {
  if (num.startsWith('4')) return 'visa';
  if (num.startsWith('5') || num.startsWith('2')) return 'mastercard';
  return 'verve';
};

const isExpiryValid = (expiry: string): boolean => {
  const [mm, yy] = expiry.split('/');
  const expDate = new Date(2000 + parseInt(yy), parseInt(mm) - 1, 1);
  return expDate > new Date();
};

export const addCardSchema = z.object({
  cardNumber: z.string().min(13).max(19),
  expiry: z.string().regex(/^\d{2}\/\d{2}$/, 'Expiry must be MM/YY'),
  cvv: z.string().min(3).max(4),
  holder: z.string().min(2),
});

export const addBankAccountSchema = z.object({
  bankCode: z.string().min(3).max(6),
  accountNumber: z.string().length(10, 'Account number must be 10 digits'),
  accountName: z.string().min(2),
});

export const resolveBankAccountSchema = z.object({
  accountNumber: z.string().length(10, 'Account number must be 10 digits'),
  bankCode: z.string().min(3).max(6),
});

export const topupWalletSchema = z.object({
  amount: z.number().int().positive('Top-up amount must be positive'),
  currency: z.string().default('NGN'),
  cardId: z.string().uuid('Invalid card ID'),
});

export const withdrawSchema = z.object({
  amount: z.number().int().positive(),
  currency: z.string().default('NGN'),
  bankAccountId: z.string().uuid(),
  description: z.string().optional().default('Withdrawal'),
});

/** POST /payments/bank-accounts/resolve — resolves Nigerian bank account name */
export const resolveBankAccountController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { accountNumber, bankCode } = req.body;
    const resolved = await resolveBankAccount(bankCode, accountNumber);

    return res.status(200).json({
      accountName: resolved.accountName,
      accountNumber: resolved.accountNumber,
      bankCode: bankCode,
      bankName: resolved.bankName,
    });
  } catch (err: any) {
    return res.status(400).json(buildError('bank_resolve_failed', err.message || 'Could not resolve bank account details.'));
  }
};

/** POST /payments/topup — Sender virtual wallet top-up */
export const topupWallet = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { amount, currency, cardId } = req.body;

    // Fetch card details
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('gateway_token')
      .eq('id', cardId)
      .eq('user_id', user.id)
      .single();

    if (cardError || !card) {
      return res.status(404).json(buildError('card_not_found', 'Saved card not found.'));
    }

    // Charge the card
    const chargeRes = await chargeCard(card.gateway_token, user.email!, amount, currency);
    if (!chargeRes.success) {
      return res.status(400).json(buildError('charge_failed', chargeRes.message || 'Payment failed.'));
    }

    // 1. Fetch current wallet balance
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('wallet_balance')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    const currentBalance = userProfile?.wallet_balance ? Number(userProfile.wallet_balance) : 0;
    const newBalance = currentBalance + amount;

    // 2. Update wallet balance
    const { error: updateError } = await supabase
      .from('users')
      .update({ wallet_balance: newBalance })
      .eq('id', user.id);

    if (updateError) throw updateError;

    // 3. Record credit in ledger_transactions
    const { data: tx, error: txError } = await supabase
      .from('ledger_transactions')
      .insert({
        user_id: user.id,
        title: 'Wallet Top-up via Virtual Account',
        amount,
        currency: currency || 'NGN',
        type: 'credit',
      })
      .select('id')
      .single();

    if (txError) throw txError;

    return res.status(200).json({
      success: true,
      status: 'success',
      balance: newBalance,
      amount,
      currency: currency || 'NGN',
      transactionId: tx?.id || `tx_topup_${Date.now()}`,
    });
  } catch (err) {
    next(err);
  }
};

export const getCards = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { data: cards, error } = await supabase
      .from('cards')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      data: cards.map((c: any) => ({
        id: c.id,
        type: c.type,
        last4: c.last4,
        expiry: c.expiry,
        holder: c.holder,
        isDefault: c.is_default
      }))
    });
  } catch (err) {
    next(err);
  }
};

export const addCard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { cardNumber, expiry, cvv, holder } = req.body;

    if (!luhnCheck(cardNumber)) {
      return res.status(400).json(buildError('invalid_card', 'Card number is invalid (Luhn check failed).'));
    }
    if (!isExpiryValid(expiry)) {
      return res.status(400).json(buildError('card_expired', 'The card expiry date is in the past.'));
    }

    const type = detectCardType(cardNumber);
    const token = await tokenizeCard(cardNumber, expiry, cvv, holder);

    const { data: existingCards } = await supabase
      .from('cards')
      .select('id')
      .eq('user_id', req.user!.id);

    const isDefault = !existingCards || existingCards.length === 0;

    const { data: newCard, error } = await supabase
      .from('cards')
      .insert({
        user_id: req.user!.id,
        type,
        last4: cardNumber.slice(-4),
        expiry,
        holder,
        gateway_token: token,
        is_default: isDefault
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      data: {
        id: newCard.id,
        type: newCard.type,
        last4: newCard.last4,
        expiry: newCard.expiry,
        holder: newCard.holder,
        isDefault: newCard.is_default
      }
    });
  } catch (err) {
    next(err);
  }
};

export const deleteCard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { data: card, error: fetchError } = await supabase
      .from('cards')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !card) {
      return notFound(res, 'Card');
    }
    if (card.user_id !== req.user!.id) {
      return forbidden(res);
    }

    const { error: deleteError } = await supabase
      .from('cards')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    if (card.is_default) {
      const { data: remainingCards } = await supabase
        .from('cards')
        .select('id')
        .eq('user_id', req.user!.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (remainingCards && remainingCards.length > 0) {
        await supabase
          .from('cards')
          .update({ is_default: true })
          .eq('id', remainingCards[0].id);
      }
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

export const setDefaultCard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { data: card, error: fetchError } = await supabase
      .from('cards')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !card) {
      return notFound(res, 'Card');
    }
    if (card.user_id !== req.user!.id) {
      return forbidden(res);
    }

    await supabase
      .from('cards')
      .update({ is_default: false })
      .eq('user_id', req.user!.id);

    await supabase
      .from('cards')
      .update({ is_default: true })
      .eq('id', id);

    res.json({
      data: {
        id,
        isDefault: true
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getBankAccounts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { data: accounts, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      data: accounts.map((a: any) => ({
        id: a.id,
        bankCode: a.bank_code,
        bankName: a.bank_name,
        accountNumber: a.account_number,
        accountName: a.account_name,
        isDefault: a.is_default,
        createdAt: a.created_at
      }))
    });
  } catch (err) {
    next(err);
  }
};

export const addBankAccount = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { bankCode, accountNumber } = req.body;
    let resolved;
    try {
      resolved = await resolveBankAccount(bankCode, accountNumber);
    } catch (e) {
      return res.status(400).json(buildError('account_resolution_failed', 'Failed to validate bank account. Please check the bank code and account number.'));
    }

    const { data: existingAccounts } = await supabase
      .from('bank_accounts')
      .select('id')
      .eq('user_id', req.user!.id);

    const isDefault = !existingAccounts || existingAccounts.length === 0;

    const recipientCode = await createTransferRecipient(resolved.accountName, accountNumber, bankCode);

    const { data: newAccount, error } = await supabase
      .from('bank_accounts')
      .insert({
        user_id: req.user!.id,
        bank_code: bankCode,
        bank_name: resolved.bankName,
        account_number: accountNumber,
        account_name: resolved.accountName,
        recipient_code: recipientCode,
        is_default: isDefault
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      data: {
        id: newAccount.id,
        bankCode: newAccount.bank_code,
        bankName: newAccount.bank_name,
        accountNumber: newAccount.account_number,
        accountName: newAccount.account_name,
        isDefault: newAccount.is_default
      }
    });
  } catch (err) {
    next(err);
  }
};

export const requestWithdrawal = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'agent') {
      return forbidden(res);
    }

    const { data: agentRecord } = await supabase
      .from('agents')
      .select('id')
      .eq('user_id', req.user!.id)
      .single();
      
    if (!agentRecord) {
      return forbidden(res);
    }

    const { data: agentProjects } = await supabase
      .from('projects')
      .select('id')
      .eq('agent_id', agentRecord.id);
      
    let releasedEscrow = 0;
    if (agentProjects && agentProjects.length > 0) {
      const projectIds = agentProjects.map((p: any) => p.id);
      const { data: milestones } = await supabase
        .from('milestones')
        .select('escrow_amount')
        .in('project_id', projectIds)
        .eq('status', 'released');
        
      if (milestones) {
        releasedEscrow = milestones.reduce((sum, m) => sum + Number(m.escrow_amount), 0);
      }
    }

    const { data: pastReqs } = await supabase
      .from('withdrawal_requests')
      .select('amount')
      .eq('user_id', req.user!.id)
      .in('status', ['completed', 'pending']);
      
    let pastWithdrawals = 0;
    if (pastReqs) {
      pastWithdrawals = pastReqs.reduce((sum, w) => sum + Number(w.amount), 0);
    }

    const availableBalance = releasedEscrow - pastWithdrawals;

    const { amount, currency, bankAccountId, description } = req.body;

    if (amount > availableBalance) {
      return res.status(400).json(buildError('insufficient_balance', 'Insufficient available balance.'));
    }

    const { data: bankAccount } = await supabase
      .from('bank_accounts')
      .select('id, recipient_code')
      .eq('id', bankAccountId)
      .eq('user_id', req.user!.id)
      .single();

    if (!bankAccount) {
      return notFound(res, 'Bank account');
    }

    if (!bankAccount.recipient_code) {
      return res.status(400).json(buildError('invalid_bank_account', 'Bank account is missing recipient code. Please re-add it.'));
    }

    const transferRes = await initiateTransfer(bankAccount.recipient_code, amount, description, currency);
    if (!transferRes.success) {
      return res.status(400).json(buildError('transfer_failed', transferRes.message || 'Automatic payout failed.'));
    }

    const { data: withdrawal, error: wError } = await supabase
      .from('withdrawal_requests')
      .insert({
        user_id: req.user!.id,
        amount,
        currency,
        bank_account_id: bankAccountId,
        status: 'completed', // Immediately completed via automatic transfer
        description
      })
      .select()
      .single();

    if (wError) throw wError;

    const { error: lError } = await supabase
      .from('ledger_transactions')
      .insert({
        user_id: req.user!.id,
        title: description,
        amount,
        currency,
        type: 'debit'
      });

    if (lError) throw lError;

    res.status(201).json({
      data: {
        id: withdrawal.id,
        amount: withdrawal.amount,
        currency: withdrawal.currency,
        status: withdrawal.status,
        description: withdrawal.description,
        createdAt: withdrawal.created_at
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getTransactions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req.query);

    const { data: transactions, error, count } = await supabase
      .from('ledger_transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.perPage - 1);

    if (error) throw error;

    const formatted = (transactions ?? []).map((t: any) => ({
      id: t.id,
      title: t.title,
      amount: t.amount,
      currency: t.currency,
      type: t.type,
      createdAt: t.created_at
    }));

    return res.status(200).json(paginatedResponse(formatted, count ?? 0, pagination));
  } catch (err) {
    next(err);
  }
};
