import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from 'jsonwebtoken'

export const validateAuth = async (req: Request, res: Response, next: NextFunction) => {       
    if (!req.headers.authorization?.startsWith('Bearer ')) {
        res.status(401).json({error: 'Invalid authorization header format'});
        return;
    }

    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        res.status(401).json({error: 'No token provided'});
        return
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
        req.user = {
            id: decoded.id,
            role: decoded.role
        };
        next();
    } catch (error) {
        console.error(error);
        res.status(401).json({error: 'Invalid token'});
        return;
    }
}