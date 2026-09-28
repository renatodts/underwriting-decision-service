import { validateApplication } from './validation.js';

export function evaluateApplication(value) {
  const input = validateApplication(value);
  const debtToIncome = input.monthlyDebt / (input.annualIncome / 12);
  const loanToValue = input.requestedLoan / input.propertyValue;
  const reasons = [];
  const add = (code, severity, message) => reasons.push({ code, severity, message });

  if (input.creditScore < 600) {
    add('CREDIT_SCORE_BELOW_600', 'DECLINE', 'Credit score is below 600.');
  } else if (input.creditScore < 680) {
    add('CREDIT_SCORE_BELOW_680', 'REFER', 'Credit score is below 680 and requires manual review.');
  }
  if (debtToIncome > 0.50) {
    add('DTI_ABOVE_050', 'DECLINE', 'Debt-to-income ratio exceeds 50%.');
  } else if (debtToIncome > 0.40) {
    add('DTI_ABOVE_040', 'REFER', 'Debt-to-income ratio exceeds 40% and requires manual review.');
  }
  if (loanToValue > 0.90) {
    add('LTV_ABOVE_090', 'DECLINE', 'Loan-to-value ratio exceeds 90%.');
  } else if (loanToValue > 0.80) {
    add('LTV_ABOVE_080', 'REFER', 'Loan-to-value ratio exceeds 80% and requires manual review.');
  }
  const decision = reasons.some(reason => reason.severity === 'DECLINE')
    ? 'DECLINE' : reasons.length ? 'REFER' : 'APPROVE';
  return {
    decision,
    approvedAmount: decision === 'APPROVE' ? Math.min(input.requestedLoan, input.propertyValue * 0.8) : null,
    metrics: { debtToIncome, loanToValue },
    reasons,
  };
}
