/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../base/test/common/utils.js';
import { Range } from '../../../../../../../editor/common/core/range.js';
import { URI } from '../../../../../../../base/common/uri.js';
import { PromptFileParser } from '../../../../common/promptSyntax/promptFileParser.js';
suite('NewPromptsParser', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('agent', async () => {
        const uri = URI.parse('file:///test/test.agent.md');
        const content = [
            /* 01 */ '---',
            /* 02 */ `description: "Agent test"`,
            /* 03 */ 'model: GPT 4.1',
            /* 04 */ `tools: ['tool1', 'tool2']`,
            /* 05 */ '---',
            /* 06 */ 'This is an agent test.',
            /* 07 */ 'Here is a #tool:tool1 variable (and one with closing parenthesis after: #tool:tool-2) and a #file:./reference1.md as well as a [reference](./reference2.md).',
        ].join('\n');
        const result = new PromptFileParser().parse(uri, content);
        assert.deepEqual(result.uri, uri);
        assert.ok(result.header);
        assert.ok(result.body);
        assert.deepEqual(result.header.range, { startLineNumber: 2, startColumn: 1, endLineNumber: 5, endColumn: 1 });
        assert.deepEqual(result.header.attributes, [
            { key: 'description', range: new Range(2, 1, 2, 26), value: { type: 'string', value: 'Agent test', range: new Range(2, 14, 2, 26) } },
            { key: 'model', range: new Range(3, 1, 3, 15), value: { type: 'string', value: 'GPT 4.1', range: new Range(3, 8, 3, 15) } },
            {
                key: 'tools', range: new Range(4, 1, 4, 26), value: {
                    type: 'array',
                    items: [{ type: 'string', value: 'tool1', range: new Range(4, 9, 4, 16) }, { type: 'string', value: 'tool2', range: new Range(4, 18, 4, 25) }],
                    range: new Range(4, 8, 4, 26)
                }
            },
        ]);
        assert.deepEqual(result.body.range, { startLineNumber: 6, startColumn: 1, endLineNumber: 8, endColumn: 1 });
        assert.equal(result.body.offset, 75);
        assert.equal(result.body.getContent(), 'This is an agent test.\nHere is a #tool:tool1 variable (and one with closing parenthesis after: #tool:tool-2) and a #file:./reference1.md as well as a [reference](./reference2.md).');
        assert.deepEqual(result.body.fileReferences, [
            { range: new Range(7, 99, 7, 114), content: './reference1.md', isMarkdownLink: false },
            { range: new Range(7, 140, 7, 155), content: './reference2.md', isMarkdownLink: true }
        ]);
        assert.deepEqual(result.body.variableReferences, [
            { range: new Range(7, 17, 7, 22), name: 'tool1', offset: 108 },
            { range: new Range(7, 79, 7, 85), name: 'tool-2', offset: 170 }
        ]);
        assert.deepEqual(result.header.description, 'Agent test');
        assert.deepEqual(result.header.model, 'GPT 4.1');
        assert.ok(result.header.tools);
        assert.deepEqual(result.header.tools, ['tool1', 'tool2']);
    });
    test('mode with handoff', async () => {
        const uri = URI.parse('file:///test/test.agent.md');
        const content = [
            /* 01 */ '---',
            /* 02 */ `description: "Agent test"`,
            /* 03 */ 'model: GPT 4.1',
            /* 04 */ 'handoffs:',
            /* 05 */ '  - label: "Implement"',
            /* 06 */ '    agent: Default',
            /* 07 */ '    prompt: "Implement the plan"',
            /* 08 */ '    send: false',
            /* 09 */ '  - label: "Save"',
            /* 10 */ '    agent: Default',
            /* 11 */ '    prompt: "Save the plan to a file"',
            /* 12 */ '    send: true',
            /* 13 */ '---',
        ].join('\n');
        const result = new PromptFileParser().parse(uri, content);
        assert.deepEqual(result.uri, uri);
        assert.ok(result.header);
        assert.deepEqual(result.header.range, { startLineNumber: 2, startColumn: 1, endLineNumber: 13, endColumn: 1 });
        assert.deepEqual(result.header.attributes, [
            { key: 'description', range: new Range(2, 1, 2, 26), value: { type: 'string', value: 'Agent test', range: new Range(2, 14, 2, 26) } },
            { key: 'model', range: new Range(3, 1, 3, 15), value: { type: 'string', value: 'GPT 4.1', range: new Range(3, 8, 3, 15) } },
            {
                key: 'handoffs', range: new Range(4, 1, 12, 15), value: {
                    type: 'array',
                    range: new Range(5, 3, 12, 15),
                    items: [
                        {
                            type: 'object', range: new Range(5, 5, 8, 16),
                            properties: [
                                { key: { type: 'string', value: 'label', range: new Range(5, 5, 5, 10) }, value: { type: 'string', value: 'Implement', range: new Range(5, 12, 5, 23) } },
                                { key: { type: 'string', value: 'agent', range: new Range(6, 5, 6, 10) }, value: { type: 'string', value: 'Default', range: new Range(6, 12, 6, 19) } },
                                { key: { type: 'string', value: 'prompt', range: new Range(7, 5, 7, 11) }, value: { type: 'string', value: 'Implement the plan', range: new Range(7, 13, 7, 33) } },
                                { key: { type: 'string', value: 'send', range: new Range(8, 5, 8, 9) }, value: { type: 'boolean', value: false, range: new Range(8, 11, 8, 16) } },
                            ]
                        },
                        {
                            type: 'object', range: new Range(9, 5, 12, 15),
                            properties: [
                                { key: { type: 'string', value: 'label', range: new Range(9, 5, 9, 10) }, value: { type: 'string', value: 'Save', range: new Range(9, 12, 9, 18) } },
                                { key: { type: 'string', value: 'agent', range: new Range(10, 5, 10, 10) }, value: { type: 'string', value: 'Default', range: new Range(10, 12, 10, 19) } },
                                { key: { type: 'string', value: 'prompt', range: new Range(11, 5, 11, 11) }, value: { type: 'string', value: 'Save the plan to a file', range: new Range(11, 13, 11, 38) } },
                                { key: { type: 'string', value: 'send', range: new Range(12, 5, 12, 9) }, value: { type: 'boolean', value: true, range: new Range(12, 11, 12, 15) } },
                            ]
                        },
                    ]
                }
            },
        ]);
        assert.deepEqual(result.header.description, 'Agent test');
        assert.deepEqual(result.header.model, 'GPT 4.1');
        assert.ok(result.header.handOffs);
        assert.deepEqual(result.header.handOffs, [
            { label: 'Implement', agent: 'Default', prompt: 'Implement the plan', send: false },
            { label: 'Save', agent: 'Default', prompt: 'Save the plan to a file', send: true }
        ]);
    });
    test('mode with handoff and showContinueOn per handoff', async () => {
        const uri = URI.parse('file:///test/test.agent.md');
        const content = [
            /* 01 */ '---',
            /* 02 */ `description: "Agent test"`,
            /* 03 */ 'model: GPT 4.1',
            /* 04 */ 'handoffs:',
            /* 05 */ '  - label: "Implement"',
            /* 06 */ '    agent: Default',
            /* 07 */ '    prompt: "Implement the plan"',
            /* 08 */ '    send: false',
            /* 09 */ '    showContinueOn: false',
            /* 10 */ '  - label: "Save"',
            /* 11 */ '    agent: Default',
            /* 12 */ '    prompt: "Save the plan"',
            /* 13 */ '    send: true',
            /* 14 */ '    showContinueOn: true',
            /* 15 */ '---',
        ].join('\n');
        const result = new PromptFileParser().parse(uri, content);
        assert.deepEqual(result.uri, uri);
        assert.ok(result.header);
        assert.ok(result.header.handOffs);
        assert.deepEqual(result.header.handOffs, [
            { label: 'Implement', agent: 'Default', prompt: 'Implement the plan', send: false, showContinueOn: false },
            { label: 'Save', agent: 'Default', prompt: 'Save the plan', send: true, showContinueOn: true }
        ]);
    });
    test('showContinueOn defaults to undefined when not specified per handoff', async () => {
        const uri = URI.parse('file:///test/test.agent.md');
        const content = [
            /* 01 */ '---',
            /* 02 */ `description: "Agent test"`,
            /* 03 */ 'handoffs:',
            /* 04 */ '  - label: "Save"',
            /* 05 */ '    agent: Default',
            /* 06 */ '    prompt: "Save the plan"',
            /* 07 */ '---',
        ].join('\n');
        const result = new PromptFileParser().parse(uri, content);
        assert.deepEqual(result.uri, uri);
        assert.ok(result.header);
        assert.ok(result.header.handOffs);
        assert.deepEqual(result.header.handOffs[0].showContinueOn, undefined);
    });
    test('instructions', async () => {
        const uri = URI.parse('file:///test/prompt1.md');
        const content = [
            /* 01 */ '---',
            /* 02 */ `description: "Code style instructions for TypeScript"`,
            /* 03 */ 'applyTo: *.ts',
            /* 04 */ '---',
            /* 05 */ 'Follow my companies coding guidlines at [mycomp-ts-guidelines](https://mycomp/guidelines#typescript.md)',
        ].join('\n');
        const result = new PromptFileParser().parse(uri, content);
        assert.deepEqual(result.uri, uri);
        assert.ok(result.header);
        assert.ok(result.body);
        assert.deepEqual(result.header.range, { startLineNumber: 2, startColumn: 1, endLineNumber: 4, endColumn: 1 });
        assert.deepEqual(result.header.attributes, [
            { key: 'description', range: new Range(2, 1, 2, 54), value: { type: 'string', value: 'Code style instructions for TypeScript', range: new Range(2, 14, 2, 54) } },
            { key: 'applyTo', range: new Range(3, 1, 3, 14), value: { type: 'string', value: '*.ts', range: new Range(3, 10, 3, 14) } },
        ]);
        assert.deepEqual(result.body.range, { startLineNumber: 5, startColumn: 1, endLineNumber: 6, endColumn: 1 });
        assert.equal(result.body.offset, 76);
        assert.equal(result.body.getContent(), 'Follow my companies coding guidlines at [mycomp-ts-guidelines](https://mycomp/guidelines#typescript.md)');
        assert.deepEqual(result.body.fileReferences, [
            { range: new Range(5, 64, 5, 103), content: 'https://mycomp/guidelines#typescript.md', isMarkdownLink: true },
        ]);
        assert.deepEqual(result.body.variableReferences, []);
        assert.deepEqual(result.header.description, 'Code style instructions for TypeScript');
        assert.deepEqual(result.header.applyTo, '*.ts');
    });
    test('prompt file', async () => {
        const uri = URI.parse('file:///test/prompt2.md');
        const content = [
            /* 01 */ '---',
            /* 02 */ `description: "General purpose coding assistant"`,
            /* 03 */ 'agent: agent',
            /* 04 */ 'model: GPT 4.1',
            /* 05 */ `tools: ['search', 'terminal']`,
            /* 06 */ '---',
            /* 07 */ 'This is a prompt file body referencing #tool:search and [docs](https://example.com/docs).',
        ].join('\n');
        const result = new PromptFileParser().parse(uri, content);
        assert.deepEqual(result.uri, uri);
        assert.ok(result.header);
        assert.ok(result.body);
        assert.deepEqual(result.header.range, { startLineNumber: 2, startColumn: 1, endLineNumber: 6, endColumn: 1 });
        assert.deepEqual(result.header.attributes, [
            { key: 'description', range: new Range(2, 1, 2, 48), value: { type: 'string', value: 'General purpose coding assistant', range: new Range(2, 14, 2, 48) } },
            { key: 'agent', range: new Range(3, 1, 3, 13), value: { type: 'string', value: 'agent', range: new Range(3, 8, 3, 13) } },
            { key: 'model', range: new Range(4, 1, 4, 15), value: { type: 'string', value: 'GPT 4.1', range: new Range(4, 8, 4, 15) } },
            {
                key: 'tools', range: new Range(5, 1, 5, 30), value: {
                    type: 'array',
                    items: [{ type: 'string', value: 'search', range: new Range(5, 9, 5, 17) }, { type: 'string', value: 'terminal', range: new Range(5, 19, 5, 29) }],
                    range: new Range(5, 8, 5, 30)
                }
            },
        ]);
        assert.deepEqual(result.body.range, { startLineNumber: 7, startColumn: 1, endLineNumber: 8, endColumn: 1 });
        assert.equal(result.body.offset, 114);
        assert.equal(result.body.getContent(), 'This is a prompt file body referencing #tool:search and [docs](https://example.com/docs).');
        assert.deepEqual(result.body.fileReferences, [
            { range: new Range(7, 64, 7, 88), content: 'https://example.com/docs', isMarkdownLink: true },
        ]);
        assert.deepEqual(result.body.variableReferences, [
            { range: new Range(7, 46, 7, 52), name: 'search', offset: 153 }
        ]);
        assert.deepEqual(result.header.description, 'General purpose coding assistant');
        assert.deepEqual(result.header.agent, 'agent');
        assert.deepEqual(result.header.model, 'GPT 4.1');
        assert.ok(result.header.tools);
        assert.deepEqual(result.header.tools, ['search', 'terminal']);
    });
    test('prompt file tools as map', async () => {
        const uri = URI.parse('file:///test/prompt2.md');
        const content = [
            /* 01 */ '---',
            /* 02 */ 'tools:',
            /* 03 */ '  built-in: true',
            /* 04 */ '  mcp:',
            /* 05 */ '    vscode-playright-mcp:',
            /* 06 */ '      browser-click: true',
            /* 07 */ '  extensions:',
            /* 08 */ '    github.vscode-pull-request-github:',
            /* 09 */ '      openPullRequest: true',
            /* 10 */ '      copilotCodingAgent: false',
            /* 11 */ '---',
        ].join('\n');
        const result = new PromptFileParser().parse(uri, content);
        assert.deepEqual(result.uri, uri);
        assert.ok(result.header);
        assert.ok(!result.body);
        assert.deepEqual(result.header.range, { startLineNumber: 2, startColumn: 1, endLineNumber: 11, endColumn: 1 });
        assert.deepEqual(result.header.attributes, [
            {
                key: 'tools', range: new Range(2, 1, 10, 32), value: {
                    type: 'object',
                    properties: [
                        {
                            'key': { type: 'string', value: 'built-in', range: new Range(3, 3, 3, 11) },
                            'value': { type: 'boolean', value: true, range: new Range(3, 13, 3, 17) }
                        },
                        {
                            'key': { type: 'string', value: 'mcp', range: new Range(4, 3, 4, 6) },
                            'value': {
                                type: 'object', range: new Range(5, 5, 6, 26), properties: [
                                    {
                                        'key': { type: 'string', value: 'vscode-playright-mcp', range: new Range(5, 5, 5, 25) }, 'value': {
                                            type: 'object', range: new Range(6, 7, 6, 26), properties: [
                                                { 'key': { type: 'string', value: 'browser-click', range: new Range(6, 7, 6, 20) }, 'value': { type: 'boolean', value: true, range: new Range(6, 22, 6, 26) } }
                                            ]
                                        }
                                    }
                                ]
                            }
                        },
                        {
                            'key': { type: 'string', value: 'extensions', range: new Range(7, 3, 7, 13) },
                            'value': {
                                type: 'object', range: new Range(8, 5, 10, 32), properties: [
                                    {
                                        'key': { type: 'string', value: 'github.vscode-pull-request-github', range: new Range(8, 5, 8, 38) }, 'value': {
                                            type: 'object', range: new Range(9, 7, 10, 32), properties: [
                                                { 'key': { type: 'string', value: 'openPullRequest', range: new Range(9, 7, 9, 22) }, 'value': { type: 'boolean', value: true, range: new Range(9, 24, 9, 28) } },
                                                { 'key': { type: 'string', value: 'copilotCodingAgent', range: new Range(10, 7, 10, 25) }, 'value': { type: 'boolean', value: false, range: new Range(10, 27, 10, 32) } }
                                            ]
                                        }
                                    }
                                ]
                            }
                        },
                    ],
                    range: new Range(3, 3, 10, 32)
                },
            }
        ]);
        assert.deepEqual(result.header.description, undefined);
        assert.deepEqual(result.header.agent, undefined);
        assert.deepEqual(result.header.model, undefined);
        assert.ok(result.header.tools);
        assert.deepEqual(result.header.tools, ['built-in', 'browser-click', 'openPullRequest', 'copilotCodingAgent']);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV3UHJvbXB0c1BhcnNlci50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvdGVzdC9jb21tb24vcHJvbXB0U3ludGF4L3NlcnZpY2UvbmV3UHJvbXB0c1BhcnNlci50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUU1QixPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUN6RyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDekUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzlELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBRXZGLEtBQUssQ0FBQyxrQkFBa0IsRUFBRSxHQUFHLEVBQUU7SUFDOUIsdUNBQXVDLEVBQUUsQ0FBQztJQUUxQyxJQUFJLENBQUMsT0FBTyxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ3hCLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsNEJBQTRCLENBQUMsQ0FBQztRQUNwRCxNQUFNLE9BQU8sR0FBRztZQUNmLFFBQVEsQ0FBQSxLQUFLO1lBQ2IsUUFBUSxDQUFBLDJCQUEyQjtZQUNuQyxRQUFRLENBQUEsZ0JBQWdCO1lBQ3hCLFFBQVEsQ0FBQSwyQkFBMkI7WUFDbkMsUUFBUSxDQUFBLEtBQUs7WUFDYixRQUFRLENBQUEsd0JBQXdCO1lBQ2hDLFFBQVEsQ0FBQSw4SkFBOEo7U0FDdEssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDYixNQUFNLE1BQU0sR0FBRyxJQUFJLGdCQUFnQixFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUMxRCxNQUFNLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDbEMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDekIsTUFBTSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdkIsTUFBTSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxFQUFFLGVBQWUsRUFBRSxDQUFDLEVBQUUsV0FBVyxFQUFFLENBQUMsRUFBRSxhQUFhLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzlHLE1BQU0sQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUU7WUFDMUMsRUFBRSxHQUFHLEVBQUUsYUFBYSxFQUFFLEtBQUssRUFBRSxJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxZQUFZLEVBQUUsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDckksRUFBRSxHQUFHLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDM0g7Z0JBQ0MsR0FBRyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVB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RUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUU7Z0NBQ3ZKLEVBQUUsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLG9CQUFvQixFQUFFLEtBQUssRUFBRSxJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFO2dDQUNuSyxFQUFFLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUU7NkJBQ2xKO3lCQUNEO3dCQUNEOzRCQUNDLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQzs0QkFDOUMsVUFBVSxFQUFFO2dDQUNYLEVBQUUsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRTtnQ0FDcEosRUFBRSxHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxJQUFJLEtBQUssQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFO2dDQUMzSixFQUFFLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsSUFBSSxLQUFLLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSx5QkFBeUIsRUFBRSxLQUFLLEVBQUUsSUFBSSxLQUFLLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRTtnQ0FDNUssRUFBRSxHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsS0FB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QUFLLEVBQUUsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ3pILEVBQUUsR0FBRyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQzNIO2dCQUNDLEdBQUcsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRTtvQkFDbkQsSUFBSSxFQUFFLE9BQU87b0JBQ2IsS0FBSyxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUM7b0JBQ2xKLEtBQUssRUFBRSxJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7aUJB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