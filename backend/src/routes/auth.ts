import { Router } from 'express';
import passport from 'passport';
import { validateData } from '../middleware/validateData';
import { registerUserSchema, loginUserSchema } from '../models/userSchemas';
import { AuthController } from '../controllers/AuthController';

const router = Router();

router.post('/register', validateData(registerUserSchema), AuthController.register);
router.post('/verify', AuthController.verify);
router.post('/login', validateData(loginUserSchema), AuthController.login);
router.post('/logout', AuthController.logout);
router.post('/refresh-token', AuthController.refreshToken);

router.get('/google', (req, res, next) => {

    const role = req.query.role as string;
    if (!role || !['DEVELOPER', 'TESTER'].includes(role)) {
        return res.redirect(`${process.env.FRONTEND_URL_DEVELOPEMENT}/login?error=invalid_role`);
    }

    passport.authenticate('google', {
        scope: ['profile', 'email'],
        state: role 
    })(req, res, next);
});

router.get('/google/callback', (req, res,next) => {
    passport.authenticate('google', { 
        session: false,
        failureRedirect: `${process.env.FRONTEND_URL_DEVELOPEMENT}/login?error=auth_failed`
    })(req, res, next);},
    AuthController.googleCallback
);

router.get('/github', (req, res, next) => {
    const role = req.query.role as string;
    if (!role || !['DEVELOPER', 'TESTER'].includes(role)) {
        return res.redirect(`${process.env.FRONTEND_URL_DEVELOPEMENT}/login?error=invalid_role`);
    }
    
    passport.authenticate('github', {
        scope: ['user:email'],
        state: role 
    })(req, res, next);
});
router.get('/github/callback', (req, res,next) => {
    passport.authenticate('github', { 
        session: false,
        failureRedirect: `${process.env.FRONTEND_URL_DEVELOPEMENT}/login?error=auth_failed`
    })(req, res, next);},
    AuthController.githubCallback
);


export default router;