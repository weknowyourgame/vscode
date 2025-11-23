/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { spawn } from 'child_process';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import * as assert from 'assert';
import { McpStdioStateHandler } from '../../node/mcpStdioStateHandler.js';
import { isWindows } from '../../../../../base/common/platform.js';
const GRACE_TIME = 100;
suite('McpStdioStateHandler', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    function run(code) {
        const child = spawn('node', ['-e', code], {
            stdio: 'pipe',
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        });
        return {
            child,
            handler: store.add(new McpStdioStateHandler(child, GRACE_TIME)),
            processId: new Promise((resolve) => {
                child.on('spawn', () => resolve(child.pid));
            }),
            output: new Promise((resolve) => {
                let output = '';
                child.stderr.setEncoding('utf-8').on('data', (data) => {
                    output += data.toString();
                });
                child.stdout.setEncoding('utf-8').on('data', (data) => {
                    output += data.toString();
                });
                child.on('close', () => resolve(output));
            }),
        };
    }
    test('stdin ends process', async () => {
        const { child, handler, output } = run(`
			const data = require('fs').readFileSync(0, 'utf-8');
			process.stdout.write('Data received: ' + data);
			process.on('SIGTERM', () => process.stdout.write('SIGTERM received'));
		`);
        child.stdin.write('Hello MCP!');
        handler.stop();
        const result = await output;
        assert.strictEqual(result.trim(), 'Data received: Hello MCP!');
    });
    if (!isWindows) {
        test('sigterm after grace', async () => {
            const { handler, output } = run(`
			setInterval(() => {}, 1000);
			process.stdin.on('end', () => process.stdout.write('stdin ended\\n'));
			process.stdin.resume();
			process.on('SIGTERM', () => {
				process.stdout.write('SIGTERM received', () => process.exit(0));
			});
		`);
            const before = Date.now();
            handler.stop();
            const result = await output;
            const delay = Date.now() - before;
            assert.strictEqual(result.trim(), 'stdin ended\nSIGTERM received');
            assert.ok(delay >= GRACE_TIME, `Expected at least ${GRACE_TIME}ms delay, got ${delay}ms`);
        });
    }
    test('sigkill after grace', async () => {
        const { handler, output } = run(`
			setInterval(() => {}, 1000);
			process.stdin.on('end', () => process.stdout.write('stdin ended\\n'));
			process.stdin.resume();
			process.on('SIGTERM', () => {
				process.stdout.write('SIGTERM received');
			});
		`);
        const before = Date.now();
        handler.stop();
        const result = await output;
        const delay = Date.now() - before;
        if (!isWindows) {
            assert.strictEqual(result.trim(), 'stdin ended\nSIGTERM received');
        }
        else {
            assert.strictEqual(result.trim(), 'stdin ended');
        }
        assert.ok(delay >= GRACE_TIME * 2, `Expected at least ${GRACE_TIME * 2}ms delay, got ${delay}ms`);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwU3RkaW9TdGF0ZUhhbmRsZXIudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9tY3AvdGVzdC9ub2RlL21jcFN0ZGlvU3RhdGVIYW5kbGVyLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUN0QyxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNuRyxPQUFPLEtBQUssTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUNqQyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUMxRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFFbkUsTUFBTSxVQUFVLEdBQUcsR0FBRyxDQUFDO0FBRXZCLEtBQUssQ0FBQyxzQkFBc0IsRUFBRSxHQUFHLEVBQUU7SUFDbEMsTUFBTSxLQUFLLEdBQUcsdUNBQXVDLEVBQUUsQ0FBQztJQUV4RCxTQUFTLEdBQUcsQ0FBQyxJQUFZO1FBQ3hCLE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUU7WUFDekMsS0FBSyxFQUFFLE1BQU07WUFDYixHQUFHLEVBQUUsRUFBRSxHQUFHLE9BQU8sQ0FBQyxHQUFHLEVBQUUsb0JBQW9CLEVBQUUsR0FBRyxFQUFFO1NBQ2xELENBQUMsQ0FBQztRQUVILE9BQU87WUFDTixLQUFLO1lBQ0wsT0FBTyxFQUFFLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxvQkFBb0IsQ0FBQyxLQUFLLEVBQUUsVUFBVSxDQUFDLENBQUM7WUFDL0QsU0FBUyxFQUFFLElBQUksT0FBTyxDQUFTLENBQUMsT0FBTyxFQUFFLEVBQUU7Z0JBQzFDLEtBQUssQ0FBQyxFQUFF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