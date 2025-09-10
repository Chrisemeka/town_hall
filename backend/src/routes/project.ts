import { Router } from 'express';
import { validateAuth } from '../middleware/validateAuth';
import { validateData } from '../middleware/validateData';
import { projectSchema } from '../models/projectSchemas';   
import { ProjectController } from '../controllers/ProjectController';

const router = Router();

router.post('/create-project', validateAuth, validateData(projectSchema), ProjectController.createProject); // Only developers can create projects
router.get('/projects', validateAuth, ProjectController.getAllProjects); // Only testers can get all projects
router.get('/:id', validateAuth, ProjectController.getProjectDetails);// Only testers can get all project details, developer can only get there own project details


export default router;