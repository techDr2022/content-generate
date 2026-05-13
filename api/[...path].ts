import "../server/src/loadEnv";
import serverless from "serverless-http";
import { createApp } from "../server/src/app";

const app = createApp();

export default serverless(app);
