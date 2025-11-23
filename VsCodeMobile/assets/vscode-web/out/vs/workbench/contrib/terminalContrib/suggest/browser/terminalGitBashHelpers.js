/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Converts a Git Bash absolute path to a Windows absolute path.
 * Examples:
 *   "/"      => "C:\\"
 *   "/c/"    => "C:\\"
 *   "/c/Users/foo" => "C:\\Users\\foo"
 *   "/d/bar" => "D:\\bar"
 */
export function gitBashToWindowsPath(path, driveLetter) {
    // Dynamically determine the system drive (default to 'C:' if not set)
    const systemDrive = (driveLetter || 'C:').toUpperCase();
    // Handle root "/"
    if (path === '/') {
        return `${systemDrive}\\`;
    }
    const match = path.match(/^\/([a-zA-Z])(\/.*)?$/);
    if (match) {
        const drive = match[1].toUpperCase();
        const rest = match[2] ? match[2].replace(/\//g, '\\') : '\\';
        return `${drive}:${rest}`;
    }
    // Fallback: just replace slashes
    return path.replace(/\//g, '\\');
}
/**
 *
 * @param path A Windows-style absolute path (e.g., "C:\Users\foo").
 * Converts it to a Git Bash-style absolute path (e.g., "/c/Users/foo").
 * @returns The Git Bash-style absolute path.
 */
export function windowsToGitBashPath(path) {
    // Convert Windows path (e.g. C:\Users\foo) to Git Bash path (e.g. /c/Users/foo)
    return path
        .replace(/^[a-zA-Z]:\\/, match => `/${match[0].toLowerCase()}/`)
        .replace(/\\/g, '/');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxHaXRCYXNoSGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvc3VnZ2VzdC9icm93c2VyL3Rlcm1pbmFsR2l0QmFzaEhlbHBlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEc7Ozs7Ozs7R0FPRztBQUNILE1BQU0sVUFBVSxvQkFBb0IsQ0FBQyxJQUFZLEVBQUUsV0FBb0I7SUFDdEUsc0VBQXNFO0lBQ3RFLE1BQU0sV0FBVyxHQUFHLENBQUMsV0FBVyxJQUFJLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBQ3hELGtCQUFrQjtJQUNsQixJQUFJLElBQUksS0FBSyxHQUFHLEVBQUUsQ0FBQztRQUNsQixPQUFPLEdBQUcsV0FBVyxJQUFJLENBQUM7SUFDM0IsQ0FBQztJQUNELE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsdUJBQXVCLENBQUMsQ0FBQztJQUNsRCxJQUFJLEtBQUssRUFBRSxDQUFDO1FBQ1gsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ3JDLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztRQUM3RCxPQUFPLEdBQUcsS0FBSyxJQUFJLElBQUksRUFBRSxDQUFDO0lBQzNCLENBQUM7SUFDRCxpQ0FBaUM7SUFDakMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNsQyxDQUFDO0FBRUQ7Ozs7O0dBS0c7QUFDSCxNQUFNLFVBQVUsb0JBQW9CLENBQUMsSUFBWTtJQUNoRCxnRkFBZ0Y7SUFDaEYsT0FBTyxJQUFJO1NBQ1QsT0FBTyxDQUFDLGNBQWMsRUFBRSxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxHQUFHLENBQUM7U0FDL0QsT0FBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztBQUN2QixDQUFDIn0=