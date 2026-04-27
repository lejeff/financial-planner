export {
  DEBT_REPAYMENT_TYPES,
  DEFAULT_PLAN_INPUTS,
  MAX_APPRECIATION,
  MAX_DEBT_INTEREST_RATE,
  MAX_HORIZON_YEARS,
  MAX_RETIREMENT_AGE,
  MIN_APPRECIATION,
  MIN_DEBT_INTEREST_RATE,
  MIN_HORIZON_YEARS,
  MIN_RETIREMENT_AGE,
  PlanInputsSchema
} from "./planInputs";
export type { DebtRepaymentType, PlanInputs, ProjectionPoint } from "./planInputs";
export {
  ageFromDob,
  clampHorizon,
  computeOverTimeAnnualPayment,
  deflateToToday,
  projectNetWorth
} from "./projection";
