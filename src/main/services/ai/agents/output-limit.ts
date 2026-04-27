export function capAgentOutputTokens(defaultMaxTokens: number, modelMaxTokens: number | undefined) {
    return modelMaxTokens && modelMaxTokens > 0
        ? Math.min(defaultMaxTokens, modelMaxTokens)
        : defaultMaxTokens;
}
