export type PlanInputs = {
  name: string;
  dateOfBirth: string;
  startAssets: number;
  startDebt: number;
  monthlySpending: number;
  annualIncome: number;
  rentalIncome: number;
  rentalIncomeRate: number;
  windfallAmount: number;
  windfallYear: number;
  nominalReturn: number;
  inflationRate: number;
  horizonYears: number;
  cashBalance: number;
  nonLiquidInvestments: number;
  otherFixedAssets: number;
  primaryResidenceValue: number;
  otherPropertyValue: number;
  primaryResidenceRate: number;
  otherPropertyRate: number;
};

export type ProjectionPoint = {
  year: number;
  age: number;
  netWorth: number;
  liquid: number;
  savings: number;
  otherAssets: number;
  realEstate: number;
  debt: number;
};

export const DEFAULT_PLAN_INPUTS: PlanInputs = {
  name: "",
  dateOfBirth: "1985-01-01",
  startAssets: 250_000,
  startDebt: 50_000,
  monthlySpending: 5_000,
  annualIncome: 120_000,
  rentalIncome: 0,
  rentalIncomeRate: 0.02,
  windfallAmount: 0,
  windfallYear: new Date().getFullYear() + 10,
  nominalReturn: 0.06,
  inflationRate: 0.02,
  horizonYears: 30,
  cashBalance: 20_000,
  nonLiquidInvestments: 0,
  otherFixedAssets: 0,
  primaryResidenceValue: 400_000,
  otherPropertyValue: 0,
  primaryResidenceRate: 0.03,
  otherPropertyRate: 0.03
};
