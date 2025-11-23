/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
let previouslyRecommededInSession = false;
const terminalCommands = [
    {
        commands: [
            new RegExp(/^python3? -m pip install(\b)/),
            new RegExp(/^pip3? install(\b)/),
        ],
        tags: ['python environment'],
    },
    {
        commands: [
            new RegExp(/^python3? -m jupyter(\b)/),
            new RegExp(/^python3? -m pip install\b.*jupyter\b.*/),
            new RegExp(/^pip3? install\b.*jupyter\b.*/),
            new RegExp(/^jupyter(\b)/), // jupyter lab, jupyer notebook, jupyter nbconvert, etc.
        ],
        tags: ['python environment', 'jupyter environment'],
    }
];
export function getRecommendedToolsOverRunInTerminal(commandLine, languageModelToolsService) {
    const tools = languageModelToolsService.getTools();
    if (!tools || previouslyRecommededInSession) {
        return;
    }
    const recommendedTools = new Set();
    const messages = [
        `The terminal command '${commandLine}' was not executed.`,
        `Try using some of the following tools instead of running a Terminal Command (if unable to use one of these tools as an alternative then run the same terminal command again):`,
    ];
    for (const terminalCommand of terminalCommands) {
        if (!terminalCommand.commands.some((condition) => condition.test(commandLine))) {
            continue;
        }
        const tagsToSearchFor = terminalCommand.tags;
        Array.from(tools)
            .filter(t => tagsToSearchFor.some(tag => t.tags?.includes(tag)))
            .forEach(tool => {
            recommendedTools.add(tool.id);
        });
    }
    recommendedTools.forEach(toolName => {
        messages.push(`- ${toolName}`);
    });
    if (recommendedTools.size) {
        previouslyRecommededInSession = true;
        return messages.join('  \n');
    }
    return undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWx0ZXJuYXRpdmVSZWNvbW1lbmRhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvY2hhdEFnZW50VG9vbHMvYnJvd3Nlci9hbHRlcm5hdGl2ZVJlY29tbWVuZGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBSWhHLElBQUksNkJBQTZCLEdBQUcsS0FBSyxDQUFDO0FBRTFDLE1BQU0sZ0JBQWdCLEdBQTZDO0lBQ2xFO1FBQ0MsUUFBUSxFQUFFO1lBQ1QsSUFBSSxNQUFNLENBQUMsOEJBQThCLENBQUM7WUFDMUMsSUFBSSxNQUFNLENBQUMsb0JBQW9CLENBQUM7U0FDaEM7UUFDRCxJQUFJLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQztLQUM1QjtJQUNEO1FBQ0MsUUFBUSxFQUFFO1lBQ1QsSUFBSSxNQUFNLENBQUMsMEJBQTBCLENBQUM7WUFDdEMsSUFBSSxNQUFNLENBQUMseUNBQXlDLENBQUM7WUFDckQsSUFBSSxNQUFNLENBQUMsK0JBQStCLENBQUM7WUFDM0MsSUFBSSxNQUFNLENBQUMsY0FBYyxDQUFDLEVBQUUsd0RBQXdEO1NBQ3BGO1FBQ0QsSUFBSSxFQUFFLENBQUMsb0JBQW9CLEVBQUUscUJBQXFCLENBQUM7S0FDbkQ7Q0FDRCxDQUFDO0FBRUYsTUFBTSxVQUFVLG9DQUFvQyxDQUFDLFdBQW1CLEVBQUUseUJBQXFEO0lBQzlILE1BQU0sS0FBSyxHQUFHLHlCQUF5QixDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ25ELElBQUksQ0FBQyxLQUFLLElBQUksNkJBQTZCLEVBQUUsQ0FBQztRQUM3QyxPQUFPO0lBQ1IsQ0FBQztJQUVELE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztJQUMzQyxNQUFNLFFBQVEsR0FBYTtRQUMxQix5QkFBeUIsV0FBVyxxQkFBcUI7UUFDekQsK0tBQStLO0tBQy9LLENBQUM7SUFDRixLQUFLLE1BQU0sZUFBZSxJQUFJLGdCQUFnQixFQUFFLENBQUM7UUFDaEQsSUFBSSxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUNoRixTQUFTO1FBQ1YsQ0FBQztRQUNELE1BQU0sZUFBZSxHQUFHLGVBQWUsQ0FBQyxJQUFJLENBQUM7UUFDN0MsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7YUFDZixNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQzthQUMvRCxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDZixnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQy9CLENBQUMsQ0FBQyxDQUFDO0lBRUwsQ0FBQztJQUNELGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRTtRQUNuQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssUUFBUSxFQUFFLENBQUMsQ0FBQztJQUNoQyxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksZ0JBQWdCLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDM0IsNkJBQTZCLEdBQUcsSUFBSSxDQUFDO1FBQ3JDLE9BQU8sUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUM5QixDQUFDO0lBRUQsT0FBTyxTQUFTLENBQUM7QUFDbEIsQ0FBQyJ9