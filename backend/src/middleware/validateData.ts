import { Response, Request, NextFunction } from "express";
import { ZodType, z } from "zod";

export const validateData = (schema: ZodType) => {
    return (req: Request, res: Response, next: NextFunction) => {
       try {
            const validatedData = schema.parse(req.body)
            req.body = validatedData
            next()
       } catch (error) {
           if(error instanceof z.ZodError) {
                return res.status(400).json({ message: 'Validation Failed', error: error })
           }
           return res.status(500).json({
                error: 'Internal server error during validation'
            });
       }
    }
}
