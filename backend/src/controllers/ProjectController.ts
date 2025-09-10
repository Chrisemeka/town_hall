import { Request, Response } from 'express';
import prisma from '../prisma';
import type { Prisma } from '@prisma/client';
import { ProjectInput } from '../models/projectSchemas';

export class ProjectController {
    static createProject = async (req: Request, res: Response) => {
        try {
            if ((req as any).user?.role !== 'DEVELOPER') {
                return res.status(403).json({
                    error: 'Insufficient Permissions',
                    message: 'Only developers can create projects'
                });  
            }

            const { projectName, description, websiteUrl, targetAudience, objectives, components } = req.body as ProjectInput;

            if (!projectName || !description || !websiteUrl || !targetAudience || !objectives || !components) {
                return res.status(400).json({ message: 'All fields are required' });
            };

            const result = await prisma.$transaction(async (prisma: Prisma.TransactionClient) => {
                const project = await prisma.project.create({
                    data: {
                        projectName,
                        description,
                        websiteUrl,
                        targetAudience,
                        objectives, 
                        developerId: (req as any).user?.id,
                        status: 'DRAFT'
                    }
                });

                const component = await prisma.component.createMany({
                    data: components.map((component) => ({
                        projectId: project.id,
                        componentName: component.componentName,
                        description: component.description,
                        priority: component.priority,
                        focusAreas: component.focusAreas,
                    })),
                });

                return { project, componentCount: component.count };
            });

            const completeProject = await prisma.project.findUnique({
                where: { id: result.project.id },
                include: {
                components: {
                    orderBy: { createdAt: 'asc' }
                },
                developer: {
                    select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true
                    }
                }
                }
            });

            res.status(201).json({
                success: true,
                message: 'Project created successfully',
                data: {
                project: completeProject,
                componentCount: result.componentCount
                }
            });
        } catch (error) {
            console.error('Create project error:', error);
             res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to create project. Please try again.'
            });
        }
    }

    static getAllProjects = async (req: Request, res: Response) => {
        try {
            if ((req as any).user?.role !== 'TESTER') {
                return res.status(403).json({
                    error: 'Insufficient Permissions',
                    message: 'Only tester can view all projects'
                });  
            }

            const projects = await prisma.project.findMany({
                where: {
                    status: 'ACTIVE',
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });
            res.status(200).json({message: 'Sucessfully retrieved all active projects', projects: projects}); 
        } catch (error) {
            console.error('Retrieve project error: ', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to create project. Please try again.'
            });
        };
    };

    static getProjectDetails = async (req: Request, res: Response) => {
        try {
            if (!req.params.id) {
                return res.status(400).json({ error: 'Bad Request', message: 'Project ID is required' });
            }

            const project = await prisma.project.findUnique({
                where: { id: req.params.id },
                include: {
                    components: {
                        orderBy: { createdAt: 'asc' },
                        select: {
                            id: true,
                            componentName: true,
                            description: true,
                            priority: true,
                            focusAreas: true,
                            createdAt: true
                        }
                    },
                    developer: {
                        select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        }
                    },
                    _count: {
                        select: {
                            components: true,
                            testSessions: true
                        }
                    }
                }
            });

            if (!project) {
                return res.status(404).json({ 
                    error: 'Not Found',
                    message: 'Project not found' 
                });
            };

            const userRole = (req as any).user?.role;
            const userId = (req as any).user?.id;
            const isProjectOwner = project.developerId === userId;

            if (userRole == 'DEVELOPER' && !isProjectOwner) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'You can only view your own project'
                })
            }

            if (userRole == 'TESTER' && project.status !== 'ACTIVE') {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'Project not available for testing'
                });
            } 

            if (userRole !== 'DEVELOPER' && userRole !== 'TESTER') {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Insufficient Permissions'
                })
            }
            const responseData = {
                project: {
                    id: project.id,
                    projectName: project.projectName,
                    description: project.description,
                    websiteUrl: project.websiteUrl,
                    targetAudience: project.targetAudience,
                    objectives: project.objectives,
                    status: project.status,
                    createdAt: project.createdAt,
                    updatedAt: project.updatedAt,
                    components: project.components,
                    developer: project.developer,
                    stats: {
                        totalComponents: project._count.components,
                        totalTestSessions: project._count.testSessions
                    }
                },
                userContext: {
                    role: userRole,
                    isOwner: isProjectOwner,
                }
            };
            res.status(200).json({
            success: true,
            message: 'Project details retrieved successfully',
            data: responseData
        });
        } catch (error) {
            console.error('Get project details error:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to retrieve project details. Please try again.'
            });
        }
    };
}    