import express, { Express, Response, Request, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoute from "./routes/auth";
import projectRoute from "./routes/project";

dotenv.config();
const app: Express = express();

const port = process.env.PORT!;

app.use(cors());

app.use(express.json());

// Add this to your index.ts for debugging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    console.log('Query params:', req.query);
    console.log('Body:', req.body);
    next();
});

app.use('/auth', authRoute);
app.use('/project', projectRoute);

app.listen(port, () => {
    console.log(`Server is running on port http://localhost:${port}`);
})
