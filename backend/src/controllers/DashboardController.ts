import { Request, Response } from 'express';
import prisma from '../prisma';

export class DashboardController {
    static getDeveloperDashboard = async (req: Request, res: Response) => {
        try {
            if ((req as any).user?.role !== 'DEVELOPER') {
                return res.status(403).json({
                    error: 'Insufficient Permissions',
                    message: 'Only developers can access dashboard stats'
                });
            }

            const developerId = (req as any).user?.id;

            const projects = await prisma.project.findMany({
                where: { developerId },
                include: {
                    components: {
                        include: {
                            seqTests: {
                                include: {
                                    seqResponses: true
                                }
                            }
                        }
                    },
                    testSessions: {
                        include: {
                            seqResponses: true
                        }
                    }
                }
            });

            const totalProjects = projects.length;
            const activeProjects = projects.filter(p => p.status === 'ACTIVE').length;
            const completedProjects = projects.filter(p => p.status === 'COMPLETED').length;

            const allTestSessions = projects.flatMap(p => p.testSessions);
            const totalTestSessions = allTestSessions.length;
            const completedTestSessions = allTestSessions.filter(ts => ts.status === 'COMPLETED').length;
            const activeTestSessions = allTestSessions.filter(ts => ts.status === 'ACTIVE').length;

            const uniqueTesters = new Set(allTestSessions.map(ts => ts.testerId)).size;

            const avgCompletionRate = totalTestSessions > 0 
                ? Math.round((completedTestSessions / totalTestSessions) * 100) 
                : 0;

            const allSeqResponses = projects.flatMap(p => 
                p.testSessions.flatMap(ts => ts.seqResponses)
            );
            const totalResponses = allSeqResponses.length;

            const avgSeqScore = totalResponses > 0 
                ? Math.round((allSeqResponses.reduce((sum, response) => sum + response.easeRating, 0) / totalResponses) * 10) / 10
                : 0;

            const projectStats = projects.map(project => {
                const projectSessions = project.testSessions;
                const projectResponses = projectSessions.flatMap(ts => ts.seqResponses);
                const completedSessions = projectSessions.filter(ts => ts.status === 'COMPLETED').length;
                const totalSessions = projectSessions.length;
                
                return {
                    id: project.id,
                    projectName: project.projectName,
                    status: project.status,
                    totalSessions,
                    completedSessions,
                    completionRate: totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0,
                    avgSeqScore: projectResponses.length > 0 
                        ? Math.round((projectResponses.reduce((sum, r) => sum + r.easeRating, 0) / projectResponses.length) * 10) / 10 
                        : 0,
                    responseCount: projectResponses.length,
                    uniqueTesters: new Set(projectSessions.map(ts => ts.testerId)).size,
                    createdAt: project.createdAt
                };
            });

            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const recentSessions = allTestSessions.filter(ts => ts.startedAt >= thirtyDaysAgo);
            const recentResponses = allSeqResponses.filter(r => r.submittedAt >= thirtyDaysAgo);

            const responsesWithFeedback = allSeqResponses.filter(r => r.additionalFeedback && r.additionalFeedback.trim().length > 0);
            const feedbackCount = responsesWithFeedback.length;

            const seqDistribution = {
                excellent: allSeqResponses.filter(r => r.easeRating >= 6).length,
                good: allSeqResponses.filter(r => r.easeRating >= 4 && r.easeRating < 6).length, 
                poor: allSeqResponses.filter(r => r.easeRating < 4).length 
            };

            const componentStats = projects.flatMap(p => p.components).map(component => {
                const componentResponses = component.seqTests.flatMap(st => st.seqResponses);
                return {
                    id: component.id,
                    componentName: component.componentName,
                    projectName: projects.find(p => p.id === component.projectId)?.projectName,
                    responseCount: componentResponses.length,
                    avgSeqScore: componentResponses.length > 0 
                        ? Math.round((componentResponses.reduce((sum, r) => sum + r.easeRating, 0) / componentResponses.length) * 10) / 10 
                        : 0,
                    priority: component.priority
                };
            }).sort((a, b) => b.responseCount - a.responseCount).slice(0, 5);

            const monthlyTrends = [];
            for (let i = 5; i >= 0; i--) {
                const monthStart = new Date();
                monthStart.setMonth(monthStart.getMonth() - i);
                monthStart.setDate(1);
                monthStart.setHours(0, 0, 0, 0);
                
                const monthEnd = new Date(monthStart);
                monthEnd.setMonth(monthEnd.getMonth() + 1);
                
                const monthSessions = allTestSessions.filter(ts => 
                    ts.startedAt >= monthStart && ts.startedAt < monthEnd
                );
                const monthResponses = allSeqResponses.filter(r => 
                    r.submittedAt >= monthStart && r.submittedAt < monthEnd
                );
                
                monthlyTrends.push({
                    month: monthStart.toISOString().slice(0, 7), 
                    sessions: monthSessions.length,
                    responses: monthResponses.length,
                    avgSeqScore: monthResponses.length > 0 
                        ? Math.round((monthResponses.reduce((sum, r) => sum + r.easeRating, 0) / monthResponses.length) * 10) / 10 
                        : 0
                });
            }

            const dashboardData = {
                projectOverview: {
                    totalProjects,
                    activeProjects,
                    completedProjects,
                },

                testingActivity: {
                    totalTestSessions,
                    completedTestSessions,
                    activeTestSessions,
                    avgCompletionRate,
                    uniqueTesters
                },

                performanceMetrics: {
                    totalResponses,
                    avgSeqScore,
                    feedbackCount,
                    seqDistribution
                },

                recentActivity: {
                    recentSessions: recentSessions.length,
                    recentResponses: recentResponses.length,
                    newTesters: new Set(recentSessions.map(ts => ts.testerId)).size
                },

                projectStats: projectStats.sort((a, b) => b.completionRate - a.completionRate),

                topComponents: componentStats,

                monthlyTrends,

                insights: {
                    bestPerformingProject: projectStats.length > 0 
                        ? projectStats.reduce((prev, current) => prev.avgSeqScore > current.avgSeqScore ? prev : current)
                        : null,
                    mostActiveProject: projectStats.length > 0 
                        ? projectStats.reduce((prev, current) => prev.totalSessions > current.totalSessions ? prev : current)
                        : null,
                    needsAttention: projectStats.filter(p => p.avgSeqScore < 4 && p.responseCount > 0),
                    averageTestsPerProject: totalProjects > 0 ? Math.round(totalTestSessions / totalProjects) : 0
                }
            };

            res.status(200).json({
                success: true,
                message: 'Dashboard data retrieved successfully',
                data: dashboardData
            });

        } catch (error) {
            console.error('Dashboard error:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to retrieve dashboard data. Please try again.'
            });
        }
    };

    static getProjectAnalytics = async (req: Request, res: Response) => {
        try {
            if ((req as any).user?.role !== 'DEVELOPER') {
                return res.status(403).json({
                    error: 'Insufficient Permissions',
                    message: 'Only developers can access project analytics'
                });
            }

            const { projectId } = req.params;
            const developerId = (req as any).user?.id;

            const project = await prisma.project.findFirst({
                where: {
                    id: projectId,
                    developerId
                },
                include: {
                    components: {
                        include: {
                            seqTests: {
                                include: {
                                    seqResponses: {
                                        include: {
                                            session: {
                                                select: {
                                                    startedAt: true,
                                                    completedAt: true,
                                                    status: true
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    testSessions: {
                        include: {
                            seqResponses: true
                        }
                    }
                }
            });

            if (!project) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'Project not found or you do not have access'
                });
            }

            const sessions = project.testSessions;
            const allResponses = sessions.flatMap(s => s.seqResponses);
            
            const componentAnalysis = project.components.map(component => {
                const componentResponses = component.seqTests.flatMap(st => st.seqResponses);
                const avgScore = componentResponses.length > 0 
                    ? componentResponses.reduce((sum, r) => sum + r.easeRating, 0) / componentResponses.length 
                    : 0;

                return {
                    id: component.id,
                    componentName: component.componentName,
                    description: component.description,
                    priority: component.priority,
                    focusAreas: component.focusAreas,
                    totalTests: component.seqTests.length,
                    totalResponses: componentResponses.length,
                    avgSeqScore: Math.round(avgScore * 10) / 10,
                    responseDistribution: {
                        excellent: componentResponses.filter(r => r.easeRating >= 6).length,
                        good: componentResponses.filter(r => r.easeRating >= 4 && r.easeRating < 6).length,
                        poor: componentResponses.filter(r => r.easeRating < 4).length
                    },
                    feedbackCount: componentResponses.filter(r => r.additionalFeedback?.trim()).length
                };
            });

            const totalSessions = sessions.length;
            const completedSessions = sessions.filter(s => s.status === 'COMPLETED').length;

            res.status(200).json({
                success: true,
                message: 'Project analytics retrieved successfully',
                data: {
                    project: {
                        id: project.id,
                        projectName: project.projectName,
                        status: project.status,
                        createdAt: project.createdAt
                    },
                    overview: {
                        totalSessions,
                        completedSessions,
                        completionRate: totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0,
                        totalResponses: allResponses.length,
                        avgSeqScore: allResponses.length > 0 
                            ? Math.round((allResponses.reduce((sum, r) => sum + r.easeRating, 0) / allResponses.length) * 10) / 10 
                            : 0,
                        uniqueTesters: new Set(sessions.map(s => s.testerId)).size
                    },
                    componentAnalysis: componentAnalysis.sort((a, b) => b.totalResponses - a.totalResponses),
                    recommendations: {
                        needsImprovement: componentAnalysis.filter(c => c.avgSeqScore < 4 && c.totalResponses > 0),
                        performingWell: componentAnalysis.filter(c => c.avgSeqScore >= 6),
                        needsMoreTesting: componentAnalysis.filter(c => c.totalResponses < 3)
                    }
                }
            });

        } catch (error) {
            console.error('Project analytics error:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to retrieve project analytics. Please try again.'
            });
        }
    };

     static getTesterDashboard = async (req: Request, res: Response) => {
        try {
            if ((req as any).user?.role !== 'TESTER') {
                return res.status(403).json({
                    error: 'Insufficient Permissions',
                    message: 'Only testers can access tester dashboard stats'
                });
            }

            const testerId = (req as any).user?.id;

            const testSessions = await prisma.testSession.findMany({
                where: { testerId },
                include: {
                    project: {
                        select: {
                            id: true,
                            projectName: true,
                            description: true,
                            targetAudience: true,
                            status: true,
                            createdAt: true,
                            developer: {
                                select: {
                                    firstName: true,
                                    lastName: true
                                }
                            }
                        }
                    },
                    seqResponses: true
                }
            });

            const availableProjects = await prisma.project.findMany({
                where: {
                    status: 'ACTIVE',
                    testSessions: {
                        none: {
                            testerId: testerId
                        }
                    }
                },
                select: {
                    id: true,
                    projectName: true,
                    description: true,
                    targetAudience: true,
                    createdAt: true,
                    developer: {
                        select: {
                            firstName: true,
                            lastName: true
                        }
                    },
                    _count: {
                        select: {
                            testSessions: true,
                            components: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: 10 
            });

            const totalTestSessions = testSessions.length;
            const completedSessions = testSessions.filter(ts => ts.status === 'COMPLETED').length;
            const activeSessions = testSessions.filter(ts => ts.status === 'ACTIVE').length;

            const allResponses = testSessions.flatMap(ts => ts.seqResponses);
            const totalResponses = allResponses.length;
            const responsesWithFeedback = allResponses.filter(r => r.additionalFeedback && r.additionalFeedback.trim().length > 0).length;

            const avgSeqRating = totalResponses > 0 
                ? Math.round((allResponses.reduce((sum, response) => sum + response.easeRating, 0) / totalResponses) * 10) / 10
                : 0;

            const uniqueProjectsTested = new Set(testSessions.map(ts => ts.project.id)).size;

            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const recentSessions = testSessions.filter(ts => ts.startedAt >= thirtyDaysAgo);
            const recentResponses = allResponses.filter(r => r.submittedAt >= thirtyDaysAgo);

            const testingHistory = testSessions.map(session => ({
                sessionId: session.id,
                project: {
                    id: session.project.id,
                    name: session.project.projectName,
                    description: session.project.description,
                    developer: `${session.project.developer.firstName} ${session.project.developer.lastName}`
                },
                status: session.status,
                startedAt: session.startedAt,
                completedAt: session.completedAt,
                responseCount: session.seqResponses.length,
                avgSeqRating: session.seqResponses.length > 0 
                    ? Math.round((session.seqResponses.reduce((sum, r) => sum + r.easeRating, 0) / session.seqResponses.length) * 10) / 10 
                    : 0,
                providedFeedback: session.seqResponses.filter(r => r.additionalFeedback?.trim()).length > 0
            })).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

            const monthlyTrends = [];
            for (let i = 5; i >= 0; i--) {
                const monthStart = new Date();
                monthStart.setMonth(monthStart.getMonth() - i);
                monthStart.setDate(1);
                monthStart.setHours(0, 0, 0, 0);
                
                const monthEnd = new Date(monthStart);
                monthEnd.setMonth(monthEnd.getMonth() + 1);
                
                const monthSessions = testSessions.filter(ts => 
                    ts.startedAt >= monthStart && ts.startedAt < monthEnd
                );
                const monthResponses = allResponses.filter(r => 
                    r.submittedAt >= monthStart && r.submittedAt < monthEnd
                );
                
                monthlyTrends.push({
                    month: monthStart.toISOString().slice(0, 7), 
                    sessions: monthSessions.length,
                    responses: monthResponses.length,
                    avgRatingGiven: monthResponses.length > 0 
                        ? Math.round((monthResponses.reduce((sum, r) => sum + r.easeRating, 0) / monthResponses.length) * 10) / 10 
                        : 0
                });
            }

            const ratingDistribution = {
                veryEasy: allResponses.filter(r => r.easeRating === 7).length,    
                easy: allResponses.filter(r => r.easeRating === 6).length,        
                somewhatEasy: allResponses.filter(r => r.easeRating === 5).length, 
                neutral: allResponses.filter(r => r.easeRating === 4).length,     
                somewhatDifficult: allResponses.filter(r => r.easeRating === 3).length, 
                difficult: allResponses.filter(r => r.easeRating === 2).length,   
                veryDifficult: allResponses.filter(r => r.easeRating === 1).length 
            };

            const completionRate = totalTestSessions > 0 ? Math.round((completedSessions / totalTestSessions) * 100) : 0;
            const feedbackRate = totalResponses > 0 ? Math.round((responsesWithFeedback / totalResponses) * 100) : 0;

            const currentDate = new Date();
            let testingStreak = 0;
            const sortedSessions = testSessions
                .filter(ts => ts.status === 'COMPLETED')
                .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());

            if (sortedSessions.length > 0) {
                let streakDate = new Date(currentDate);
                streakDate.setHours(0, 0, 0, 0);
                
                for (const session of sortedSessions) {
                    const sessionDate = new Date(session.completedAt!);
                    sessionDate.setHours(0, 0, 0, 0);
                    
                    const daysDiff = Math.floor((streakDate.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));
                    
                    if (daysDiff <= testingStreak + 1) {
                        if (daysDiff === testingStreak || daysDiff === testingStreak + 1) {
                            if (daysDiff === testingStreak + 1) testingStreak++;
                        }
                    } else {
                        break;
                    }
                }
            }

            const dashboardData = {
                testingActivity: {
                    totalTestSessions,
                    completedSessions,
                    activeSessions,
                    uniqueProjectsTested,
                    completionRate
                },

                responseStats: {
                    totalResponses,
                    responsesWithFeedback,
                    feedbackRate,
                    avgSeqRating
                },

                recentActivity: {
                    recentSessions: recentSessions.length,
                    recentResponses: recentResponses.length,
                    recentProjects: new Set(recentSessions.map(ts => ts.project.id)).size
                },

                availableProjects: availableProjects.map(project => ({
                    id: project.id,
                    projectName: project.projectName,
                    description: project.description,
                    targetAudience: project.targetAudience,
                    developer: `${project.developer.firstName} ${project.developer.lastName}`,
                    createdAt: project.createdAt,
                    estimatedComponents: project._count.components,
                    currentTesters: project._count.testSessions
                })),

                testingHistory: testingHistory.slice(0, 20), 

                monthlyTrends,

                ratingDistribution,

                qualityMetrics: {
                    testingStreak,
                    completionRate,
                    feedbackRate,
                },

                achievements: {
                    firstTest: totalTestSessions >= 1,
                    prolificTester: totalTestSessions >= 10,
                    feedbackProvider: responsesWithFeedback >= 20,
                    projectExplorer: uniqueProjectsTested >= 5,
                    consistentTester: testingStreak >= 7,
                    thoroughTester: completionRate >= 90 && totalTestSessions >= 5
                },

                overview: {
                    totalContributions: totalResponses,
                    helpedDevelopers: uniqueProjectsTested,
                    testingLevel: totalTestSessions < 5 ? 'Beginner' : 
                                 totalTestSessions < 20 ? 'Intermediate' : 
                                 totalTestSessions < 50 ? 'Advanced' : 'Expert',
                    joinedDate: testSessions.length > 0 ? 
                        testSessions.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())[0].startedAt : 
                        null
                }
            };

            res.status(200).json({
                success: true,
                message: 'Tester dashboard data retrieved successfully',
                data: dashboardData
            });

        } catch (error) {
            console.error('Tester dashboard error:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to retrieve tester dashboard data. Please try again.'
            });
        }
    };

    static getTesterProjectDetails = async (req: Request, res: Response) => {
        try {
            if ((req as any).user?.role !== 'TESTER') {
                return res.status(403).json({
                    error: 'Insufficient Permissions',
                    message: 'Only testers can access this endpoint'
                });
            }

            const { projectId } = req.params;
            const testerId = (req as any).user?.id;

            const testSession = await prisma.testSession.findFirst({
                where: {
                    projectId,
                    testerId
                },
                include: {
                    seqResponses: true,
                    project: {
                        include: {
                            components: {
                                include: {
                                    seqTests: {
                                        include: {
                                            seqResponses: {
                                                where: {
                                                    session: {
                                                        testerId
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            developer: {
                                select: {
                                    firstName: true,
                                    lastName: true
                                }
                            }
                        }
                    }
                }
            });

            if (!testSession) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'Test session not found for this project'
                });
            }

            const componentProgress = testSession.project.components.map(component => {
                const componentResponses = component.seqTests.flatMap(st => st.seqResponses);
                const totalTests = component.seqTests.length;
                const completedTests = componentResponses.length;

                return {
                    id: component.id,
                    componentName: component.componentName,
                    description: component.description,
                    priority: component.priority,
                    focusAreas: component.focusAreas,
                    totalTests,
                    completedTests,
                    progress: totalTests > 0 ? Math.round((completedTests / totalTests) * 100) : 0,
                    avgRatingGiven: completedTests > 0 ? 
                        Math.round((componentResponses.reduce((sum, r) => sum + r.easeRating, 0) / completedTests) * 10) / 10 : 
                        0
                };
            });

            const sessionProgress = {
                sessionId: testSession.id,
                status: testSession.status,
                startedAt: testSession.startedAt,
                completedAt: testSession.completedAt,
                totalResponses: testSession.seqResponses.length,
                totalComponents: testSession.project.components.length,
                overallProgress: testSession.project.components.length > 0 ? 
                    Math.round((componentProgress.reduce((sum, cp) => sum + cp.progress, 0) / testSession.project.components.length)) : 0
            };

            res.status(200).json({
                success: true,
                message: 'Tester project details retrieved successfully',
                data: {
                    project: {
                        id: testSession.project.id,
                        projectName: testSession.project.projectName,
                        description: testSession.project.description,
                        targetAudience: testSession.project.targetAudience,
                        objectives: testSession.project.objectives,
                        developer: `${testSession.project.developer.firstName} ${testSession.project.developer.lastName}`
                    },
                    sessionProgress,
                    componentProgress: componentProgress.sort((a, b) => b.priority === 'HIGH' ? 1 : -1)
                }
            });

        } catch (error) {
            console.error('Tester project details error:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to retrieve project details. Please try again.'
            });
        }
    };
}