import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'eff-fleet-maintenance-system-secret-2026';

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    name?: string;
    phone_number?: string;
    role?: string;
    picture?: string;
    [key: string]: any;
  };
}

export function verifyCustomToken(token: string) {
  try {
    const [payloadStr, signature] = token.split('.');
    if (!payloadStr || !signature) return null;
    
    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(payloadStr).digest('hex');
    if (signature !== expectedSignature) return null;
    
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64').toString('utf8'));
    if (payload.expires < Date.now()) return null; // Expired
    
    return payload;
  } catch (e) {
    return null;
  }
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  
  // Check custom cryptographic token
  if (token.includes('.')) {
    const payload = verifyCustomToken(token);
    if (payload) {
      req.user = {
        uid: payload.uid,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        phone_number: payload.phoneNumber || ''
      };
      return next();
    }
  }

  return res.status(401).json({ error: 'Unauthorized: Invalid token' });
};
