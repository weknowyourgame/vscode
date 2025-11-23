import { htmlAttributeEncodeValue } from '../../../../base/common/strings.js';
export const mathInlineRegExp = /(?<![a-zA-Z0-9])(?<dollars>\${1,2})(?!\.)(?!\()(?!["'#])((?:\\.|[^\\\n])*?(?:\\.|[^\\\n\$]))\k<dollars>(?![a-zA-Z0-9])/; // Non-standard, but ensure opening $ is not preceded and closing $ is not followed by word/number characters, opening $ not followed by ., (, ", ', or #
export const katexContainerClassName = 'vscode-katex-container';
export const katexContainerLatexAttributeName = 'data-latex';
const inlineRule = new RegExp('^' + mathInlineRegExp.source);
export var MarkedKatexExtension;
(function (MarkedKatexExtension) {
    const blockRule = /^(\${1,2})\n((?:\\[^]|[^\\])+?)\n\1(?:\n|$)/;
    function extension(katex, options = {}) {
        return {
            extensions: [
                inlineKatex(options, createRenderer(katex, options, false)),
                blockKatex(options, createRenderer(katex, options, true)),
            ],
        };
    }
    MarkedKatexExtension.extension = extension;
    function createRenderer(katex, options, isBlock) {
        return (token) => {
            let out;
            try {
                const html = katex.renderToString(token.text, {
                    ...options,
                    throwOnError: true,
                    displayMode: token.displayMode,
                });
                // Wrap in a container with attribute as a fallback for extracting the original LaTeX source
                // This ensures we can always retrieve the source even if the annotation element is not present
                out = `<span class="${katexContainerClassName}" ${katexContainerLatexAttributeName}="${htmlAttributeEncodeValue(token.text)}">${html}</span>`;
            }
            catch {
                // On failure, just use the original text including the wrapping $ or $$
                out = token.raw;
            }
            return out + (isBlock ? '\n' : '');
        };
    }
    function inlineKatex(options, renderer) {
        const ruleReg = inlineRule;
        return {
            name: 'inlineKatex',
            level: 'inline',
            start(src) {
                let index;
                let indexSrc = src;
                while (indexSrc) {
                    index = indexSrc.indexOf('$');
                    if (index === -1) {
                        return;
                    }
                    const possibleKatex = indexSrc.substring(index);
                    if (possibleKatex.match(ruleReg)) {
                        return index;
                    }
                    indexSrc = indexSrc.substring(index + 1).replace(/^\$+/, '');
                }
                return;
            },
            tokenizer(src, tokens) {
                const match = src.match(ruleReg);
                if (match) {
                    return {
                        type: 'inlineKatex',
                        raw: match[0],
                        text: match[2].trim(),
                        displayMode: match[1].length === 2,
                    };
                }
                return;
            },
            renderer,
        };
    }
    function blockKatex(options, renderer) {
        return {
            name: 'blockKatex',
            level: 'block',
            start(src) {
                return src.match(new RegExp(blockRule.source, 'm'))?.index;
            },
            tokenizer(src, tokens) {
                const match = src.match(blockRule);
                if (match) {
                    return {
                        type: 'blockKatex',
                        raw: match[0],
                        text: match[2].trim(),
                        displayMode: match[1].length === 2,
                    };
                }
                return;
            },
            renderer,
        };
    }
})(MarkedKatexExtension || (MarkedKatexExtension = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFya2VkS2F0ZXhFeHRlbnNpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWFya2Rvd24vY29tbW9uL21hcmtlZEthdGV4RXh0ZW5zaW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUtBLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBRTlFLE1BQU0sQ0FBQyxNQUFNLGdCQUFnQixHQUFHLHdIQUF3SCxDQUFDLENBQUMseUpBQXlKO0FBQ25ULE1BQU0sQ0FBQyxNQUFNLHVCQUF1QixHQUFHLHdCQUF3QixDQUFDO0FBQ2hFLE1BQU0sQ0FBQyxNQUFNLGdDQUFnQyxHQUFHLFlBQVksQ0FBQztBQUU3RCxNQUFNLFVBQVUsR0FBRyxJQUFJLE1BQU0sQ0FBQyxHQUFHLEdBQUcsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUM7QUFFN0QsTUFBTSxLQUFXLG9CQUFvQixDQXFHcEM7QUFyR0QsV0FBaUIsb0JBQW9CO0lBT3BDLE1BQU0sU0FBUyxHQUFHLDZDQUE2QyxDQUFDO0lBRWhFLFNBQWdCLFNBQVMsQ0FBQyxLQUFxQyxFQUFFLFVBQThCLEVBQUU7UUFDaEcsT0FBTztZQUNOLFVBQVUsRUFBRTtnQkFDWCxXQUFXLENBQUMsT0FBTyxFQUFFLGNBQWMsQ0FBQyxLQUFLLEVBQUUsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO2dCQUMzRCxVQUFVLENBQUMsT0FBTyxFQUFFLGNBQWMsQ0FBQyxLQUFLLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO2FBQ3pEO1NBQ0QsQ0FBQztJQUNILENBQUM7SUFQZSw4QkFBUyxZQU94QixDQUFBO0lBRUQsU0FBUyxjQUFjLENBQUMsS0FBcUMsRUFBRSxPQUEyQixFQUFFLE9BQWdCO1FBQzNHLE9BQU8sQ0FBQyxLQUE0QixFQUFFLEVBQUU7WUFDdkMsSUFBSSxHQUFXLENBQUM7WUFDaEIsSUFBSSxDQUFDO2dCQUNKLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRTtvQkFDN0MsR0FBRyxPQUFPO29CQUNWLFlBQVksRUFBRSxJQUFJO29CQUNsQixXQUFXLEVBQUUsS0FBSyxDQUFDLFdBQVc7aUJBQzlCLENBQUMsQ0FBQztnQkFFSCw0RkFBNEY7Z0JBQzVGLCtGQUErRjtnQkFDL0YsR0FBRyxHQUFHLGdCQUFnQix1QkFBdUIsS0FBSyxnQ0FBZ0MsS0FBSyx3QkFBd0IsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssSUFBSSxTQUFTLENBQUM7WUFDL0ksQ0FBQztZQUFDLE1BQU0sQ0FBQztnQkFDUix3RUFBd0U7Z0JBQ3hFLEdBQUcsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDO1lBQ2pCLENBQUM7WUFDRCxPQUFPLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNwQyxDQUFDLENBQUM7SUFDSCxDQUFDO0lBRUQsU0FBUyxXQUFXLENBQUMsT0FBMkIsRUFBRSxRQUEwQztRQUMzRixNQUFNLE9BQU8sR0FBRyxVQUFVLENBQUM7UUFDM0IsT0FBTztZQUNOLElBQUksRUFBRSxhQUFhO1lBQ25CLEtBQUssRUFBRSxRQUFRO1lBQ2YsS0FBSyxDQUFDLEdBQVc7Z0JBQ2hCLElBQUksS0FBSyxDQUFDO2dCQUNWLElBQUksUUFBUSxHQUFHLEdBQUcsQ0FBQztnQkFFbkIsT0FBTyxRQUFRLEVBQUUsQ0FBQztvQkFDakIsS0FBSyxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQzlCLElBQUksS0FBSyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUM7d0JBQ2xCLE9BQU87b0JBQ1IsQ0FBQztvQkFFRCxNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO29CQUNoRCxJQUFJLGFBQWEsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQzt3QkFDbEMsT0FBTyxLQUFLLENBQUM7b0JBQ2QsQ0FBQztvQkFFRCxRQUFRLEdBQUcsUUFBUSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQztnQkFDOUQsQ0FBQztnQkFDRCxPQUFPO1lBQ1IsQ0FBQztZQUNELFNBQVMsQ0FBQyxHQUFXLEVBQUUsTUFBc0I7Z0JBQzVDLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQ2pDLElBQUksS0FBSyxFQUFFLENBQUM7b0JBQ1gsT0FBTzt3QkFDTixJQUFJLEVBQUUsYUFBYTt3QkFDbkIsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7d0JBQ2IsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUU7d0JBQ3JCLFdBQVcsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxLQUFLLENBQUM7cUJBQ2xDLENBQUM7Z0JBQ0gsQ0FBQztnQkFDRCxPQUFPO1lBQ1IsQ0FBQztZQUNELFFBQVE7U0FDUixDQUFDO0lBQ0gsQ0FBQztJQUVELFNBQVMsVUFBVSxDQUFDLE9BQTJCLEVBQUUsUUFBMEM7UUFDMUYsT0FBTztZQUNOLElBQUksRUFBRSxZQUFZO1lBQ2xCLEtBQUssRUFBRSxPQUFPO1lBQ2QsS0FBSyxDQUFDLEdBQVc7Z0JBQ2hCLE9BQU8sR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLE1BQU0sQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDO1lBQzVELENBQUM7WUFDRCxTQUFTLENBQUMsR0FBVyxFQUFFLE1BQXNCO2dCQUM1QyxNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUNuQyxJQUFJLEtBQUssRUFBRSxDQUFDO29CQUNYLE9BQU87d0JBQ04sSUFBSSxFQUFFLFlBQVk7d0JBQ2xCLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO3dCQUNiLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFO3dCQUNyQixXQUFXLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDO3FCQUNsQyxDQUFDO2dCQUNILENBQUM7Z0JBQ0QsT0FBTztZQUNSLENBQUM7WUFDRCxRQUFRO1NBQ1IsQ0FBQztJQUNILENBQUM7QUFDRixDQUFDLEVBckdnQixvQkFBb0IsS0FBcEIsb0JBQW9CLFFBcUdwQyJ9