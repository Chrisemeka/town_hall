import { Request, Response } from 'express';
import prisma from '../prisma';
import { RegisterUserInput, LoginUserInput } from '../models/userSchemas';
import jwt, { JwtPayload } from 'jsonwebtoken';
import sendOtpEmail from '../services/sendOtpEmail';
import generateOTP from '../services/generateOTP';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy, Profile } from 'passport-github2';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const generateAccessToken = (user: any) => {
    return jwt.sign(
        { 
            id: user.id, 
            email: user.email, 
            role: user.role,
            firstName: user.firstName,
            lastName: user.lastName 
        }, 
        process.env.JWT_SECRET!, 
        { expiresIn: '15m' }
    );
};

const generateRefreshToken = () => {
    return crypto.randomBytes(40).toString('hex');
};

const storeRefreshToken = async (userId: string, refreshToken: string) => {
    const hashedToken = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    await prisma.refreshToken.create({
        data: {
            userId,
            tokenHash: hashedToken,
            expiresAt
        }
    });
};

const cleanExpiredTokens = async (userId: string) => {
    await prisma.refreshToken.deleteMany({
        where: {
            userId,
            OR: [
                { expiresAt: { lt: new Date() } },
                { revoked: true }
            ]
        }
    });
};

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: 'https://town-hall-backend.onrender.com/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails![0].value;
        const profileId = profile.id;
        
        const existingUser = await prisma.user.findUnique({ 
            where: { email: email } 
        });

        if(existingUser){
            const existingGoogleAccount = await prisma.oauthAccount.findFirst({
                where: {
                    userId: existingUser.id,
                    provider: 'GOOGLE'
                }
            });

            if (!existingGoogleAccount) {
                await prisma.oauthAccount.create({
                    data: {
                        userId: existingUser.id,
                        provider: 'GOOGLE',
                        providerUserId: profile.id,
                        providerEmail: email,
                    }
                });
                
                if (!existingUser.profilePictureUrl && profile.photos![0]) {
                    await prisma.user.update({
                        where: { id: existingUser.id },
                        data: { profilePictureUrl: profile.photos![0].value }
                    });
                }
            } else {
                await prisma.oauthAccount.update({
                    where: { id: existingGoogleAccount.id },
                    data: { 
                        updatedAt: new Date(),
                    }
                });
            }

            return done(null, existingUser);
        }

        const tempUser = {
            email: email,
            profileId: profileId,
            firstName: profile.name!.givenName,
            lastName: profile.name!.familyName,
            isVerified: true,
            authProvider: 'GOOGLE',
            profilePictureUrl: profile.photos![0].value,
            isNewUser: true
        }
        
        return done(null, tempUser);
    } catch (error) {
        return done(error);
    }
}));

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    callbackURL: 'https://town-hall-backend.onrender.com/auth/github/callback'
}, async (accessToken: string, refreshToken: string, profile: Profile, done: (error: any, user?: any) => void) => {
    try {
        
        let email: string;
        if (profile.emails && profile.emails.length > 0) {
            email = profile.emails[0].value;
        } else {
            return done(new Error('GitHub email is private. Please make your email public in GitHub settings or use a different authentication method.'));
        }
        
        const existingUser = await prisma.user.findUnique({ 
            where: { email: email } 
        });
        
        if (existingUser) {
            const existingGitHubAccount = await prisma.oauthAccount.findFirst({
                where: {
                    userId: existingUser.id,
                    provider: 'GITHUB'
                }
            });

            if (!existingGitHubAccount) {
                await prisma.oauthAccount.create({
                    data: {
                        userId: existingUser.id,
                        provider: 'GITHUB',
                        providerUserId: profile.id,
                        providerEmail: email,
                    }
                });
                
                if (!existingUser.profilePictureUrl && profile.photos && profile.photos[0]) {
                    await prisma.user.update({
                        where: { id: existingUser.id },
                        data: { profilePictureUrl: profile.photos[0].value }
                    });
                }
            } else {
                await prisma.oauthAccount.update({
                    where: { id: existingGitHubAccount.id },
                    data: { 
                        updatedAt: new Date(),
                    }
                });
            }
            
            return done(null, existingUser);
        }

        const displayName = profile.displayName || profile.username || '';
        const nameParts = displayName.split(' ');
        
        const tempUser = {
            email: email,
            profileId: profile.id, 
            firstName: nameParts[0] || profile.username || 'GitHub',
            lastName: nameParts[1] || 'User',
            isVerified: true,
            authProvider: 'GITHUB',
            profilePictureUrl: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
            isNewUser: true
        }

        return done(null, tempUser);
    } catch (error) {
        console.error('GitHub OAuth Strategy Error:', error);
        return done(error);
    }
}));

