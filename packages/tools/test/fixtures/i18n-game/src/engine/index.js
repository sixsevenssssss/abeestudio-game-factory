// Заглушка ядра для фикстуры (в реальной игре приходит из @abeestudio/engine)
export const Engine = { start() {} };
export const L10n = { t: (k) => k };
export const Save = { get: (k, d) => d };
