import jwt from 'jsonwebtoken';
import { mssqlQuery, sql } from '../lib/mssql.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ message: 'Missing bearer token' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');

    const userId = payload?.sub;
    if (!userId) {
      res.status(401).json({ message: 'Invalid or expired token' });
      return;
    }

    mssqlQuery('DEFAULT', 'SELECT IsActive FROM dbo.Users WHERE UserId = @userId', {
      inputs: { userId: { type: sql.Int, value: userId } },
    })
      .then((rows) => {
        const row = rows?.[0];
        if (!row || !row.IsActive) {
          res.status(401).json({ message: 'User not found or inactive' });
          return;
        }

        req.user = payload;
        next();
      })
      .catch(next);
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}
