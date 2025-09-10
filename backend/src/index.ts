import express, { Express, Response, Request, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoute from "./routes/auth";

dotenv.config();
const app: Express = express();

const port = process.env.PORT!;

const corsOptions = {
    origin: [
        'http://localhost:3000',  // React dev server
        'http://localhost:5173',  // Vite dev server  
        'https://town-hall-backend.onrender.com', // Your deployed frontend URL
    ].filter(Boolean), // Remove any undefined values
    credentials: true, // Allow cookies/credentials
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With',
        'Accept',
        'Origin'
    ]
};

app.use(cors(corsOptions));

app.use(express.json());

app.use('/auth', authRoute);

app.listen(port, () => {
    console.log(`Server is running on port http://localhost:${port}`);
})
