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
  // Bypass all authentication and inject a dummy admin user
  req.user = {
    uid: "admin-bypass",
    email: "admin@eff.zambia",
    name: "Admin User",
    role: "admin",
    phone_number: "+260123456789"
  };
  return next();
};
