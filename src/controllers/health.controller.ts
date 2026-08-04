import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';

export const checkHealth = (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'API is healthy' });
};

export const checkProtected = (req: AuthRequest, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'You have successfully accessed a protected route',
    user: req.user
  });
};
