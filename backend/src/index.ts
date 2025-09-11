import express, { Express, Response, Request, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoute from "./routes/auth";
import projectRoute from "./routes/project";

dotenv.config();
const app: Express = express();

const port = process.env.PORT!;

app.use(cors({
  origin: true, 
  credentials: true
}));

app.use(express.json());


app.use('/auth', authRoute);
app.use('/project', projectRoute);

app.listen(port, () => {
    console.log(`Server is running on port http://localhost:${port}`);
})
