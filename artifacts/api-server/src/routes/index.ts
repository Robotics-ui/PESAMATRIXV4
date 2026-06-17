import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import subscriptionsRouter from "./subscriptions";
import paymentsRouter from "./payments";
import masterAccountsRouter from "./masterAccounts";
import slaveAccountsRouter from "./slaveAccounts";
import strategiesRouter from "./strategies";
import bindingsRouter from "./bindings";
import tradeLogsRouter from "./tradeLogs";
import dashboardRouter from "./dashboard";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(subscriptionsRouter);
router.use(paymentsRouter);
router.use(masterAccountsRouter);
router.use(slaveAccountsRouter);
router.use(strategiesRouter);
router.use(bindingsRouter);
router.use(tradeLogsRouter);
router.use(dashboardRouter);
router.use(adminRouter);

export default router;
