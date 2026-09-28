const fields = ['annualIncome', 'monthlyDebt', 'propertyValue', 'requestedLoan', 'creditScore'];

export class ValidationError extends Error {
  constructor(details) {
    super('Request validation failed.');
    this.name = 'ValidationError';
    this.details = details;
  }
}

export function validateApplication(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError([{ field: 'body', message: 'Must be a JSON object.' }]);
  }
  const input = {};
  const details = [];
  for (const field of fields) {
    const number = Object.hasOwn(value, field) ? value[field] : undefined;
    if (typeof number !== 'number' || !Number.isFinite(number) || number <= 0) {
      details.push({ field, message: 'Must be a finite number greater than zero.' });
    } else if (field === 'creditScore' && !Number.isInteger(number)) {
      details.push({ field, message: 'Must be an integer.' });
    } else {
      input[field] = number;
    }
  }
  if (details.length) throw new ValidationError(details);
  const income = input.annualIncome / 12;
  if (!Number.isFinite(income) || income <= 0) {
    throw new ValidationError([{ field: 'annualIncome', message: 'Must produce finite monthly income greater than zero.' }]);
  }
  for (const [field, ratio] of [
    ['monthlyDebt', input.monthlyDebt / income],
    ['requestedLoan', input.requestedLoan / input.propertyValue],
  ]) {
    if (!Number.isFinite(ratio) || ratio <= 0) {
      details.push({ field, message: 'Must produce a finite ratio greater than zero.' });
    }
  }
  if (details.length) throw new ValidationError(details);
  return input;
}
