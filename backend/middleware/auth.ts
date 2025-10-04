import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        sub: string;
        email: string;
        name?: string;
      };
    }
  }
}

const client = jwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true,
});

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err);
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.substring(7);

    // Verify JWT token
    jwt.verify(
      token,
      getKey,
      {
        audience: process.env.AUTH0_CLIENT_ID,
        issuer: `https://${process.env.AUTH0_DOMAIN}/`,
        algorithms: ['RS256'],
      },
      (err, decoded: any) => {
        if (err) {
          return res.status(401).json({ error: 'Invalid token' });
        }

        // Attach user info to request
        req.user = {
          sub: decoded.sub,
          email: decoded.email,
          name: decoded.name,
        };

        next();
      }
    );
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Optional auth - doesn't fail if no token, but parses it if present
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);

    jwt.verify(
      token,
      getKey,
      {
        audience: process.env.AUTH0_CLIENT_ID,
        issuer: `https://${process.env.AUTH0_DOMAIN}/`,
        algorithms: ['RS256'],
      },
      (err, decoded: any) => {
        if (!err && decoded) {
          req.user = {
            sub: decoded.sub,
            email: decoded.email,
            name: decoded.name,
          };
        }
        next();
      }
    );
  } catch (error) {
    next();
  }
};
