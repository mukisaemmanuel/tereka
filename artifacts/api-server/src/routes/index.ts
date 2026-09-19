import { Router, type IRouter } from "express";
import healthRouter from "./health";
import financeRouter from "./finance";
import authRouter from "./auth";
import campaignsRouter from "./campaigns";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(campaignsRouter);
router.use(financeRouter);

export default router;