export class AuthController {
    static register = async (req: Request, res: Response) => { 
        try {
            const { firstName, lastName, email, password, role } = req.body as RegisterUserInput;
            
            if (!firstName || !lastName || !email || !password || !role) {
                return res.status(400).json({ message: 'All fields are required' });
            }

            const existingUser = await prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                return res.status(400).json({ message: 'Account already exists' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const otp = generateOTP();
            const hashedOTP = await bcrypt.hash(otp, 10);
            const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

            const user = await prisma.user.create({
                data: {
                    firstName,
                    lastName,
                    email,
                    password: hashedPassword,
                    role: role,
                }
            });

            await prisma.otp.create({
                data: {
                    userId: user.id,
                    otpHash: hashedOTP,
                    expiresAt: otpExpiry,
                }
            });

            await sendOtpEmail({ email, otp, userName: `${firstName} ${lastName}` });
            return res.status(200).json({ message: 'User registered successfully' });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: 'Internal server error. Cannot register the account', error: error });
        }
    }

    static verify = async (req: Request, res: Response) => {
        try {
            const { email, otp } = req.body;
            
            const user = await prisma.user.findUnique({ where: { email } });
            if (!user) {
                return res.status(404).json({ message: 'Account not found' });
            }

            const otpRecord = await prisma.otp.findFirst({
                where: {
                    userId: user.id,
                    expiresAt: { gt: new Date() }
                }
            }); 

            if (!otpRecord) {
                return res.status(400).json({ message: 'OTP has expired or is invalid' });
            }

            const isValidOtp = await bcrypt.compare(otp, otpRecord.otpHash);
            if (!isValidOtp) {
                return res.status(400).json({ message: 'Invalid OTP' });
            }

            await prisma.$transaction([
                prisma.user.update({ 
                    where: { id: user.id }, 
                    data: { isVerified: true } 
                }),
                prisma.otp.delete({ where: { id: otpRecord.id } })
            ]);
            
            return res.status(200).json({ message: 'Account verified successfully' });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: 'Internal server error. Cannot verify the account', error: error });
        }
    }

    static login = async (req: Request, res: Response) => {
        try {
            const { email, password } = req.body as LoginUserInput;
            
            const user = await prisma.user.findUnique({ where: { email } });
            if (!user) {
                return res.status(404).json({ message: 'Account not found' });
            }

            if (user.authProvider === 'LOCAL' && !user.isVerified) {
                return res.status(401).json({ message: 'Please verify your email first' });
            }

            const isPasswordValid = await bcrypt.compare(password, user.password!);
            if (!isPasswordValid) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            await cleanExpiredTokens(user.id);

            const accessToken = generateAccessToken(user);
            const refreshToken = generateRefreshToken();
            
            await storeRefreshToken(user.id, refreshToken);

            return res.status(200).json({ 
                message: 'Login successful', 
                user: {
                    id: user.id,
                    email: user.email, 
                    role: user.role,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    profilePictureUrl: user.profilePictureUrl
                }, 
                accessToken,
                refreshToken
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: 'Internal server error. Cannot login account', error: error });
        }
    }

    static googleCallback = async (req: Request, res: Response) => {
        try {
            const user = req.user as any;
            const selectedRole = req.query.state as string;
            const frontendUrl = process.env.FRONTEND_URL_DEVELOPEMENT;
            
            if (!user) {
                return res.status(401).json({ message: 'Google authentication failed' });
            }

            const validRoles = ['TESTER', 'DEVELOPER'] as const;
            if (!selectedRole || !validRoles.includes(selectedRole as any)) {
                return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(
                    'Invalid role selected. Please choose either TESTER or DEVELOPER.')}`);
            }

            const role = selectedRole as 'TESTER' | 'DEVELOPER';

            if (user.isNewUser) {
                const newUser = await prisma.user.create({
                    data: {
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        isVerified: true,
                        role: role,
                        authProvider: 'GOOGLE',
                        profilePictureUrl: user.profilePictureUrl
                    }
                })
                await prisma.oauthAccount.create({
                    data: {
                        userId: newUser.id,
                        provider: 'GOOGLE',
                        providerUserId: user.profileId,
                        providerEmail: user.email,
                    }
                });

                user.id = newUser.id;
                user.role = role;
            } else{
                if (user.role != selectedRole) {
                    return res.redirect(401, `${frontendUrl}/login?error=${encodeURIComponent(
              `Account exists as ${user.role}. Please use the ${user.role} login.`)}`);
                }
            }

            await cleanExpiredTokens(user.id);

            const accessToken = generateAccessToken(user);
            const refreshToken = generateRefreshToken();
            
            await storeRefreshToken(user.id, refreshToken);

            return res.redirect(`${frontendUrl}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`);
        } catch (error) {
            console.error('OAuth callback error: ', error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }

    static githubCallback = async (req: Request, res: Response) => {
        try {
            const user = req.user as any;
            const selectedRole = req.query.state as string;
            const frontendUrl = process.env.FRONTEND_URL_DEVELOPEMENT;
            
            if (!user) {
                return res.status(401).json({ message: 'GitHub authentication failed' }); 
            }

            const validRoles = ['TESTER', 'DEVELOPER'] as const;
            if (!selectedRole || !validRoles.includes(selectedRole as any)) {
                return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(
                    'Invalid role selected. Please choose either TESTER or DEVELOPER.')}`);
            }

            const role = selectedRole as 'TESTER' | 'DEVELOPER';

            if (user.isNewUser) {
                const newUser = await prisma.user.create({
                    data: {
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        isVerified: true,
                        role: role,
                        authProvider: 'GITHUB',
                        profilePictureUrl: user.profilePictureUrl
                    }
                })
                await prisma.oauthAccount.create({
                    data: {
                        userId: newUser.id,
                        provider: 'GITHUB',
                        providerUserId: user.profileId,
                        providerEmail: user.email,
                    }
                })

                user.id = newUser.id;
                user.role = role;
            } else {
                if (user.role != selectedRole) {
                    return res.redirect(401, `${frontendUrl}/login?error=${encodeURIComponent(
              `Account exists as ${user.role}. Please use the ${user.role} login.`)}`);
                }
            }

            await cleanExpiredTokens(user.id);

            const accessToken = generateAccessToken(user);
            const refreshToken = generateRefreshToken();
            
            await storeRefreshToken(user.id, refreshToken);

            return res.redirect(`${frontendUrl}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`);
        } catch (error) {
            console.error('OAuth callback error: ', error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }

    static refreshToken = async (req: Request, res: Response) => {
        try {
            const { refreshToken } = req.body;
            
            if (!refreshToken) {
                return res.status(401).json({ message: 'Refresh token required' });
            }

            const storedTokens = await prisma.refreshToken.findMany({
                where: {
                    expiresAt: { gt: new Date() },
                    revoked: false
                },
                include: {
                    user: true
                }
            });

            let validToken = null;
            let matchedUser = null;

            for (const token of storedTokens) {
                const isValid = await bcrypt.compare(refreshToken, token.tokenHash);
                if (isValid) {
                    validToken = token;
                    matchedUser = token.user;
                    break;
                }
            }

            if (!validToken || !matchedUser) {
                return res.status(401).json({ message: 'Invalid or expired refresh token' });
            }

            await prisma.refreshToken.update({
                where: { id: validToken.id },
                data: { lastUsed: new Date() }
            });

            const newAccessToken = generateAccessToken(matchedUser);

            return res.status(200).json({
                message: 'Token refreshed successfully',
                accessToken: newAccessToken
            });

        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }

    static logout = async (req: Request, res: Response) => {
        try {
            const { refreshToken } = req.body;
            
            if (refreshToken) {
                const storedTokens = await prisma.refreshToken.findMany({
                    where: { revoked: false }
                });

                for (const token of storedTokens) {
                    const isMatch = await bcrypt.compare(refreshToken, token.tokenHash);
                    if (isMatch) {
                        await prisma.refreshToken.update({
                            where: { id: token.id },
                            data: { revoked: true }
                        });
                        break;
                    }
                }
            }

            return res.status(200).json({ message: 'Logged out successfully' });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }
}