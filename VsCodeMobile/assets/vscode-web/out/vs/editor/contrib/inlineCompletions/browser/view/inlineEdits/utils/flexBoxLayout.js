/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Distributes a total size into parts that each have a list of growth rules.
 * Returns `null` if the layout is not possible.
 * The sum of all returned sizes will be equal to `totalSize`.
 *
 * First, each part gets its minimum size.
 * Then, remaining space is distributed to the rules with the highest priority, as long as the max constraint allows it (considering share).
 * This continues with next lower priority rules until no space is left.
*/
export function distributeFlexBoxLayout(totalSize, parts) {
    // Normalize parts to always have array of rules
    const normalizedParts = {};
    for (const [key, part] of Object.entries(parts)) {
        if (Array.isArray(part)) {
            normalizedParts[key] = { min: 0, rules: part };
        }
        else {
            normalizedParts[key] = {
                min: part.min ?? 0,
                rules: part.rules ?? [{ max: part.max, priority: part.priority, share: part.share }]
            };
        }
    }
    // Initialize result with minimum sizes
    const result = {};
    let usedSize = 0;
    for (const [key, part] of Object.entries(normalizedParts)) {
        result[key] = part.min;
        usedSize += part.min;
    }
    // Check if we can satisfy minimum constraints
    if (usedSize > totalSize) {
        return null;
    }
    let remainingSize = totalSize - usedSize;
    // Distribute remaining space by priority levels
    while (remainingSize > 0) {
        // Find all rules at current highest priority that can still grow
        const candidateRules = [];
        for (const [key, part] of Object.entries(normalizedParts)) {
            for (let i = 0; i < part.rules.length; i++) {
                const rule = part.rules[i];
                const currentUsage = result[key];
                const maxSize = rule.max ?? Infinity;
                if (currentUsage < maxSize) {
                    candidateRules.push({
                        partKey: key,
                        ruleIndex: i,
                        rule,
                        priority: rule.priority ?? 0,
                        share: rule.share ?? 1
                    });
                }
            }
        }
        if (candidateRules.length === 0) {
            // No rules can grow anymore, but we have remaining space
            break;
        }
        // Find the highest priority among candidates
        const maxPriority = Math.max(...candidateRules.map(c => c.priority));
        const highestPriorityCandidates = candidateRules.filter(c => c.priority === maxPriority);
        // Calculate total share
        const totalShare = highestPriorityCandidates.reduce((sum, c) => sum + c.share, 0);
        // Distribute space proportionally by share
        let distributedThisRound = 0;
        const distributions = [];
        for (const candidate of highestPriorityCandidates) {
            const rule = candidate.rule;
            const currentUsage = result[candidate.partKey];
            const maxSize = rule.max ?? Infinity;
            const availableForThisRule = maxSize - currentUsage;
            // Calculate ideal share
            const idealShare = (remainingSize * candidate.share) / totalShare;
            const actualAmount = Math.min(idealShare, availableForThisRule);
            distributions.push({
                partKey: candidate.partKey,
                ruleIndex: candidate.ruleIndex,
                amount: actualAmount
            });
            distributedThisRound += actualAmount;
        }
        if (distributedThisRound === 0) {
            // No progress can be made
            break;
        }
        // Apply distributions
        for (const dist of distributions) {
            result[dist.partKey] += dist.amount;
        }
        remainingSize -= distributedThisRound;
        // Break if remaining is negligible (floating point precision)
        if (remainingSize < 0.0001) {
            break;
        }
    }
    return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmxleEJveExheW91dC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL3ZpZXcvaW5saW5lRWRpdHMvdXRpbHMvZmxleEJveExheW91dC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQWNoRzs7Ozs7Ozs7RUFRRTtBQUNGLE1BQU0sVUFBVSx1QkFBdUIsQ0FDdEMsU0FBaUIsRUFDakIsS0FBNEU7SUFFNUUsZ0RBQWdEO0lBQ2hELE1BQU0sZUFBZSxHQUF3RSxFQUFFLENBQUM7SUFDaEcsS0FBSyxNQUFNLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUNqRCxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUN6QixlQUFlLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQztRQUNoRCxDQUFDO2FBQU0sQ0FBQztZQUNQLGVBQWUsQ0FBQyxHQUFHLENBQUMsR0FBRztnQkFDdEIsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQztnQkFDbEIsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLLElBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7YUFDcEYsQ0FBQztRQUNILENBQUM7SUFDRixDQUFDO0lBRUQsdUNBQXVDO0lBQ3ZDLE1BQU0sTUFBTSxHQUEyQixFQUFFLENBQUM7SUFDMUMsSUFBSSxRQUFRLEdBQUcsQ0FBQyxDQUFDO0lBQ2pCLEtBQUss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