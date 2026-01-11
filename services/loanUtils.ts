
import { parseCurrency } from '../utils/format';

interface LoanCalculationParams {
  initialAmount: string;
  interestRate: string;
  loanTermMonths: string;
  paymentFrequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  interestType: 'FIXED' | 'DIMINISHING';
}

export const calculateLoanProjection = (params: LoanCalculationParams) => {
    const P = parseCurrency(params.initialAmount);
    if (!P || P <= 0) return null;

    const monthlyRate = parseFloat(params.interestRate) || 0;
    const months = parseInt(params.loanTermMonths) || 1;
    
    // Frequency divider (How many payments per month)
    let freqDivider = 1;
    if (params.paymentFrequency === 'BIWEEKLY') freqDivider = 2;
    if (params.paymentFrequency === 'WEEKLY') freqDivider = 4;
    if (params.paymentFrequency === 'DAILY') freqDivider = 30; // Standard commercial month

    const totalInstallments = months * freqDivider;
    const periodicRate = (monthlyRate / 100) / freqDivider; 

    let quota = 0;
    let totalInterest = 0;
    let firstPeriodInterest = 0;

    if (params.interestType === 'FIXED') {
       totalInterest = P * (monthlyRate / 100) * months;
       const totalPay = P + totalInterest;
       quota = totalPay / totalInstallments;
       firstPeriodInterest = totalInterest / totalInstallments; 
    } else {
       if (periodicRate > 0) {
          quota = P * (periodicRate * Math.pow(1 + periodicRate, totalInstallments)) / (Math.pow(1 + periodicRate, totalInstallments) - 1);
          totalInterest = (quota * totalInstallments) - P;
          firstPeriodInterest = P * periodicRate;
       } else {
          quota = P / totalInstallments;
          totalInterest = 0;
       }
    }

    return {
       quota: Math.round(quota),
       totalInterest: Math.round(totalInterest),
       totalInstallments,
       firstPeriodInterest: Math.round(firstPeriodInterest)
    };
};

export const calculateNextPaymentDate = (startDateStr: string, frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'): string => {
    const date = new Date(startDateStr);
    // Adjust for timezone offset to prevent date shifting on simple additions
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const normalizedDate = new Date(date.getTime() + userTimezoneOffset);

    switch (frequency) {
        case 'DAILY':
            normalizedDate.setDate(normalizedDate.getDate() + 1);
            break;
        case 'WEEKLY':
            normalizedDate.setDate(normalizedDate.getDate() + 7);
            break;
        case 'BIWEEKLY':
            normalizedDate.setDate(normalizedDate.getDate() + 15);
            break;
        case 'MONTHLY':
            normalizedDate.setMonth(normalizedDate.getMonth() + 1);
            break;
        default:
            normalizedDate.setMonth(normalizedDate.getMonth() + 1);
    }
    
    return normalizedDate.toISOString().split('T')[0];
};
