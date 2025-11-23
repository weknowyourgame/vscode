/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export async function getTextResponseFromStream(response) {
    let responseText = '';
    const streaming = (async () => {
        if (!response || !response.stream) {
            return;
        }
        for await (const part of response.stream) {
            if (Array.isArray(part)) {
                for (const p of part) {
                    if (p.type === 'text') {
                        responseText += p.value;
                    }
                }
            }
            else if (part.type === 'text') {
                responseText += part.value;
            }
        }
    })();
    try {
        await Promise.all([response.result, streaming]);
        return responseText;
    }
    catch (err) {
        return 'Error occurred ' + err;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL2NoYXRBZ2VudFRvb2xzL2Jyb3dzZXIvdG9vbHMvbW9uaXRvcmluZy91dGlscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUloRyxNQUFNLENBQUMsS0FBSyxVQUFVLHlCQUF5QixDQUFDLFFBQW9DO0lBQ25GLElBQUksWUFBWSxHQUFHLEVBQUUsQ0FBQztJQUN0QixNQUFNLFNBQVMsR0FBRyxDQUFDLEtBQUssSUFBSSxFQUFFO1FBQzdCLElBQUksQ0FBQyxRQUFRLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDbkMsT0FBTztRQUNSLENBQUM7UUFDRCxJQUFJLEtBQUssRUFBRSxNQUFNLElBQUksSUFBSSxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDMUMsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7Z0JBQ3pCLEtBQUssTUFBTSxDQUFDLElBQUksSUFBSSxFQUFFLENBQUM7b0JBQ3RCLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxNQUFNLEVBQUUsQ0FBQzt3QkFDdkIsWUFBWSxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUM7b0JBQ3pCLENBQUM7Z0JBQ0YsQ0FBQztZQUNGLENBQUM7aUJBQU0sSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLE1BQU0sRUFBRSxDQUFDO2dCQUNqQyxZQUFZLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQztZQUM1QixDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFFTCxJQUFJLENBQUM7UUFDSixNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUM7UUFDaEQsT0FBTyxZQUFZLENBQUM7SUFDckIsQ0FBQztJQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7UUFDZCxPQUFPLGlCQUFpQixHQUFHLEdBQUcsQ0FBQztJQUNoQyxDQUFDO0FBQ0YsQ0FBQyJ9