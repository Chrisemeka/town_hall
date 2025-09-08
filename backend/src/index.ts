import express, { Express, Response, Request, NextFunction } from "express";
import dotenv from "dotenv";
import authRoute from "./routes/auth";

dotenv.config();
const app: Express = express();

const port = process.env.PORT!;

app.use(express.json());

app.use('/auth', authRoute);

app.listen(port, () => {
    console.log(`Server is running on port http://localhost:${port}`);
})
