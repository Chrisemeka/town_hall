import { z } from 'zod';

const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characterss long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character');

const emailSchema = z
    .string()
    .email('Please provide a valid email address')
    .toLowerCase()
    .trim()


export const registerUserSchema = z.object({
    firstName: z 
    .string()
    .min(2, 'Name must be at least 2 characters long')
    .max(100, 'Name must not exceed 50 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),

    lastName: z 
    .string()
    .min(2, 'Name must be at least 2 characters long')
    .max(100, 'Name must not exceed 50 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),

    email: emailSchema,
    password: passwordSchema,
    role: z.enum(['DEVELOPER', 'TESTER'])
})

export const loginUserSchema = z.object({
    email: emailSchema,
    password: passwordSchema
})

export type RegisterUserInput = z.infer<typeof registerUserSchema>;
export type LoginUserInput = z.infer<typeof loginUserSchema>;