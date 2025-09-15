import { Router } from 'express';
import { validateAuth } from '../middleware/validateAuth';
import { validateData } from '../middleware/validateData';
import { projectSchema } from '../models/projectSchemas';   
import { ProjectController } from '../controllers/ProjectController';

const router = Router();

// Developer-focused project routes
router.post('/create', validateAuth, validateData(projectSchema), ProjectController.createProject);
router.get('/my-projects', validateAuth, ProjectController.getDeveloperProjects); // Get developer's own projects with filtering
router.get('/:id', validateAuth, ProjectController.getProjectDetails); // Developer can only view their own projects
router.patch('/:id/status', validateAuth, ProjectController.updateProjectStatus); // Update project status (ACTIVE -> COMPLETED)



export default router;