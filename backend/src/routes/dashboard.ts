import { Router } from 'express';
import { validateAuth } from '../middleware/validateAuth';
import { DashboardController } from '../controllers/DashboardController';

const router = Router();

// Developer Dashboard routes
router.get('/developer/stats', validateAuth, DashboardController.getDeveloperDashboard);
router.get('/developer/project/:projectId/analytics', validateAuth, DashboardController.getProjectAnalytics);

// Tester Dashboard routes
router.get('/tester/stats', validateAuth, DashboardController.getTesterDashboard);
router.get('/tester/project/:projectId/details', validateAuth, DashboardController.getTesterProjectDetails);

export default router;