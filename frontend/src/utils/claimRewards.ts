export const DEFAULT_CLAIM_REWARD_VALUE = 250000;

export const CLAIM_VALUE_BY_TIER: Record<string, number> = {
  silver: 650000,
  gold: 1200000,
  diamond: 2400000,
};

export const getClaimRewardValue = (tierId: string, rewardValue?: number): number => {
  if (typeof rewardValue === 'number' && Number.isFinite(rewardValue) && rewardValue > 0) {
    return rewardValue;
  }

  return CLAIM_VALUE_BY_TIER[tierId] ?? DEFAULT_CLAIM_REWARD_VALUE;
};