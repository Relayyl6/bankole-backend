import { env } from '../config/env.config';

const BANK_NAMES: Record<string, string> = {
  '044': 'Access Bank',
  '058': 'GTBank',
  '011': 'First Bank of Nigeria',
  '035': 'Wema Bank',
  '057': 'Zenith Bank',
  '033': 'United Bank for Africa (UBA)',
  '050': 'EcoBank Nigeria',
  '076': 'Polaris Bank',
  '214': 'First City Monument Bank (FCMB)',
  '070': 'Fidelity Bank',
  '221': 'Stanbic IBTC Bank',
  '232': 'Sterling Bank',
  '082': 'Keystone Bank',
  '090110': 'VFD Microfinance Bank',
  '090267': 'Kuda Bank',
  '100004': 'Opay (Paycom)',
  '090405': 'Moniepoint Microfinance Bank',
  '090175': 'Rubies MFB',
};

/**
 * Resolves a Nigerian bank account number and bank code via Paystack API.
 */
export const resolveBankAccount = async (bankCode: string, accountNumber: string) => {
  const secretKey = env.PAYSTACK_SECRET_KEY;

  if (!secretKey || secretKey.includes('xxxxxxxx')) {
    throw new Error('Payment gateway is not configured.');
  }

  try {
    const response = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const resData = (await response.json()) as any;

    if (response.ok && resData.status && resData.data) {
      return {
        bankName: BANK_NAMES[bankCode] || resData.data.bank_name || 'Bank',
        accountNumber: resData.data.account_number || accountNumber,
        accountName: resData.data.account_name,
      };
    }

    throw new Error(resData.message || 'Failed to resolve bank account');
  } catch (err: any) {
    throw new Error(err.message || 'Payment gateway error.');
  }
};

/**
 * Tokenizes a card via Paystack / gateway token generation.
 */
export const tokenizeCard = async (
  cardNumber: string,
  expiry: string,
  cvv: string,
  holder: string
): Promise<string> => {
  const secretKey = env.PAYSTACK_SECRET_KEY;

  if (!secretKey || secretKey.includes('xxxxxxxx')) {
    throw new Error('Payment gateway is not configured.');
  }

  try {
    const [expMonth, expYear] = expiry.split('/');
    const formattedYear = expYear.length === 2 ? `20${expYear}` : expYear;

    const response = await fetch('https://api.paystack.co/charge/tokenize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        card: {
          number: cardNumber,
          cvv,
          expiry_month: expMonth,
          expiry_year: formattedYear,
        },
        email: 'cards@bankole.io',
      }),
    });

    const resData = (await response.json()) as any;
    if (response.ok && resData.status && resData.data?.token) {
      return resData.data.token;
    }
    throw new Error(resData.message || 'Failed to tokenize card');
  } catch (err: any) {
    throw new Error(err.message || 'Payment gateway error.');
  }
};

/**
 * Creates a transfer recipient on Paystack for automated agent payouts.
 */
export const createTransferRecipient = async (
  accountName: string,
  accountNumber: string,
  bankCode: string
): Promise<string | null> => {
  const secretKey = env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return null;

  try {
    const response = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'nuban',
        name: accountName,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: 'NGN',
      }),
    });

    const resData = (await response.json()) as any;
    if (response.ok && resData.status && resData.data?.recipient_code) {
      return resData.data.recipient_code;
    }
  } catch (err: any) {
    console.error('[Paystack Service] Failed to create transfer recipient:', err.message);
  }
  return null;
};

/**
 * Charges a saved card (authorization code) via Paystack
 */
export const chargeCard = async (
  authorizationCode: string,
  email: string,
  amount: number,
  currency: string = 'NGN'
): Promise<{ success: boolean; reference?: string; message?: string }> => {
  const secretKey = env.PAYSTACK_SECRET_KEY;

  if (!secretKey || secretKey.includes('xxxxxxxx')) {
    return { success: false, message: 'Payment gateway is not configured.' };
  }

  try {
    const response = await fetch('https://api.paystack.co/transaction/charge_authorization', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authorization_code: authorizationCode,
        email,
        amount: Math.round(amount * 100), // Paystack requires amount in kobo/cents
        currency,
      }),
    });

    const resData = (await response.json()) as any;
    
    if (response.ok && resData.status && resData.data?.status === 'success') {
      return { success: true, reference: resData.data.reference };
    }
    return { success: false, message: resData.message || resData.data?.gateway_response };
  } catch (err: any) {
    console.error('[Paystack Service] Charge API error:', err.message);
    return { success: false, message: 'Payment gateway error.' };
  }
};

/**
 * Initiates an automatic transfer to an agent's bank account via Paystack
 */
export const initiateTransfer = async (
  recipientCode: string,
  amount: number,
  reason: string,
  currency: string = 'NGN'
): Promise<{ success: boolean; reference?: string; transferCode?: string; message?: string }> => {
  const secretKey = env.PAYSTACK_SECRET_KEY;
  if (!secretKey || secretKey.includes('xxxxxxxx')) {
    return { success: false, message: 'Payment gateway is not configured.' };
  }

  try {
    const response = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        reason,
        amount: Math.round(amount * 100), // Paystack requires amount in kobo/cents
        recipient: recipientCode,
        currency,
      }),
    });

    const resData = (await response.json()) as any;
    if (response.ok && resData.status && resData.data) {
      return { 
        success: true, 
        reference: resData.data.reference,
        transferCode: resData.data.transfer_code 
      };
    }
    return { success: false, message: resData.message };
  } catch (err: any) {
    console.error('[Paystack Service] Transfer API error:', err.message);
    return { success: false, message: 'Transfer gateway error.' };
  }
};

