import { z } from 'zod';

export const projectSchema = z.object({
    projectName: z
        .string()
        .min(1, 'Project name is required')
        .max(100, 'Project name must not exceed 100 characters'),
    
    description: z
        .string()
        .min(10, 'Description must be at least 10 characters long'),
    
    websiteUrl: z       
        .url('Please provide a valid website URL'),
    
    targetAudience: z
        .string()
        .min(5, 'Target audience description required'),
    objectives: z
        .string()
        .min(10, 'Objectives must be at least 10 characters'),
    components: z
        .array(z.object({
            componentName: z
                .string()
                .min(1, 'Component name is required'),
            description: z
                .string()
                .min(5, 'Component description required'),
            priority: z
                .enum(['HIGH', 'MEDIUM', 'LOW']),
            focusAreas: z
                .string()
                .min(5, 'Focus areas description required')
        }))
        .min(1, 'At least one component is required') 
})

export type ProjectInput = z.infer<typeof projectSchema>;