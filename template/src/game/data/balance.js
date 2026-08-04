/** balance.js — числа баланса игры. Меняй только здесь при балансировке. */
export const Balance = {
  startCoins: 0, startLives: 3,
  scorePerAction: 10, bonusMultiplier: 2,
  rewardedCoinsBonus: 50,
  levels: [
    { id: 1, target: 100, timeLimit: 60 },
    { id: 2, target: 200, timeLimit: 55 },
    { id: 3, target: 350, timeLimit: 50 },
  ],
};
