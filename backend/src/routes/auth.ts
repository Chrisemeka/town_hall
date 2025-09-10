import { Router } from 'express';
import passport from 'passport';
import { validateData } from '../middleware/validateData';
import { registerUserSchema, loginUserSchema } from '../models/userSchemas';
import { AuthController } from '../controllers/AuthController';

const router = Router();

router.use((req, res, next) => {
    console.log('=== AUTH ROUTE HIT ===');
    console.log('Method:', req.method);
    console.log('Original URL:', req.originalUrl);
    console.log('Path:', req.path);
    console.log('Query params:', req.query);
    console.log('Headers host:', req.headers.host);
    console.log('Headers origin:', req.headers.origin);
    console.log('Headers referer:', req.headers.referer);
    console.log('===================');
    next();
});

router.post('/register', validateData(registerUserSchema), AuthController.register);
router.post('/verify', AuthController.verify);
router.post('/login', validateData(loginUserSchema), AuthController.login);
router.post('/logout', AuthController.logout);
router.post('/refresh-token', AuthController.refreshToken);

router.get('/google', (req, res, next) => {

    console.log('=== GOOGLE OAUTH INIT ===');
    console.log('Full URL:', req.protocol + '://' + req.get('host') + req.originalUrl);
    console.log('Role from query:', req.query.role);
    console.log('All query params:', JSON.stringify(req.query, null, 2));

    const role = req.query.role as string;
    if (!role || !['DEVELOPER', 'TESTER'].includes(role)) {
        console.log('❌ Invalid or missing role:', role);
        return res.redirect(`${process.env.FRONTEND_URL_DEVELOPEMENT}/login?error=invalid_role`);
    }

    console.log('✅ Valid role provided:', role);
    console.log('Calling passport.authenticate...');

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

router.get('/test', (req, res) => {
    res.json({ 
        message: 'Auth routes are working',
        timestamp: new Date().toISOString(),
        env: {
            frontend_url: process.env.FRONTEND_URL_DEVELOPEMENT,
            google_client_id_set: !!process.env.GOOGLE_CLIENT_ID
        }
    });
});


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
router.get('/github/callback', 
    passport.authenticate('github', { 
        session: false,
        failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/login?error=auth_failed`
    }),
    AuthController.githubCallback
);

export default router;