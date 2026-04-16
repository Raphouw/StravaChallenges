import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

export interface JWTPayload {
  userId: string;
  stravaId: number;
  iat: number;
  exp: number;
}

export function generateJWT(userId: string, stravaId: number): string {
  return jwt.sign(
    {
      userId,
      stravaId,
    },
    JWT_SECRET,
    {
      expiresIn: '7d',
    }
  );
}

export function verifyJWT(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}
